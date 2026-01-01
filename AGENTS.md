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
pnpm build        # Build production Next.js app (static export)
pnpm lint         # ESLint
pnpm typecheck    # TypeScript check
pnpm electron:dev # Launch Electron shell (spawns dev server + Electron)
pnpm electron:build # Package Electron app via electron-builder
```

**Hook setup:**
```bash
# Copy and configure hook settings
cp .claude/settings.json.example .claude/settings.json
chmod +x .claude/hooks/pretooluse-gate.js

# Edit .claude/settings.json with your token and path
# Get token from Web UI after pairing

# Prevent accidentally committing your token to git
git update-index --skip-worktree .claude/settings.json
```

**Managing Local Token Configuration:**

If you need to update the settings.json template in the repository:

```bash
# 1. Temporarily allow tracking settings.json changes
git update-index --no-skip-worktree .claude/settings.json

# 2. Make your changes (replace real tokens with {{REPLACE_WITH_YOUR_TOKEN}})

# 3. Commit the template changes
git add .claude/settings.json
git commit -m "docs: update settings.json template"

# 4. Re-enable skip-worktree
git update-index --skip-worktree .claude/settings.json

# 5. Restore your local token
# (edit .claude/settings.json to add your token back)
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

## 4. Branch Strategy and Pull Request Guidelines

**Branch Creation:**
- Create a new feature branch for each logical unit of work
- Use descriptive branch names following the pattern: `feat/NNN-description` or `fix/NNN-description`
- Each branch should focus on a single feature or fix

**Pull Request Workflow:**
- **Create PR for each branch**: Every feature branch must have its own Pull Request
- **Sequential merging**: Do NOT move to the next branch until the previous PR is merged
  - Wait for PR review and approval
  - Merge the current PR before starting work on dependent features
  - This ensures a clean, linear history and prevents merge conflicts
- **Japanese PRs**: All Pull Requests must be written in Japanese
  - Title (タイトル): Concise summary in Japanese
  - Body (本文): Detailed description in Japanese including:
    - Summary (概要)
    - Changes (変更内容)
    - Testing (テスト方法)
    - Dependencies (依存関係) if applicable

**Example Workflow:**
```bash
# 1. Create and work on first branch
git checkout -b feat/001-feature-a
# ... make changes ...
git commit -m "feat: implement feature A"
git push -u origin feat/001-feature-a
gh pr create --title "機能A: 説明" --body "..."

# 2. Wait for PR to be reviewed and merged
# ⚠️ Do NOT proceed until PR is merged

# 3. After PR is merged, create next branch
git checkout main
git pull
git checkout -b feat/002-feature-b
# ... make changes ...
```

**PR Dependencies:**
- If your PR depends on another unmerged PR, clearly state this in the PR description
- Use "Depends on #XX" notation
- Consider waiting for the dependency to be merged before creating the dependent PR

## 5. Test Procedures

**Manual Testing:**

1. **Broker Health Check:**
   ```bash
   curl http://localhost:3000/health
   # Expected: {"status":"ok","timestamp":"...","version":"0.0.1"}
   ```

2. **Pairing Flow (Electron):**
   ```bash
   # Terminal 1: Start broker
   cd apps/broker && pnpm dev
   # Note the 6-digit pairing code from console

   # Terminal 2: Start desktop shell (spawns dev server + Electron)
   cd apps/web-ui && pnpm electron:dev

   # Expected: Electron window opens and redirects to /pair
   # Enter pairing code from broker output
   # Expected: Redirected to dashboard, status badge shows "● Connected"
   # Expected: Token stored in the Electron window's localStorage
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

   # Terminal 2: Start Electron shell and pair
   cd apps/web-ui && pnpm electron:dev
   # Pair inside the Electron window and get token via DevTools localStorage

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
