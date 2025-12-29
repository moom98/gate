#!/usr/bin/env node

// Read stdin
let inputData = '';
process.stdin.on('data', (chunk) => { inputData += chunk; });

process.stdin.on('end', () => {
  try {
    const payload = JSON.parse(inputData);

    console.error(`[Hook] Tool: ${payload.tool_name}`);
    console.error(`[Hook] CWD: ${payload.cwd}`);
    console.error(`[Hook] Input: ${JSON.stringify(payload.tool_input)}`);

    // Spike: Block all Bash commands for testing
    if (payload.tool_name === 'Bash') {
      const output = {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: 'Spike test: blocking all Bash commands'
        }
      };
      console.log(JSON.stringify(output));
      process.exit(0);
    }

    // Allow other tools
    process.exit(0);

  } catch (err) {
    console.error('[Hook] Error parsing stdin:', err);
    process.exit(1);
  }
});
