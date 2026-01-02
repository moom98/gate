# Gate

English | **[日本語](README.ja.md)**

Claude Code Permission Gateway - Remotely manage command execution permission requests from Claude Code CLI.

## Overview

Gate intercepts permission prompts from the Claude Code CLI and allows you to approve or deny commands remotely from a Web UI or iOS app on the same Wi-Fi network.

**Use Case:** When Claude Code asks "Allow command execution? (y/n)", instead of responding at the terminal, you can review and approve the request from your phone or another browser window.

## Architecture

```
┌─────────────────┐
│  Claude Code    │
│  (with Hooks)   │
└────────┬────────┘
         │ PreToolUse event
         ▼
┌─────────────────┐
│  Hook Script    │
│  (.claude/hooks)│
└────────┬────────┘
         │ HTTP POST /v1/requests
         ▼
┌─────────────────┐      WebSocket      ┌─────────────────┐
│  Broker (3000)  │ ◄─────────────────► │  Web UI (3001)  │
└─────────────────┘                     └─────────────────┘
         ▲
         │ POST /v1/decisions
         │
    ┌────┴────┐
    │  User   │
    │ (allow/ │
    │  deny)  │
    └─────────┘
```

**Note:** No adapter needed! Hooks integrate directly with Claude CLI.

## Technology Stack

- **Package Manager**: pnpm
- **Runtime**: Node.js 20 LTS
- **Language**: TypeScript
- **Broker**: HTTP + WebSocket server
- **Hook Integration**: Claude Code PreToolUse hooks (Node.js script)
- **Web UI**: Next.js (App Router) + shadcn/ui + Tailwind CSS
- **iOS Client**: SwiftUI + URLSessionWebSocketTask
- **CI/CD**: GitHub Actions

## Prerequisites

- Node.js 20 LTS (see `.nvmrc`)
- pnpm 8.x or later
- Git

## Quick Start

### 1. Install Dependencies

```bash
# Enable corepack (if not already enabled)
corepack enable

# Install all dependencies
pnpm install
```

### 2. Build All Packages

```bash
pnpm -r build
```

### 3. Run the System

#### Terminal 1: Start Broker
```bash
cd apps/broker
pnpm dev
```
The broker will start on `http://localhost:3000` and display a 6-digit pairing code.

**Example output:**

```text
[Broker] Server running on http://localhost:3000
[Broker] Health check: http://localhost:3000/health
[Broker] WebSocket endpoint: ws://localhost:3000/ws

┌─────────────────────────────────────────┐
│         PAIRING CODE                    │
│                                         │
│         123456                          │
│                                         │
│  Use this code to pair clients          │
│  Expires in 5 minutes                   │
└─────────────────────────────────────────┘
```

#### Terminal 2: Start Desktop UI (Electron)
```bash
cd apps/web-ui
pnpm electron:dev
```
This command spins up the Next.js dev server in the background and opens the Electron shell once the UI is ready. The authentication flow happens entirely inside the Electron window (you'll still be redirected to `/pair` the first time). Tokens remain stored in the window's localStorage, so future launches remember the pairing unless you log out.

Desktop notifications fired from the Electron app include Allow/Deny buttons on macOS, so you can approve requests without returning to the window. Windows/Linux currently fall back to the standard notification behavior (no inline buttons), so you may still need to return to the Gate window on those platforms.

To build a standalone desktop app:

```bash
cd apps/web-ui
pnpm electron:build
```
This runs `next build` (configured for static export) and then packages the generated `out` directory with Electron via `electron-builder` (on macOS, make sure the Xcode command-line tools are installed).

### 4. Configure Claude Code Hooks

**Getting your authentication token:**

1. After pairing (step 3), open the Electron window's DevTools (⌥⌘I or View → Toggle Developer Tools)
2. Go to Application > localStorage
3. Copy the value of `token`

**Setup hooks:**

1. Copy the template and make the hook script executable:

   ```bash
   cp .claude/settings.json.example .claude/settings.json
   chmod +x .claude/hooks/pretooluse-gate.js
   ```

2. Edit `.claude/settings.json`:
   - Replace `/absolute/path/to/gate/` with the actual path to your Gate project
   - Replace `{{REPLACE_WITH_YOUR_TOKEN}}` with the token from localStorage

   Example:

   ```json
   {
     "hooks": {
       "PreToolUse": [
         {
           "matcher": "Bash",
           "hooks": [
             {
               "type": "command",
               "command": "/Users/yourname/gate/.claude/hooks/pretooluse-gate.js",
               "timeout": 65000,
               "env": {
                 "GATE_BROKER_URL": "http://localhost:3000",
                 "GATE_BROKER_TOKEN": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
               }
             }
           ]
         }
       ]
     }
   }
   ```

3. The hook script will now intercept Bash, Edit, Write, and NotebookEdit tools
4. All other tools (Read, Grep, etc.) will execute without approval

**Managing Local Token Configuration:**

To prevent accidentally committing your authentication token to version control:

```bash
# Tell git to ignore local changes to settings.json
git update-index --skip-worktree .claude/settings.json
```

This allows you to keep your real token in `settings.json` locally while the repository retains placeholder values.

**Note:** If you need to update the settings.json template in the repository:

```bash
# Temporarily allow tracking settings.json changes
git update-index --no-skip-worktree .claude/settings.json

# Make your changes to the template
# (remember to replace real tokens with {{REPLACE_WITH_YOUR_TOKEN}})

# Commit the template changes
git add .claude/settings.json
git commit -m "docs: update settings.json template"

# Re-enable skip-worktree
git update-index --skip-worktree .claude/settings.json

# Restore your local token
# (edit .claude/settings.json to add your token back)
```

**How to Use:**

1. Start Claude CLI in any project directory:

   ```bash
   claude
   ```

2. When Claude tries to execute an intercepted tool (Bash, Edit, Write, NotebookEdit):
   - The hook sends a permission request to the Broker
   - You'll see a notification in Web UI or iOS app
   - Approve or deny the request
   - Claude receives the decision and proceeds accordingly

3. Non-intercepted tools (Read, Grep, Glob, etc.) execute immediately without approval

**Note:** No adapter needed! Hooks integrate directly with Claude CLI.

## iOS Notifications

The iOS app supports local notifications to alert you when permission requests arrive, even when the app is in the foreground.

### Setup Notifications

1. **Enable Notifications**
   - Open the iOS app
   - Tap the menu (⋯) in the top right
   - Select "Notification Settings"
   - Tap "Enable Notifications"
   - Grant permission when prompted

2. **Test Notifications**
   - In the app menu, select "Test Notification"
   - You should see a banner notification appear, even with the app open
   - The notification will also appear in the Notification Center

3. **Permission Request Notifications**
   - When Claude Code requests permission, you'll automatically receive a notification
   - The notification shows the command being requested
   - **Quick Actions**: Swipe or long-press the notification to see Allow/Deny buttons
   - Tap "Allow" or "Deny" directly from the notification without opening the app
   - Alternatively, tap the notification to open the app and view full details

### Troubleshooting

**Notifications not appearing:**
- Check that notifications are enabled in Settings > Gate > Notifications
- Ensure the app is paired with the broker
- Try sending a test notification from the app menu

**Notifications disabled:**
- Go to Notification Settings in the app
- Tap "Open Settings" to go to system settings
- Enable all notification options (Banners, Sounds, Badges)

**Important Notes:**
- Notifications work best when the app is in the foreground
- Background notification delivery is not currently supported
- The app must be connected to the broker to receive permission requests

## Claude Idle Notifications

Gate can automatically notify you when Claude Code enters idle state (waiting for user input). This uses Claude Code's Notification hook with the `idle_prompt` event.

### How It Works

1. When Claude Code has been idle for 60+ seconds waiting for user input, the `idle_prompt` event is triggered
2. The hook script (`notification-idle-prompt.js`) sends the event to the Broker via `/v1/claude-events`
3. The Broker broadcasts the event to all connected clients (Web UI and iOS)
4. You receive a notification saying "Claude is Ready - Waiting for your input"
5. If the Broker is unavailable, the hook falls back to macOS desktop notification

### Setup

The idle notification hook is already configured in `.claude/settings.json`:

```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": "idle_prompt",
        "hooks": [
          {
            "type": "command",
            "command": "/absolute/path/to/gate/.claude/hooks/notification-idle-prompt.js",
            "timeout": 10000,
            "env": {
              "GATE_BROKER_URL": "http://localhost:3000",
              "GATE_BROKER_TOKEN": "{{REPLACE_WITH_YOUR_TOKEN}}"
            }
          }
        ]
      }
    ]
  }
}
```

**Configuration steps:**

1. Update the `command` path to match your Gate installation directory
2. Replace `{{REPLACE_WITH_YOUR_TOKEN}}` with your authentication token (same as PreToolUse hooks)
3. Make sure the hook script is executable: `chmod +x .claude/hooks/notification-idle-prompt.js`

### Verification

To test if the idle notification is working:

1. Start the Broker and connect a client (Web UI or iOS)
2. Start Claude Code in a terminal: `claude`
3. Let Claude complete a task and wait for user input
4. After 60+ seconds of inactivity, you should receive a "Claude is Ready" notification

**Checking logs:**

```bash
# Check if the hook script is being called
tail -f ~/.claude/logs/*.log | grep "NotificationHook"

# Check Broker logs for event receipt
# (in apps/broker terminal output)
# Look for: "[Broker] Received Claude event: idle_prompt"
```

### Troubleshooting

**Notifications not appearing:**
- Verify the hook script path in `.claude/settings.json` is correct
- Check that `GATE_BROKER_TOKEN` is set correctly
- Ensure the Broker is running and accessible
- Check Claude Code logs for hook execution errors

**idle_prompt not triggering:**
- The event requires 60+ seconds of continuous idle time
- Some Claude Code versions may not support `idle_prompt` - check your version with `claude --version`
- Try the Test Notification feature in the iOS app or Web UI to verify notification delivery works

**Fallback notification (macOS only):**
- If the Broker is unreachable, the hook will attempt to show a macOS desktop notification
- Requires either `terminal-notifier` (Homebrew) or uses built-in `osascript`
- To install terminal-notifier: `brew install terminal-notifier`

### Known Limitations

1. **60-second delay**: The `idle_prompt` event only triggers after 60+ seconds of inactivity. There's no way to reduce this delay as it's a Claude Code limitation.

2. **Environment-specific behavior**: Some Claude Code environments or versions may not fire `idle_prompt` reliably. This is a known limitation of the Claude Code Hooks system.

3. **No active task detection**: The notification will fire even if Claude is waiting for external events (like a running server). It only detects user input idle state.

4. **Fallback notification (macOS only)**: Desktop notifications via `osascript` or `terminal-notifier` only work on macOS.

## Codex CLI Integration

Gate can receive and display notifications when Codex CLI agent turns complete. This provides real-time visibility into your Codex workflows.

### How It Works

1. Codex CLI completes an agent turn
2. Codex calls the configured notification hook with turn details
3. The `codex-notify.js` script sends the event to Gate Broker
4. Broker broadcasts the event to all connected clients (Web UI and iOS)
5. You receive a notification with thread ID, working directory, and message summary
6. Recent Codex events are displayed in the "Codex Activity" card in the Web UI

### Setup

#### Prerequisites

- Codex CLI installed and configured
- Gate Broker running
- Gate Web UI paired

#### 1. Get Your Authentication Token

After pairing with the Broker:

1. Open Web UI DevTools (⌥⌘I or View → Toggle Developer Tools)
2. Go to Application → localStorage
3. Copy the `token` value

#### 2. Configure Codex Environment

Edit `~/.codex/config.toml` (create if it doesn't exist):

```toml
[env]
GATE_BROKER_URL = "http://localhost:3000"
GATE_BROKER_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

Replace the token value with your actual token from step 1.

#### 3. Configure Codex Notification Hook

Add the notification hook to `~/.codex/config.toml`:

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

#### 4. Make Script Executable

```bash
chmod +x /absolute/path/to/gate/tools/codex/codex-notify.js
```

#### 5. Verify Setup

Test the integration manually:

```bash
# Set environment variables
export GATE_BROKER_URL="http://localhost:3000"
export GATE_BROKER_TOKEN="your-token-here"

# Run the script with test payload
node tools/codex/codex-notify.js '{
  "threadId": "test-123",
  "cwd": "/tmp",
  "message": "Test notification"
}'

# Check Gate Broker logs for:
# [Broker] Received Codex event: { type: 'agent-turn-complete', threadId: 'test-123', ... }

# Check Web UI for "Codex Activity" card
```

### Usage

Once configured, Codex events will automatically appear in Gate:

1. **Web UI**: Look for the purple "Codex Activity" card showing recent agent turns
2. **Notifications**: Browser/desktop notifications appear when new turns complete
3. **Event Details**: Click the expand arrow to see full thread ID, directory, and timestamp
4. **Dismissal**: Click the X button to remove individual events from the list

### Deduplication

Gate automatically deduplicates Codex events:
- Same `threadId` within 5 seconds is ignored (prevents spam)
- Only the last 10 events are kept in memory
- Events are dismissed when you close them in the UI

### Security Considerations

**Message Truncation**: Event messages are automatically truncated to 500 characters to prevent payload abuse.

**Token Storage**:
- Store your `GATE_BROKER_TOKEN` in `~/.codex/config.toml` (never commit to git)
- Add `~/.codex/config.toml` to your global `.gitignore` if needed
- Tokens can be regenerated by re-pairing the Web UI

### Troubleshooting

**Script not being called:**
- Verify Codex CLI configuration: `cat ~/.codex/config.toml`
- Ensure script path is absolute (not relative)
- Check script is executable: `ls -la /path/to/gate/tools/codex/codex-notify.js`
- Check Codex CLI version supports `agent-turn-complete` hook

**401 Unauthorized errors:**
- Verify `GATE_BROKER_TOKEN` is set correctly in `~/.codex/config.toml`
- Token may have expired - re-pair Web UI to get a new token
- Check token has no extra whitespace or quotes

**Events not appearing in Web UI:**
- Check Broker logs for event receipt
- Verify WebSocket connection status (green "Connected" indicator)
- Check browser console for WebSocket errors
- Try sending a test event manually (see Verify Setup above)

**Duplicate notifications:**
- Deduplication is active for 5 seconds - this is expected behavior
- If duplicates persist, check for multiple Codex processes
- Verify only one notification hook is configured

### Known Limitations

1. **Hook Availability**: The `agent-turn-complete` hook availability depends on your Codex CLI version
2. **Graceful Failure**: The script always exits with code 0 to avoid blocking Codex CLI
3. **Network Dependency**: Requires Broker to be accessible; falls back silently if offline
4. **Event Retention**: Only last 10 events are kept in memory (oldest are removed automatically)

## Development Commands

**Root-level:**
```bash
pnpm install           # Install dependencies
pnpm -r build          # Build all packages
pnpm -r lint           # Lint all packages
pnpm -r typecheck      # Type-check all packages
pnpm -r test           # Run tests (when available)
pnpm dev               # Start all services in dev mode
pnpm clean             # Clean build artifacts
```

**Per-package:**
```bash
# Broker
cd apps/broker
pnpm dev               # Start with tsx watch
pnpm build             # Build TypeScript
pnpm typecheck         # Type-check only

# Web UI
cd apps/web-ui
pnpm dev               # Start Next.js dev server (port 3001)
pnpm build             # Build production bundle (static export)
pnpm lint              # ESLint
pnpm typecheck         # TypeScript check
pnpm electron:dev      # Launch Electron shell (runs dev server + Electron)
pnpm electron:build    # Build distributable desktop app
```

## Project Structure

```
gate/
├── apps/
│   ├── broker/              # HTTP + WebSocket server
│   │   ├── src/
│   │   │   └── index.ts     # Entry point
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── web-ui/              # Next.js dashboard
│   │   ├── src/
│   │   │   ├── app/         # App Router pages
│   │   │   ├── components/  # React components
│   │   │   └── lib/         # Utilities
│   │   ├── electron/        # Electron main process files
│   │   ├── package.json
│   │   └── next.config.js
│   ├── ios-client/          # SwiftUI iOS app (planned)
│   │   └── README.md
├── .claude/
│   ├── hooks/
│   │   ├── pretooluse-gate.js        # Claude Code PreToolUse hook
│   │   └── notification-idle-prompt.js  # Claude Code Notification hook (idle_prompt)
│   └── settings.json.example   # Hook configuration template
├── .github/
│   └── workflows/
│       └── ci.yml           # GitHub Actions CI
├── package.json             # Root package
├── pnpm-workspace.yaml      # Workspace config
├── tsconfig.json            # Base TypeScript config
├── .nvmrc                   # Node version (20.18.1)
├── .gitignore
├── AGENTS.md                # Developer documentation
└── README.md                # This file
```

## Implementation Status

✅ **Completed Steps:**

1. ✅ **Step 1**: Bootstrap project structure
2. ✅ **Step 2**: Implement broker skeleton with basic HTTP endpoints
3. ✅ **Step 3**: Add PTY wrapper to spawn Claude CLI
4. ✅ **Step 4**: Add WebSocket support to broker
5. ✅ **Step 5**: Connect Web UI to broker via WebSocket
6. ✅ **Step 6**: Add token-based authentication

🚧 **In Progress:**

- **Step 7**: Build minimal iOS client (SwiftUI scaffolding available, Xcode project setup required)

## Configuration

Configuration will be handled via environment variables:

**Broker** (`apps/broker/.env`):
- `PORT` - HTTP server port (default: 3000)
- `WS_PATH` - WebSocket endpoint path (default: /ws)

**Web UI** (`apps/web-ui/.env.local`):
- `NEXT_PUBLIC_BROKER_URL` - Broker HTTP URL
- `NEXT_PUBLIC_WS_URL` - Broker WebSocket URL

## CI/CD

GitHub Actions runs on every push and pull request:

- Lint all packages
- Type-check all packages
- Run tests (when available)
- Build all packages (including Next.js production build)

CI uses:
- Runner: `ubuntu-latest`
- Node.js: 20 LTS (from `.nvmrc`)
- Package manager: pnpm (via `corepack enable`)
- Cache: pnpm store

## Security

**Current Implementation:**

- ✅ JWT token-based authentication
- ✅ 6-digit pairing code flow (5-minute expiry, single-use)
- ✅ Bearer token required for all mutation endpoints
- ✅ WebSocket authentication via query parameter
- ✅ Production mode: auto-generated codes disabled
- ✅ Sanitized error logging (no token/secret exposure)

**Security Best Practices:**

- Run broker on localhost or trusted LAN only
- Store tokens in environment variables (hooks/desktop scripts) or localStorage (desktop UI)
- Never commit `.env` files or tokens to version control
- Monitor broker logs for suspicious activity
- Regenerate pairing codes regularly in production

**Planned Enhancements (Post-MVP):**

- HTTPS/WSS support with Let's Encrypt
- Rate limiting on pairing endpoint
- Token rotation and refresh mechanism
- Audit logging for all permission decisions

See [AGENTS.md](AGENTS.md#5-security-considerations) for detailed security documentation.

## Contributing

1. Create a feature branch following the pattern `feat/NNN-description`
2. Make changes
3. Run checks locally:
   ```bash
   pnpm -r lint
   pnpm -r typecheck
   pnpm -r build
   ```
4. Commit with a meaningful message
5. Push and create a PR
6. Wait for CI to pass before merging

## Branch Strategy

Each major feature is developed in its own branch:
- `feat/000-bootstrap` - Initial project setup (current)
- `feat/010-broker-skeleton` - HTTP API endpoints
- `feat/030-broker-ws` - WebSocket integration
- `feat/050-web-ui-integrate` - Web UI integration
- `feat/060-token-pairing` - Authentication
- `feat/070-ios-minimal` - iOS client

## License

MIT

## Automation

### Copilot Review Auto-Handler

Gate includes GitHub Actions automation that automatically handles Copilot code reviews:

**What it does:**
1. Detects when GitHub Copilot posts a review comment on a PR
2. Automatically runs Claude Code to fix the issues
3. Commits and pushes the fixes
4. Posts a summary comment on the PR

**Setup:**

Add one of the following secrets to your repository:

```bash
# Option 1 (Recommended): Claude Code OAuth Token
# 1. Get the access_token from your local auth file:
cat ~/.config/claude-code/auth.json
# Example output: {"access_token":"sk-ant-api03-ABC123...","refresh_token":"..."}

# 2. Copy ONLY the access_token value (the part after "access_token":")
# For example, from the above output, copy: sk-ant-api03-ABC123...

# 3. Add to GitHub:
# Settings > Secrets and variables > Actions > New repository secret
# Name: CLAUDE_CODE_OAUTH_TOKEN
# Value: sk-ant-api03-ABC123... (paste ONLY the access_token value, not the entire JSON)

# Option 2 (Alternative): Anthropic API Key
# Name: ANTHROPIC_API_KEY
# Value: <your API key from https://console.anthropic.com/>
```

**Safety features:**
- Maximum 2 auto-fixes per PR (prevents infinite loops)
- Marker-based duplicate detection (`[claude-copilot-handled]`)
- Concurrent execution prevention

For detailed documentation, see [docs/automation.md](docs/automation.md).

## Support

For issues and feature requests, please use the GitHub issue tracker.
