# AGENTS.md

## 1. Project Overview

Gate is a permission gateway system that intercepts Claude Code CLI command execution prompts and enables remote approval/denial via Web UI or iOS app.

**Architecture:**
- **Broker**: HTTP + WebSocket server managing permission requests and decisions
- **Adapter**: PTY wrapper spawning `claude` CLI, detecting prompts, injecting y/n responses
- **Web UI**: Next.js + shadcn/ui dashboard for real-time request management
- **iOS Client**: SwiftUI app for mobile approval (foreground only)

**Technology Stack:**
- Package Manager: pnpm (monorepo with workspaces)
- Runtime: Node.js 20 LTS
- Language: TypeScript
- CI/CD: GitHub Actions (ubuntu-latest)

## 2. Build & Test Commands

**Root-level commands:**
```bash
# Install all dependencies
pnpm install

# Build all packages
pnpm -r build

# Run linting across all packages
pnpm -r lint

# Type-check all packages
pnpm -r typecheck

# Run tests (if available)
pnpm -r test

# Start all services in dev mode
pnpm dev

# Clean build artifacts
pnpm -r clean
```

**Per-package commands:**
```bash
# Broker (apps/broker)
cd apps/broker
pnpm dev          # Start dev server
pnpm build        # Build TypeScript
pnpm typecheck    # Type-check without emitting

# Adapter (apps/adapter-claude)
cd apps/adapter-claude
pnpm dev          # Start with tsx watch
pnpm build        # Build TypeScript
pnpm typecheck    # Type-check without emitting

# Web UI (apps/web-ui)
cd apps/web-ui
pnpm dev          # Start Next.js dev server on port 3001
pnpm build        # Build production Next.js app
pnpm lint         # ESLint
pnpm typecheck    # TypeScript check
```

## 3. Coding Style Guidelines

**General:**
- Use TypeScript strict mode
- Prefer explicit types over inference for public APIs
- Use async/await over raw promises
- Follow ESLint and Prettier configurations

**Naming Conventions:**
- Files: kebab-case (`pty-manager.ts`, `broker-client.ts`)
- Components (React): PascalCase (`PermissionRequestCard.tsx`)
- Functions/variables: camelCase (`createPendingRequest`, `brokerUrl`)
- Constants: UPPER_SNAKE_CASE (`DEFAULT_TIMEOUT_SEC`)
- Types/Interfaces: PascalCase (`PermissionRequest`, `DecisionPayload`)

**Code Organization:**
- One component/class per file
- Group related functionality in subdirectories (`routes/`, `components/ui/`)
- Keep files under 300 lines when possible
- Export types alongside implementations

**React (Web UI):**
- Use functional components with hooks
- Prefer server components by default (Next.js App Router)
- Use `"use client"` directive only when necessary
- Follow shadcn/ui component patterns

**Error Handling:**
- Use typed errors where appropriate
- Log errors with context (request ID, user action, etc.)
- Fail gracefully with user-friendly messages
- Never expose sensitive information in error responses

## 4. Test Procedures

**Manual Testing:**

1. **Broker Health Check:**
   ```bash
   curl http://localhost:3000/health
   # Expected: 200 OK with JSON: {"status":"ok","timestamp":"...","version":"0.0.1"}
   ```

2. **Broker API Endpoints (Step 2):**
   ```bash
   # Test POST /v1/requests (currently returns deny)
   curl -X POST http://localhost:3000/v1/requests \
     -H "Content-Type: application/json" \
     -d '{
       "id": "test-123",
       "summary": "Test command",
       "details": {
         "cwd": "/tmp",
         "command": "ls -la",
         "rawPrompt": "Allow command execution? (y/n)"
       },
       "timeoutSec": 60
     }'
   # Expected: {"decision":"deny"}

   # Test POST /v1/decisions (currently just logs)
   curl -X POST http://localhost:3000/v1/decisions \
     -H "Content-Type: application/json" \
     -d '{
       "id": "test-123",
       "decision": "allow"
     }'
   # Expected: {"success":true}
   ```

3. **Adapter PTY Manager (Step 3):**
   ```bash
   # Test adapter spawning Claude CLI
   cd apps/adapter-claude
   # Configure environment (optional if 'claude' is in PATH; otherwise set CLAUDE_COMMAND)
   # export CLAUDE_COMMAND="echo"  # For testing without claude
   # export CLAUDE_COMMAND="cat"   # Alternative test command
   pnpm dev
   # Expected: Adapter spawns CLI and logs output
   # Verify: PTY output is visible
   # Verify: SIGINT (Ctrl+C) gracefully shuts down
   ```

4. **End-to-End Permission Flow:**
   - Start broker: `cd apps/broker && pnpm dev`
   - Start web-ui: `cd apps/web-ui && pnpm dev`
   - Start adapter: `cd apps/adapter-claude && pnpm dev`
   - Trigger Claude Code CLI permission prompt
   - Verify request appears in Web UI
   - Click "Allow" or "Deny"
   - Verify PTY receives `y` or `n` input

5. **WebSocket Connection:**
   ```bash
   # Using wscat or similar
   wscat -c ws://localhost:3000/ws
   # Expected: Connection established, receives permission_request messages
   ```

6. **Timeout Behavior:**
   - Send permission request
   - Wait 60+ seconds without decision
   - Verify automatic "deny" response

7. **First-Response-Wins:**
   - Send permission request
   - Submit decision from Web UI
   - Attempt second decision
   - Verify 409 Conflict response

**Automated Testing (Future):**
- Unit tests for detection regex patterns
- Integration tests for broker API endpoints
- E2E tests for full permission flow
- WebSocket connection/reconnection tests

**Pre-commit Checklist:**
- [ ] `pnpm -r lint` passes
- [ ] `pnpm -r typecheck` passes
- [ ] `pnpm -r build` succeeds
- [ ] Manual smoke test of changed functionality
- [ ] No sensitive data in logs or error messages

## 5. Security Considerations

**Current Implementation:**
- **Token-based Authentication**: JWT tokens required for `/v1/decisions` and WebSocket connections
- **Pairing Flow**: 6-digit pairing codes for initial trust establishment (short-lived, single-use)
- **LAN-Only Recommended**: Broker should run on localhost or LAN-only interface by default
- **No HTTPS (Yet)**: Current implementation uses HTTP/WS (not HTTPS/WSS)

**Security Best Practices:**
- Store broker tokens in environment variables (adapter) or localStorage (web-ui)
- Never commit `.env` files or tokens to version control
- Rotate tokens periodically (manual for MVP)
- Review broker logs for suspicious activity
- Limit broker network exposure (bind to `127.0.0.1` for local-only, or LAN IP with firewall)

**Threat Model:**
- **In Scope**: Preventing unauthorized command execution, securing LAN communications
- **Out of Scope (MVP)**: Protection against compromised LAN, MITM attacks on public networks
- **Assumptions**: Trusted LAN environment, physical device security

**Future Enhancements:**
- HTTPS/WSS with self-signed or Let's Encrypt certificates
- Client certificate authentication
- Rate limiting on API endpoints
- Audit logging for all permission decisions
- Token rotation and expiration handling
- mDNS auto-discovery with cryptographic verification

**Reporting Security Issues:**
- Do not open public GitHub issues for security vulnerabilities
- Contact maintainers directly (email TBD)
- Provide detailed reproduction steps and impact assessment
