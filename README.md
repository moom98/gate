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
│  Broker (3033)  │ ◄─────────────────► │  Web UI (3001)  │
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

#### Terminal 2: Start Web UI
```bash
cd apps/web-ui
pnpm dev
```
The web UI will be available at `http://localhost:3001`.

**First-time setup:**

1. Open `http://localhost:3001`
2. You'll be redirected to `/pair` page
3. Enter the 6-digit code from the broker console
4. Click "Pair Device"
5. You'll be redirected to the main dashboard

The authentication token is stored in localStorage, so you won't need to pair again unless you clear browser data or logout.

### 4. Configure Claude Code Hooks

**Getting your authentication token:**

1. After pairing Web UI (step 3), open browser DevTools (F12)
2. Go to Application > localStorage
3. Copy the value of `token`

**Setup hooks:**

1. Copy the template:

   ```bash
   cp .claude/settings.json.example .claude/settings.json
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
                 "GATE_BROKER_URL": "http://localhost:3033",
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

# Adapter
cd apps/adapter-claude
pnpm dev               # Start with tsx watch
pnpm build             # Build TypeScript
pnpm typecheck         # Type-check only

# Web UI
cd apps/web-ui
pnpm dev               # Start Next.js dev server (port 3001)
pnpm build             # Build production bundle
pnpm lint              # ESLint
pnpm typecheck         # TypeScript check
```

## Project Structure

```
gate/
├── apps/
│   ├── broker/              # HTTP + WebSocket server
│   │   ├── src/
│   │   │   └── index.ts     # Entry point (placeholder)
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── adapter-claude/      # PTY wrapper for Claude CLI
│   │   ├── src/
│   │   │   └── index.ts     # Entry point (placeholder)
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── web-ui/              # Next.js dashboard
│   │   ├── src/
│   │   │   ├── app/         # App Router pages
│   │   │   ├── components/  # React components
│   │   │   └── lib/         # Utilities
│   │   ├── package.json
│   │   └── next.config.js
│   └── ios-client/          # SwiftUI iOS app (planned)
│       └── README.md
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
5. ✅ **Step 5**: Implement pattern detection and y/n injection in adapter
6. ✅ **Step 6**: Connect Web UI to broker via WebSocket
7. ✅ **Step 7**: Add token-based authentication

🚧 **In Progress:**

- **Step 8**: Build minimal iOS client (SwiftUI scaffolding available, Xcode project setup required)

## Configuration

Configuration will be handled via environment variables:

**Broker** (`apps/broker/.env`):
- `PORT` - HTTP server port (default: 3000)
- `WS_PATH` - WebSocket endpoint path (default: /ws)

**Adapter** (`apps/adapter-claude/.env`):
- `BROKER_URL` - Broker HTTP URL (default: http://localhost:3000)
- `BROKER_TOKEN` - Authentication token (required after step 7)
- `CLAUDE_COMMAND` - Claude CLI command (default: claude)

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
- Store tokens in environment variables (adapter) or localStorage (web-ui)
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
- `feat/020-adapter-pty` - PTY manager
- `feat/030-broker-ws` - WebSocket integration
- `feat/040-adapter-detect-inject` - Pattern detection and injection
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
