# Gate Adapter for Claude CLI

**[English](README.md)** | 日本語


PTY wrapper that intercepts Claude Code CLI permission prompts and sends them to the Gate broker for remote approval.

## How It Works

```
User -> adapter-claude (this) -> claude CLI -> prompts -> broker -> Web UI/iOS
                                    ^                                   |
                                    |                                   |
                                    +--- y/n injection <----------------+
```

**IMPORTANT**: Do NOT run `claude` command directly. The adapter spawns Claude CLI internally and wraps it with a PTY.

## Prerequisites

1. Claude Code CLI installed (`claude` command available in PATH)
2. Gate broker running (`cd ../broker && pnpm dev`)
3. Web UI paired with broker (to get BROKER_TOKEN)

## Quick Start

### Automated Setup (Recommended)

Run the setup script from the repository root:

```bash
./scripts/setup-adapter.sh
```

This will:
- Build the adapter
- Check broker connectivity
- Update BROKER_URL to match broker's PORT
- Prompt for BROKER_TOKEN
- Update .env.local automatically

### Manual Setup

#### 1. Build the adapter

```bash
cd apps/adapter-claude
pnpm build
```

#### 2. Configure environment variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```bash
# Broker HTTP URL (must match broker's PORT)
BROKER_URL=http://localhost:3033

# Broker authentication token (REQUIRED after Step 7)
# Get this from Web UI after pairing
BROKER_TOKEN=your-token-from-web-ui

# Claude CLI command (default: claude)
CLAUDE_COMMAND=claude

# Working directory for Claude CLI (default: current directory)
# CLAUDE_CWD=/path/to/working/directory
```

#### 3. Get BROKER_TOKEN

1. Start broker: `cd ../broker && pnpm dev`
2. Note the pairing code displayed in broker console
3. Open Web UI: http://localhost:3001
4. Enter the pairing code
5. After pairing succeeds, open browser DevTools
6. Go to Application > localStorage
7. Copy the value of `token`
8. Paste into `.env.local` as `BROKER_TOKEN=...`

#### 4. Start the adapter

```bash
pnpm dev
```

The adapter will:
- Spawn `claude` CLI in a PTY
- Monitor output for permission prompts
- Send detected prompts to broker
- Wait for decision from Web UI/iOS
- Inject `y` or `n` into Claude CLI

## Usage

Once the adapter is running, all Claude Code permission prompts will be intercepted and sent to the broker. You can approve/deny them from:

- **Web UI**: http://localhost:3001
- **iOS app**: (if paired)

## Important Notes

### ⚠️ Do NOT Run Claude Directly

When the adapter is running, do **NOT** execute the `claude` command separately. The adapter has already spawned Claude CLI internally.

✅ **Correct usage**:
```bash
# Terminal 1: Start adapter
cd apps/adapter-claude
pnpm dev

# The adapter spawns Claude CLI
# Interact with Claude in this same terminal
```

❌ **Incorrect usage**:
```bash
# Terminal 1: Start adapter
cd apps/adapter-claude
pnpm dev

# Terminal 2: DON'T DO THIS
claude  # This creates a separate Claude instance NOT connected to adapter
```

### How to Interact with Claude

After starting the adapter with `pnpm dev`:

1. The adapter spawns Claude CLI automatically
2. You'll see: `[Adapter] Claude CLI spawned successfully (PID: XXXXX)`
3. The Claude CLI prompt appears in the **same terminal**
4. Type your requests to Claude as normal
5. When Claude needs permission, the adapter intercepts it and sends to broker
6. Approve/deny from Web UI or iOS app
7. The decision is automatically injected into Claude

## Troubleshooting

### Problem: No logs from adapter

**Symptoms**:
- No `[Adapter]` logs appear
- Claude doesn't seem to connect to broker

**Possible Causes**:
1. Adapter not running
2. Running `claude` directly instead of through adapter
3. Environment variables not loaded

**Solution**:
1. Make sure adapter is running: `cd apps/adapter-claude && pnpm dev`
2. Check that you see `[Adapter] Starting Gate Adapter for Claude CLI`
3. Do NOT run `claude` command separately
4. Verify `.env.local` exists and has correct values

### Problem: "401 Unauthorized" errors

**Symptoms**:
- Adapter logs show authentication errors
- Requests to broker fail with 401

**Possible Causes**:
1. Missing `BROKER_TOKEN` in `.env.local`
2. Invalid or expired token
3. Token from different broker instance

**Solution**:
1. Check that broker is running
2. Pair Web UI with broker using pairing code
3. Get fresh token from browser localStorage
4. Update `BROKER_TOKEN` in `.env.local`
5. Restart adapter: `pnpm dev`

### Problem: "Connection refused" to broker

**Symptoms**:
- Cannot connect to broker
- `ECONNREFUSED` errors in logs

**Possible Causes**:
1. Broker not running
2. Wrong `BROKER_URL` in `.env.local`
3. Port number mismatch

**Solution**:
1. Start broker: `cd apps/broker && pnpm dev`
2. Check broker's PORT in `apps/broker/.env.local`
3. Update `BROKER_URL` in `apps/adapter-claude/.env.local` to match
4. Run setup script: `./scripts/setup-adapter.sh`
5. Restart adapter

### Problem: Permission prompts not detected

**Symptoms**:
- Claude shows permission prompts
- But they don't appear in Web UI
- No `[Adapter] Permission prompt detected` logs

**Possible Causes**:
1. Pattern regex doesn't match Claude Code output
2. ANSI color codes interfering with detection
3. Multi-line prompts not being captured

**Solution**:
1. Enable debug mode: `DEBUG_MODE=true pnpm dev`
2. Check logs for PTY output
3. Look for lines containing `(y/n)`
4. If pattern doesn't match, file an issue with sample output
5. Adjust patterns in `config.json` if needed

### Problem: Web UI not receiving notifications

**Symptoms**:
- Adapter detects prompt: `[Adapter] Permission prompt detected`
- Broker receives request
- But Web UI shows no notification

**Possible Causes**:
1. Web UI not connected to broker
2. WebSocket disconnected
3. Browser tab in background (notifications disabled)

**Solution**:
1. Check Web UI shows "Connected" (green)
2. Refresh Web UI page
3. Check browser console for WebSocket errors
4. Ensure Web UI used same pairing code as adapter's token

## Debug Mode

Enable detailed logging:

```bash
DEBUG_MODE=true pnpm dev
```

This will log:
- All PTY output from Claude CLI
- Pattern matching attempts
- Broker communication details
- Decision injection

## Development

```bash
# Start with auto-reload
pnpm dev

# Build TypeScript
pnpm build

# Type-check only
pnpm typecheck

# Clean build artifacts
pnpm clean
```

## Architecture

**Key files**:
- [src/index.ts](src/index.ts) - Entry point, initializes PTY manager
- [src/pty-manager.ts](src/pty-manager.ts) - Spawns Claude CLI, handles I/O
- [src/detection.ts](src/detection.ts) - Pattern matching for permission prompts
- [src/broker-client.ts](src/broker-client.ts) - HTTP client for broker communication
- [src/config.ts](src/config.ts) - Configuration loading

**Flow**:
1. index.ts loads config and creates PtyManager
2. PtyManager spawns `claude` command in PTY
3. PTY stdout is monitored by PatternDetector
4. When pattern matches, BrokerClient sends request to broker
5. Broker broadcasts to Web UI/iOS via WebSocket
6. User approves/denies from UI
7. Broker returns decision to adapter
8. Adapter injects `y\n` or `n\n` into PTY stdin
9. Claude CLI receives response and continues

## Example Session

```bash
$ cd apps/adapter-claude
$ pnpm dev

[Adapter] Starting Gate Adapter for Claude CLI
[Adapter] Configuration loaded:
  Broker URL: http://localhost:3033
  Claude Command: claude
  Working Directory: /Users/you/project
[Adapter] Spawning Claude CLI: claude
[Adapter] Claude CLI spawned successfully (PID: 12345)

# Claude CLI prompt appears
> What can I help you with?

# User types a request
> Read the README.md file

# Claude asks for permission
Allow command execution? (y/n)

[Adapter] Permission prompt detected: generic_permission
[BrokerClient] Sending permission request: abc-123-def
[BrokerClient] Received decision for abc-123-def: allow
[Adapter] Injecting decision: y

# Claude continues with approved action
Reading file: README.md
...
```

## License

MIT
