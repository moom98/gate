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

4. **Broker WebSocket Integration (Step 4):**
   ```bash
   # Test WebSocket connection
   cd apps/broker
   pnpm dev

   # In another terminal, connect with wscat (install: npm i -g wscat)
   wscat -c ws://localhost:3000/ws
   # Expected: Connection established
   # Expected: Receives permission_resolved message with id "connection" and decision "allow"

   # Test permission request with WebSocket broadcast
   curl -X POST http://localhost:3000/v1/requests \
     -H "Content-Type: application/json" \
     -d '{
       "id": "test-123",
       "summary": "Test command",
       "details": {
         "cwd": "/tmp",
         "command": "echo hello",
         "rawPrompt": "Run echo hello?"
       },
       "timeoutSec": 60
     }'
   # Expected: WebSocket client receives permission_request message
   # Expected: Request waits for decision (or times out after 60s)

   # Send decision (in another terminal while request is waiting)
   curl -X POST http://localhost:3000/v1/decisions \
     -H "Content-Type: application/json" \
     -d '{"id": "test-123", "decision": "allow"}'
   # Expected: {"success":true}
   # Expected: WebSocket client receives permission_resolved message
   # Expected: Original /v1/requests call returns {"decision":"allow"}

   # Test duplicate decision (409 Conflict)
   curl -X POST http://localhost:3000/v1/decisions \
     -H "Content-Type: application/json" \
     -d '{"id": "test-123", "decision": "deny"}'
   # Expected: HTTP 409, {"success":false}

   # Test timeout (wait 60+ seconds without decision)
   curl -X POST http://localhost:3000/v1/requests \
     -H "Content-Type: application/json" \
     -d '{
       "id": "test-timeout",
       "summary": "Timeout test",
       "details": {
         "cwd": "/tmp",
         "command": "echo timeout",
         "rawPrompt": "Test timeout?"
       },
       "timeoutSec": 5
     }'
   # Expected: After 5 seconds, returns {"decision":"deny"}
   # Expected: WebSocket client receives permission_resolved with "deny"
   ```

5. **Adapter Detection and Injection (Step 5):**
   ```bash
   # Test pattern detection with mock Claude CLI
   cd apps/adapter-claude

   # Option 1: Test with actual Claude CLI (if installed)
   # Make sure BROKER_URL is set correctly
   export BROKER_URL=http://localhost:3000
   pnpm dev
   # Interact with Claude to trigger permission prompt
   # Expected: Adapter detects prompt, sends request to broker, injects y/n

   # Option 2: Test with echo command (for pattern testing)
   export CLAUDE_COMMAND="bash -c 'read -p \"Allow command execution? (y/n): \" answer && echo You answered: \$answer'"
   pnpm dev
   # Expected: Adapter detects (y/n) pattern
   # Expected: Broker receives permission request
   # Expected: After decision, 'y' or 'n' is injected

   # Verify logs show:
   # - "[Adapter] Permission prompt detected: <pattern_name>"
   # - "[BrokerClient] Sending permission request: <id>"
   # - "[BrokerClient] Received decision: allow/deny"
   # - "[Adapter] Injecting decision: y/n"
   ```

6. **Web UI WebSocket Integration (Step 6):**
   ```bash
   # Terminal 1: Start broker
   cd apps/broker
   pnpm dev
   # Expected: Broker starts on http://localhost:3000

   # Terminal 2: Start web-ui
   cd apps/web-ui
   pnpm dev
   # Expected: Web UI starts on http://localhost:3001

   # Open browser: http://localhost:3001
   # Expected: "● Connected" badge (green)
   # Expected: "No pending requests" message

   # Terminal 3: Test with mock request
   curl -X POST http://localhost:3000/v1/requests \
     -H "Content-Type: application/json" \
     -d '{
       "id": "test-ui-123",
       "summary": "Test UI Integration",
       "details": {
         "cwd": "/tmp",
         "command": "echo test",
         "rawPrompt": "Allow echo test? (y/n)"
       },
       "timeoutSec": 60
     }' &

   # Expected in Web UI:
   # - Request card appears immediately
   # - Shows summary, command, cwd, rawPrompt
   # - Allow/Deny buttons enabled

   # Click "Allow" or "Deny" button
   # Expected:
   # - Button shows "Sending..."
   # - "Decision sent successfully" message appears
   # - Card disappears after 3 seconds
   # - Terminal 3 curl returns {"decision":"allow"} or {"decision":"deny"}
   ```

7. **Token Pairing and Authentication (Step 7):**
   ```bash
   # Terminal 1: Start broker
   cd apps/broker
   pnpm dev
   # Expected: Broker displays pairing code in console
   # Example output:
   # ┌─────────────────────────────────────────┐
   # │         PAIRING CODE                    │
   # │                                         │
   # │         123456                          │
   # │                                         │
   # │  Use this code to pair clients          │
   # │  Expires in 5 minutes                   │
   # └─────────────────────────────────────────┘

   # Terminal 2: Start web-ui
   cd apps/web-ui
   pnpm dev
   # Expected: Web UI starts on http://localhost:3001

   # Open browser: http://localhost:3001
   # Expected: Redirected to /pair page
   # Expected: Pairing code input form

   # Enter the 6-digit code from broker console
   # Expected: Redirected to home page
   # Expected: "● Connected" badge (green)
   # Expected: Logout button visible

   # Test authentication:
   # - Close browser tab
   # - Reopen http://localhost:3001
   # Expected: Automatically connected (token stored in localStorage)

   # Test token on decisions endpoint:
   curl -X POST http://localhost:3000/v1/decisions \
     -H "Content-Type: application/json" \
     -d '{"id":"test-123","decision":"allow"}'
   # Expected: 401 Unauthorized (missing token)

   # Test WebSocket without token:
   # Use WebSocket test tool to connect to ws://localhost:3000/ws
   # Expected: Connection rejected

   # Generate new pairing code:
   curl -X POST http://localhost:3000/v1/pair/generate
   # Expected: {"success":true,"code":"123456","expiresIn":"5 minutes"}

   # Test adapter with token:
   cd apps/adapter-claude
   # Add BROKER_TOKEN to .env file (get from web-ui localStorage or pair via API)
   export BROKER_TOKEN=your-jwt-token
   export BROKER_URL=http://localhost:3000
   pnpm dev
   # Expected: Adapter connects successfully
   ```

8. **End-to-End Permission Flow:**
   - Start broker: `cd apps/broker && pnpm dev`
   - Start web-ui: `cd apps/web-ui && pnpm dev`
   - Start adapter: `cd apps/adapter-claude && pnpm dev`
   - Trigger Claude Code CLI permission prompt
   - Verify request appears in Web UI
   - Click "Allow" or "Deny"
   - Verify PTY receives `y` or `n` input
   - Verify adapter continues operation

9. **GitHub Actions自動化テスト:**
   ```bash
   # Copilot Review Auto-Handlerのテスト

   # 方法1: 実際のPRでCopilotレビューをトリガー
   git checkout -b test/copilot-automation
   # コードを変更
   git commit -am "test: trigger copilot review"
   git push -u origin test/copilot-automation
   gh pr create --title "Test: Copilot Automation" --body "Testing auto-review"
   # Copilotレビューを待つ（または手動でレビューコメントを追加）

   # ワークフロー実行を確認
   gh run list --workflow=copilot-review-to-claude.yml --limit 5
   gh run view <run-id> --log

   # 期待される動作:
   # - Copilotレビュー検知
   # - マーカーチェック（初回はスキップ）
   # - Claude実行・修正・push
   # - PRに [claude-copilot-handled] マーカー付きコメント投稿

   # 方法2: ワークフローログで動作確認
   # Actions > Copilot Review Auto-Handler > 最新実行
   # - "Debug Event Info" でトリガー情報確認
   # - "Check for existing Claude handling marker" で重複実行防止確認
   # - "Check retry limit" でリトライカウント確認
   # - "Run Claude Code to fix review issues" でClaude実行結果確認

   # 無限ループ対策テスト:
   # - 同一PRで3回目のCopilotレビューをトリガー
   # - Expected: リトライ上限（2回）超過でスキップ
   # - ログに "Retry limit exceeded" が表示されること
   ```

**Automated Testing (Future):**
- Unit tests for detection regex patterns
- Integration tests for broker API endpoints
- E2E tests for full permission flow
- WebSocket connection/reconnection tests
- GitHub Actions workflow testing (mock events)

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
