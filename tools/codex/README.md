# Codex CLI Integration

This directory contains scripts for integrating Gate with Codex CLI.

## Setup

### 1. Install Codex CLI

Follow Codex CLI installation instructions (requires Claude Code access).

### 2. Configure Environment Variables

Edit `~/.codex/config.toml` (create if it doesn't exist):

```toml
[env]
GATE_BROKER_URL = "http://localhost:3000"
GATE_BROKER_TOKEN = "your-token-here"
```

**Getting your token:**
1. Start Gate Broker and pair with Web UI
2. Open Web UI DevTools → Application → localStorage
3. Copy the `token` value

### 3. Configure Codex Notification Hook

Edit `~/.codex/config.toml` to add notification handler:

```toml
[hooks.agent-turn-complete]
command = "/absolute/path/to/gate/tools/codex/codex-notify.js"
```

Replace `/absolute/path/to/gate/` with your actual Gate installation path.

**Example full configuration:**

```toml
[env]
GATE_BROKER_URL = "http://localhost:3000"
GATE_BROKER_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

[hooks.agent-turn-complete]
command = "/Users/yourname/projects/gate/tools/codex/codex-notify.js"
```

### 4. Make Script Executable

```bash
chmod +x /absolute/path/to/gate/tools/codex/codex-notify.js
```

### 5. Test

```bash
# Test the script manually
export GATE_BROKER_URL="http://localhost:3000"
export GATE_BROKER_TOKEN="your-token-here"

node tools/codex/codex-notify.js '{"threadId":"test-123","cwd":"/tmp","message":"Test notification"}'

# Check Gate Broker logs for event receipt
```

## How It Works

1. Codex CLI completes an agent turn
2. Codex calls the configured notification hook with JSON payload
3. `codex-notify.js` parses the payload and POSTs to Gate Broker
4. Broker broadcasts to Web UI and iOS clients
5. You receive a notification with turn summary

## Troubleshooting

**Script not being called:**
- Check Codex CLI configuration: `cat ~/.codex/config.toml`
- Verify script path is absolute
- Check script is executable: `ls -la tools/codex/codex-notify.js`

**401 Unauthorized:**
- Verify GATE_BROKER_TOKEN is set correctly
- Token may have expired - re-pair Web UI to get new token

**Notifications not appearing:**
- Check Broker logs for event receipt
- Verify WebSocket connection in Web UI
- Check browser console for errors

**Script errors:**
- Check Codex CLI logs for error output
- Test script manually with sample payload
- Verify Node.js is in PATH

## Payload Format

Codex CLI sends JSON payloads like:

```json
{
  "threadId": "abc123def456",
  "cwd": "/Users/username/project",
  "message": "Completed data analysis"
}
```

The script transforms this into Gate's event format, adds the original payload under `raw`, and sends it to `/v1/codex-events`.

## Security Notes

- The script always exits with code 0 to avoid blocking Codex CLI
- Messages are truncated to 500 characters server-side (client-side fallback matches this limit)
- Tokens should never be committed to version control
- Store tokens in `~/.codex/config.toml` (not tracked by git)
