#!/usr/bin/env node

/**
 * Claude Code Notification Hook for idle_prompt
 *
 * This hook is triggered when Claude Code enters idle state (waiting for user input)
 * after 60+ seconds of inactivity.
 *
 * Behavior:
 * 1. Tries to POST event to Broker (/v1/claude-events)
 * 2. If Broker is unavailable, falls back to macOS desktop notification
 */

const https = require('https');
const http = require('http');
const { execSync } = require('child_process');

// Configuration from environment or fallback to settings file
let BROKER_URL = process.env.GATE_BROKER_URL || 'http://localhost:3000';
let BROKER_TOKEN = process.env.GATE_BROKER_TOKEN;

// Fallback: Read from settings.json if env vars not set
if (!BROKER_TOKEN) {
  try {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    // Try project-level settings first
    const projectSettingsPath = path.join(process.cwd(), '.claude', 'settings.json');
    // Then try global settings
    const globalSettingsPath = path.join(os.homedir(), '.claude', 'settings.json');

    const settingsPaths = [projectSettingsPath, globalSettingsPath];

    for (const settingsPath of settingsPaths) {
      if (fs.existsSync(settingsPath)) {
        console.error(`[NotificationHook] Trying to load config from: ${settingsPath}`);
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        // Look for Notification hook config
        const notifHook = settings?.hooks?.Notification?.find(h => h.matcher === 'idle_prompt');
        if (notifHook?.hooks?.[0]?.env) {
          BROKER_URL = notifHook.hooks[0].env.GATE_BROKER_URL || BROKER_URL;
          BROKER_TOKEN = notifHook.hooks[0].env.GATE_BROKER_TOKEN;
          console.error(`[NotificationHook] Loaded config from ${settingsPath}`);
          break;
        }
      }
    }
  } catch (err) {
    console.error(`[NotificationHook] Failed to load settings: ${err.message}`);
  }
}

console.error('[NotificationHook] idle_prompt hook triggered');
console.error(`[NotificationHook] BROKER_URL: ${BROKER_URL}`);
console.error(`[NotificationHook] BROKER_TOKEN: ${BROKER_TOKEN ? '***set***' : 'NOT SET'}`);

// Read stdin
let inputData = '';
process.stdin.on('data', (chunk) => { inputData += chunk; });

process.stdin.on('end', async () => {
  try {
    const payload = JSON.parse(inputData);
    console.error('[NotificationHook] Received payload:', JSON.stringify(payload, null, 2));

    // Try to send to Broker
    if (BROKER_TOKEN) {
      try {
        await sendToBroker(payload);
        console.error('[NotificationHook] Successfully sent to Broker');
      } catch (err) {
        console.error(`[NotificationHook] Failed to send to Broker: ${err.message}`);
        console.error('[NotificationHook] Falling back to macOS notification');
        showMacOSNotification();
      }
    } else {
      console.error('[NotificationHook] BROKER_TOKEN not set, using macOS notification only');
      showMacOSNotification();
    }

    // Always exit with success
    process.exit(0);
  } catch (err) {
    console.error('[NotificationHook] Error:', err.message);
    process.exit(0);
  }
});

/**
 * Send event to Broker
 */
function sendToBroker(payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BROKER_URL}/v1/claude-events`);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const postData = JSON.stringify({
      type: 'idle_prompt',
      raw: payload,
      ts: new Date().toISOString(),
      project: process.cwd()
    });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${BROKER_TOKEN}`
      },
      timeout: 5000
    };

    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          reject(new Error(`Broker returned ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Request failed: ${err.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Show macOS desktop notification as fallback
 */
function showMacOSNotification() {
  try {
    // Try terminal-notifier first (if installed via Homebrew)
    try {
      execSync('which terminal-notifier', { stdio: 'ignore' });
      execSync('terminal-notifier -title "Claude is Ready" -message "Waiting for your input" -sound default', {
        stdio: 'ignore'
      });
      console.error('[NotificationHook] Showed notification via terminal-notifier');
      return;
    } catch (err) {
      // terminal-notifier not available, fall through to osascript
    }

    // Fallback to osascript (built-in)
    const script = `display notification "Waiting for your input" with title "Claude is Ready" sound name "default"`;
    execSync(`osascript -e '${script}'`, { stdio: 'ignore' });
    console.error('[NotificationHook] Showed notification via osascript');
  } catch (err) {
    console.error(`[NotificationHook] Failed to show macOS notification: ${err.message}`);
  }
}
