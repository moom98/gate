#!/usr/bin/env node

/**
 * Codex CLI Notification Script for Gate
 *
 * Usage: codex-notify.js <json-payload>
 *
 * This script is called by Codex CLI when agent turns complete.
 * It parses the JSON payload and sends it to the Gate Broker.
 *
 * Environment Variables:
 * - GATE_BROKER_URL: Broker URL (default: http://localhost:3000)
 * - GATE_BROKER_TOKEN: Authentication token (required)
 *
 * Exit Behavior:
 * - Always exits 0 (graceful failure to not block Codex CLI)
 */

const https = require('https');
const http = require('http');

// Configuration from environment
const BROKER_URL = process.env.GATE_BROKER_URL || 'http://localhost:3000';
const BROKER_TOKEN = process.env.GATE_BROKER_TOKEN;

/**
 * Main execution
 */
async function main() {
  try {
    // Parse JSON from command line argument
    if (process.argv.length < 3) {
      console.error('[Codex Notify] ERROR: No payload provided');
      console.error('[Codex Notify] Usage: codex-notify.js <json-payload>');
      process.exit(0);
    }

    const rawPayload = process.argv[2];
    let payload;

    try {
      payload = JSON.parse(rawPayload);
    } catch (err) {
      console.error('[Codex Notify] ERROR: Invalid JSON payload');
      console.error('[Codex Notify] Parse error:', err.message);
      process.exit(0);
    }

    console.error('[Codex Notify] Received payload:', {
      threadId: payload.threadId || 'unknown',
      cwd: payload.cwd || 'unknown',
    });

    // Check if token is configured
    if (!BROKER_TOKEN) {
      console.error('[Codex Notify] WARNING: GATE_BROKER_TOKEN not set');
      console.error('[Codex Notify] Set environment variables in ~/.codex/config.toml');
      process.exit(0);
    }

    // Send to Broker
    await sendToBroker(payload);
    console.error('[Codex Notify] Successfully sent to Broker');
    process.exit(0);
  } catch (err) {
    console.error('[Codex Notify] Error:', err.message);
    // Always exit 0 to not block Codex CLI
    process.exit(0);
  }
}

/**
 * Send event to Broker
 */
function sendToBroker(payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BROKER_URL}/v1/codex-events`);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    // Extract message summary from payload
    const message = extractMessage(payload);

    const postData = JSON.stringify({
      type: 'agent-turn-complete',
      threadId: payload.threadId || 'unknown',
      cwd: payload.cwd || process.cwd(),
      raw: payload,
      ts: new Date().toISOString(),
      message: message,
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
 * Extract message summary from payload
 */
function extractMessage(payload) {
  // Try different payload structures
  if (payload.message && typeof payload.message === 'string') {
    return payload.message;
  }
  if (payload.summary && typeof payload.summary === 'string') {
    return payload.summary;
  }
  if (payload.text && typeof payload.text === 'string') {
    return payload.text;
  }
  // Fallback to stringified raw payload (truncated)
  const fallback = JSON.stringify(payload.raw || payload);
  return fallback.length > 200 ? fallback.substring(0, 197) + '...' : fallback;
}

// Run main
main();
