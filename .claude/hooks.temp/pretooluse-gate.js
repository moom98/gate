#!/usr/bin/env node

const https = require('https');
const http = require('http');
const { randomUUID } = require('crypto');

// Configuration from environment or fallback to settings file
let BROKER_URL = process.env.GATE_BROKER_URL || 'http://localhost:3000';
let BROKER_TOKEN = process.env.GATE_BROKER_TOKEN;
const TIMEOUT_MS = 120000; // 120 seconds

// Fallback: Read from ~/.claude/settings.json if env vars not set
if (!BROKER_TOKEN) {
  try {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');

    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      const bashHook = settings?.hooks?.PreToolUse?.find(h => h.matcher === 'Bash');
      if (bashHook?.hooks?.[0]?.env) {
        BROKER_URL = bashHook.hooks[0].env.GATE_BROKER_URL || BROKER_URL;
        BROKER_TOKEN = bashHook.hooks[0].env.GATE_BROKER_TOKEN;
        console.error('[Hook] Loaded config from ~/.claude/settings.json');
      }
    }
  } catch (err) {
    console.error(`[Hook] Failed to load settings: ${err.message}`);
  }
}

// Debug: Log environment variable status (only when DEBUG is enabled)
if (process.env.DEBUG === 'true') {
  console.error(`[Hook] Debug: GATE_BROKER_URL = ${BROKER_URL}`);
  console.error(`[Hook] Debug: GATE_BROKER_TOKEN = ${BROKER_TOKEN ? '***set***' : 'NOT SET'}`);
  console.error(`[Hook] Debug: All env vars: ${JSON.stringify(Object.keys(process.env).filter(k => k.startsWith('GATE_')))}`);
}

// Read stdin
let inputData = '';
process.stdin.on('data', (chunk) => { inputData += chunk; });

process.stdin.on('end', async () => {
  try {
    const payload = JSON.parse(inputData);

    // Validate payload structure
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      console.error('[Hook] ERROR: Invalid payload - not an object');
      const output = {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: 'Invalid payload structure'
        }
      };
      console.log(JSON.stringify(output));
      process.exit(0);
    }

    if (!payload.tool_name || typeof payload.tool_name !== 'string') {
      console.error('[Hook] ERROR: Missing or invalid tool_name');
      const output = {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: 'Missing or invalid tool_name'
        }
      };
      console.log(JSON.stringify(output));
      process.exit(0);
    }

    if (!payload.cwd || typeof payload.cwd !== 'string') {
      console.error('[Hook] ERROR: Missing or invalid cwd');
      const output = {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: 'Missing or invalid cwd'
        }
      };
      console.log(JSON.stringify(output));
      process.exit(0);
    }

    if (!payload.tool_input || typeof payload.tool_input !== 'object' || Array.isArray(payload.tool_input)) {
      console.error('[Hook] ERROR: Missing or invalid tool_input');
      const output = {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: 'Missing or invalid tool_input'
        }
      };
      console.log(JSON.stringify(output));
      process.exit(0);
    }

    // Check if GATE_BROKER_TOKEN is configured
    if (!BROKER_TOKEN) {
      console.error('[Hook] ERROR: GATE_BROKER_TOKEN not set');
      console.error('[Hook] Please configure GATE_BROKER_TOKEN in .claude/settings.json');
      console.error('[Hook] See README.md for setup instructions');
      // Fail closed - deny all operations when token is not configured
      const output = {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: 'GATE_BROKER_TOKEN not configured. See README.md for setup instructions.'
        }
      };
      console.log(JSON.stringify(output));
      process.exit(0);
      return;
    }

    console.error(`[Hook] Tool: ${payload.tool_name}`);
    console.error(`[Hook] CWD: ${payload.cwd}`);

    // Only intercept specific tools (Bash, Edit, Write, NotebookEdit)
    const interceptedTools = ['Bash', 'Edit', 'Write', 'NotebookEdit'];
    if (!interceptedTools.includes(payload.tool_name)) {
      // Allow without asking
      console.error(`[Hook] Allowing ${payload.tool_name} without approval`);
      process.exit(0);
      return;
    }

    // Create permission request
    const requestId = randomUUID();
    const request = {
      id: requestId,
      summary: `${payload.tool_name}: ${getToolSummary(payload)}`,
      details: {
        cwd: payload.cwd,
        command: getToolCommand(payload),
        rawPrompt: JSON.stringify(payload.tool_input, null, 2)
      },
      timeoutSec: 120
    };

    console.error(`[Hook] Requesting permission: ${request.summary}`);

    // Send request to Broker
    const decision = await requestPermission(request);

    if (decision === 'allow') {
      console.error('[Hook] Permission granted, allowing execution');
      process.exit(0);
    } else {
      console.error('[Hook] Permission denied, blocking execution');
      const output = {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: 'User denied this operation'
        }
      };
      console.log(JSON.stringify(output));
      process.exit(0);
    }

  } catch (err) {
    console.error('[Hook] Error:', err.message);
    // Fail closed (deny on error)
    const output = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `Hook error: ${err.message}`
      }
    };
    console.log(JSON.stringify(output));
    process.exit(0);
  }
});

function getToolSummary(payload) {
  if (payload.tool_name === 'Bash') {
    return payload.tool_input.description || payload.tool_input.command;
  }
  if (payload.tool_name === 'Edit') {
    return `Edit ${payload.tool_input.file_path}`;
  }
  if (payload.tool_name === 'Write') {
    return `Write ${payload.tool_input.file_path}`;
  }
  if (payload.tool_name === 'NotebookEdit') {
    return `Edit notebook ${payload.tool_input.notebook_path}`;
  }
  return JSON.stringify(payload.tool_input);
}

function getToolCommand(payload) {
  if (payload.tool_name === 'Bash') {
    return payload.tool_input.command;
  }
  if (payload.tool_name === 'Edit') {
    return `Edit: ${payload.tool_input.file_path}`;
  }
  if (payload.tool_name === 'Write') {
    return `Write: ${payload.tool_input.file_path}`;
  }
  if (payload.tool_name === 'NotebookEdit') {
    return `NotebookEdit: ${payload.tool_input.notebook_path}`;
  }
  return `${payload.tool_name}(${JSON.stringify(payload.tool_input)})`;
}

function requestPermission(request) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BROKER_URL}/v1/requests`);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const postData = JSON.stringify(request);

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${BROKER_TOKEN}`
      },
      timeout: TIMEOUT_MS
    };

    const req = client.request(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => { data += chunk; });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const response = JSON.parse(data);
            resolve(response.decision); // 'allow' or 'deny'
          } catch (err) {
            reject(new Error(`Invalid response: ${data}`));
          }
        } else if (res.statusCode === 401) {
          reject(new Error('Authentication failed: Invalid GATE_BROKER_TOKEN'));
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
