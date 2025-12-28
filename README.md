# Gate

Claude Code Permission Gateway - Remotely manage command execution permission requests from Claude Code CLI.

## Overview

Gate intercepts permission prompts from the Claude Code CLI and allows you to approve or deny commands remotely from a Web UI or iOS app on the same Wi-Fi network.

**Use Case:** When Claude Code asks "Allow command execution? (y/n)", instead of responding at the terminal, you can review and approve the request from your phone or another browser window.

## Architecture

```
┌─────────────────┐
│  Claude Code    │
│      CLI        │
└────────┬────────┘
         │ (PTY)
         ▼
┌─────────────────┐      HTTP/WS      ┌─────────────────┐
│  Adapter        ├──────────────────►│     Broker      │
│  (node-pty)     │◄──────────────────┤  (HTTP + WS)    │
└─────────────────┘                   └────────┬────────┘
                                               │
                                ┌──────────────┴───────────────┐
                                │                              │
                                ▼                              ▼
                        ┌───────────────┐            ┌────────────────┐
                        │   Web UI      │            │   iOS App      │
                        │  (Next.js)    │            │  (SwiftUI)     │
                        └───────────────┘            └────────────────┘
```

## Technology Stack

- **Package Manager**: pnpm
- **Runtime**: Node.js 20 LTS
- **Language**: TypeScript
- **Broker**: HTTP + WebSocket server
- **Adapter**: node-pty (PTY wrapper)
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
The broker will start on `http://localhost:3000` and display a pairing code (to be implemented in later steps).

#### Terminal 2: Start Web UI
```bash
cd apps/web-ui
pnpm dev
```
The web UI will be available at `http://localhost:3001`.

#### Terminal 3: Start Adapter
```bash
cd apps/adapter-claude
pnpm dev
```
The adapter will spawn the Claude Code CLI and monitor for permission prompts.

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

## Demo Procedure (Planned for Future Steps)

This section will be updated as features are implemented:

1. **Step 1 (Current)**: Bootstrap project structure
2. **Step 2**: Implement broker skeleton with basic HTTP endpoints
3. **Step 3**: Add PTY wrapper to spawn Claude CLI
4. **Step 4**: Add WebSocket support to broker
5. **Step 5**: Implement pattern detection and y/n injection in adapter
6. **Step 6**: Connect Web UI to broker via WebSocket
7. **Step 7**: Add token-based authentication
8. **Step 8**: Build minimal iOS client

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

**Current Status (Step 1 - Bootstrap):**
- No authentication implemented yet
- LAN-only deployment recommended

**Planned Security Features:**
- Token-based authentication (Step 7)
- Pairing code flow for initial setup
- Bearer token required for sensitive endpoints
- HTTPS/WSS support (post-MVP)

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
# 1. Get the token from your local auth file:
cat ~/.config/claude-code/auth.json
# Example output: {"access_token":"sk-ant-api03-...","refresh_token":"..."}
# Copy the entire JSON object as the secret value

# 2. Add to GitHub:
# Settings > Secrets and variables > Actions > New repository secret
# Name: CLAUDE_CODE_OAUTH_TOKEN
# Value: <paste the entire JSON object from step 1>

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
