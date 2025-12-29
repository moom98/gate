# AGENTS.md

## 1. Project Overview

Gate is a permission gateway system that intercepts Claude Code CLI tool execution and enables remote approval/denial via Web UI or iOS app using Claude Code Hooks.

**Architecture:**
- **Claude Code Hooks**: PreToolUse hooks intercept tool execution before it runs (Bash, Edit, Write, NotebookEdit)
- **Hook Script**: Node.js script (`.claude/hooks/pretooluse-gate.js`) receives structured JSON, calls Broker API
- **Broker**: HTTP + WebSocket server managing permission requests and decisions
- **Web UI**: Next.js + shadcn/ui dashboard for real-time request management
- **iOS Client**: SwiftUI app for mobile approval (planned)

**Technology Stack:**
- Package Manager: pnpm (monorepo with workspaces)
- Runtime: Node.js 20 LTS
- Language: TypeScript (apps), JavaScript (hook script)
- CI/CD: GitHub Actions (ubuntu-latest)
- Authentication: JWT tokens via pairing flow

**Key Features:**
- No PTY adapter needed (Hooks integrate directly with Claude CLI)
- Structured JSON input (no pattern matching)
- Fail-closed security (deny on error)
- First-response-wins decision logic
- 60-second timeout with auto-deny
- WebSocket real-time notifications

## 2. Build & Test Commands

**Root-level commands:**
```bash
# Install all dependencies
pnpm install

# Build all packages (broker, web-ui only - adapter-claude-legacy excluded)
pnpm -r build

# Run linting across all packages
pnpm -r lint

# Type-check all packages
pnpm -r typecheck

# Run tests (if available)
pnpm -r test

# Clean build artifacts
pnpm clean
```

**Per-package commands:**
```bash
# Broker (apps/broker)
cd apps/broker
pnpm dev          # Start dev server (port 3000)
pnpm build        # Build TypeScript
pnpm typecheck    # Type-check without emitting

# Web UI (apps/web-ui)
cd apps/web-ui
pnpm dev          # Start Next.js dev server (port 3001)
pnpm build        # Build production Next.js app
pnpm lint         # ESLint
pnpm typecheck    # TypeScript check
```

**Hook setup:**
```bash
# Copy and configure hook settings
cp .claude/settings.json.example .claude/settings.json
chmod +x .claude/hooks/pretooluse-gate.js

# Edit .claude/settings.json with your token and path
# Get token from Web UI after pairing
```

## 3. Coding Style Guidelines

**General:**
- Use TypeScript strict mode
- Prefer explicit types over inference for public APIs
- Use async/await over raw promises
- Follow ESLint and Prettier configurations
- Fail-closed security: always deny on error

**Naming Conventions:**
- Files: kebab-case (`broker-client.ts`, `pretooluse-gate.js`)
- Components (React): PascalCase (`PermissionRequestCard.tsx`)
- Functions/variables: camelCase (`createPendingRequest`, `brokerUrl`)
- Constants: UPPER_SNAKE_CASE (`DEFAULT_TIMEOUT_SEC`, `BROKER_URL`)
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

**Hook Script (Node.js):**
- Use CommonJS (require/module.exports) for compatibility
- Validate all input (fail-closed on invalid data)
- Log errors to stderr, output only JSON to stdout
- Exit with code 0 (not 1) when denying via JSON
- Use descriptive error messages for debugging

**Error Handling:**
- Use typed errors where appropriate
- Log errors with context (request ID, tool_name, cwd)
- Fail gracefully with user-friendly messages
- Never expose sensitive information (tokens, secrets) in logs or errors
- Hook script: always fail-closed (deny on error)

## 4. Test Procedures

**Manual Testing:**

1. **Broker Health Check:**
   ```bash
   curl http://localhost:3000/health
   # Expected: {"status":"ok","timestamp":"...","version":"0.0.1"}
   ```

2. **Pairing Flow:**
   ```bash
   # Terminal 1: Start broker
   cd apps/broker && pnpm dev
   # Note the 6-digit pairing code from console

   # Terminal 2: Start web-ui
   cd apps/web-ui && pnpm dev

   # Browser: Open http://localhost:3001
   # Expected: Redirected to /pair
   # Enter pairing code
   # Expected: Redirected to home, "● Connected" badge
   # Expected: Token stored in localStorage
   ```

3. **Hook Script Validation:**
   ```bash
   # Test with invalid payload (missing tool_name)
   echo '{}' | node .claude/hooks/pretooluse-gate.js
   # Expected stderr: "[Hook] ERROR: Missing or invalid tool_name"
   # Expected stdout: JSON with permissionDecision: "deny"

   # Test without token
   echo '{"tool_name":"Bash","cwd":"/tmp","tool_input":{"command":"ls"}}' | \
     node .claude/hooks/pretooluse-gate.js
   # Expected: Deny with "GATE_BROKER_TOKEN not configured"

   # Test with valid token (set GATE_BROKER_TOKEN env var)
   export GATE_BROKER_TOKEN=your-token-here
   echo '{"tool_name":"Read","cwd":"/tmp","tool_input":{"file_path":"test.txt"}}' | \
     node .claude/hooks/pretooluse-gate.js
   # Expected stderr: "[Hook] Allowing Read without approval"
   # Expected: Exit 0 (no JSON output = allow)
   ```

4. **End-to-End Hook Flow:**
   ```bash
   # Terminal 1: Start broker
   cd apps/broker && pnpm dev

   # Terminal 2: Start web-ui and pair
   cd apps/web-ui && pnpm dev
   # Pair and get token

   # Terminal 3: Configure hooks
   cp .claude/settings.json.example .claude/settings.json
   chmod +x .claude/hooks/pretooluse-gate.js
   # Edit .claude/settings.json:
   # - Set command path to /absolute/path/to/gate/.claude/hooks/pretooluse-gate.js
   # - Set GATE_BROKER_TOKEN to token from localStorage

   # Start Claude CLI in Gate project directory
   claude

   # Try a Bash command
   > "Run ls -la"

   # Expected in Web UI:
   # - Request card appears
   # - Shows "Bash: ls -la" summary
   # - Allow/Deny buttons enabled

   # Click "Allow"
   # Expected in Claude CLI:
   # - Command executes successfully

   # Try another command and click "Deny"
   # Expected in Claude CLI:
   # - "Tool execution blocked: User denied this operation"
   ```

5. **Timeout Test:**
   ```bash
   # Configure hook execution timeout to 5 seconds in .claude/settings.json
   # For each PreToolUse hook matcher (Bash, Edit, Write, NotebookEdit),
   # set .hooks.PreToolUse[].hooks[].timeout to 5000
   # Example: "timeout": 5000

   # Start Claude CLI
   > "Run echo test"

   # Wait 5+ seconds without clicking Allow/Deny
   # Expected: Auto-deny after 5 seconds
   # Expected in Web UI: Card disappears
   ```

**Automated Testing (Future):**
- Unit tests for hook script input validation
- Integration tests for broker API endpoints
- E2E tests for full permission flow with hooks
- WebSocket connection/reconnection tests

**Pre-commit Checklist:**
- [ ] `pnpm -r lint` passes (2 packages: broker, web-ui)
- [ ] `pnpm -r typecheck` passes
- [ ] `pnpm -r build` succeeds
- [ ] Hook script executable: `chmod +x .claude/hooks/pretooluse-gate.js`
- [ ] Manual smoke test of changed functionality
- [ ] No sensitive data (tokens, secrets) in logs or error messages

## 5. Security Considerations

**Current Implementation:**
- **JWT Authentication**: Required for `/v1/requests`, `/v1/decisions`, and WebSocket connections
- **Pairing Flow**: 6-digit codes for trust establishment (5-minute expiry, single-use)
- **Fail-Closed**: Hook script denies on any error (invalid payload, network failure, timeout)
- **First-Response-Wins**: Only first decision accepted, duplicates return 409
- **Input Validation**: Hook validates tool_name, cwd, tool_input structure
- **No Secrets in Logs**: Tokens never logged (GATE_BROKER_TOKEN sanitized in errors)

**Security Best Practices:**
- Run broker on localhost or trusted LAN only (default port 3000)
- Store tokens in environment variables (hook script) or localStorage (web-ui)
- Never commit `.claude/settings.json` or tokens to version control (gitignored)
- Review broker logs for suspicious activity
- Regenerate pairing codes regularly in production
- Use `chmod +x` on hook script only (not `chmod 777`)

**Threat Model:**
- **In Scope**: Preventing unauthorized command execution, securing LAN communications
- **Out of Scope (MVP)**: Protection against compromised LAN, MITM attacks on public networks
- **Assumptions**: Trusted LAN environment, physical device security, Node.js runtime trusted

**Hook Script Security:**
- Validates all input before processing (fail-closed on invalid data)
- No eval() or dynamic code execution
- No file system writes (read-only operation)
- Exit code 0 with JSON deny (not exit 1) to avoid Claude CLI error messages
- stderr used for logging, stdout only for JSON output

**Future Enhancements:**
- HTTPS/WSS with Let's Encrypt certificates
- Rate limiting on pairing endpoint
- Token rotation and refresh mechanism
- Audit logging for all permission decisions
- Content Security Policy for Web UI
- Subresource Integrity for CDN assets

**Reporting Security Issues:**
- Do not open public GitHub issues for security vulnerabilities
- Contact maintainers directly via GitHub Security Advisory
- Provide detailed reproduction steps and impact assessment
