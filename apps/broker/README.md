# Gate Broker

HTTP + WebSocket server for managing Claude Code permission requests.

## Quick Start

```bash
cd apps/broker
pnpm dev
```

The broker will start on `http://localhost:3000` and display a 6-digit pairing code.

## Configuration

Environment variables (`.env.local`):

- `PORT` - HTTP server port (default: 3000)
- `WS_PATH` - WebSocket endpoint path (default: /ws)
- `JWT_SECRET` - Secret for signing JWT tokens (auto-generated if not set)
- `NODE_ENV` - Environment mode (development/production)

## Claude Code Hooks Setup

### Prerequisites

1. Broker running on port 3000
2. Web UI running on port 3001
3. Paired and obtained authentication token

### Setup Instructions

1. **Get your token:**
   - Open Web UI: http://localhost:3001
   - Pair with the 6-digit code from broker logs
   - Open DevTools (F12) > Application > localStorage
   - Copy the value of `token`

2. **Configure hooks:**

   Copy the template from the root of the Gate project:

   ```bash
   cp .claude/settings.json.example .claude/settings.json
   chmod +x .claude/hooks/pretooluse-gate.js
   ```

   Edit `.claude/settings.json`:

   ```json
   {
     "hooks": {
       "PreToolUse": [
         {
           "matcher": "Bash",
           "hooks": [
             {
               "type": "command",
               "command": "/absolute/path/to/gate/.claude/hooks/pretooluse-gate.js",
               "timeout": 65000,
               "env": {
                 "GATE_BROKER_URL": "http://localhost:3000",
                 "GATE_BROKER_TOKEN": "your-token-here"
               }
             }
           ]
         },
         {
           "matcher": "Edit",
           "hooks": [
             {
               "type": "command",
               "command": "/absolute/path/to/gate/.claude/hooks/pretooluse-gate.js",
               "timeout": 65000,
               "env": {
                 "GATE_BROKER_URL": "http://localhost:3000",
                 "GATE_BROKER_TOKEN": "your-token-here"
               }
             }
           ]
         },
         {
           "matcher": "Write",
           "hooks": [
             {
               "type": "command",
               "command": "/absolute/path/to/gate/.claude/hooks/pretooluse-gate.js",
               "timeout": 65000,
               "env": {
                 "GATE_BROKER_URL": "http://localhost:3000",
                 "GATE_BROKER_TOKEN": "your-token-here"
               }
             }
           ]
         },
         {
           "matcher": "NotebookEdit",
           "hooks": [
             {
               "type": "command",
               "command": "/absolute/path/to/gate/.claude/hooks/pretooluse-gate.js",
               "timeout": 65000,
               "env": {
                 "GATE_BROKER_URL": "http://localhost:3000",
                 "GATE_BROKER_TOKEN": "your-token-here"
               }
             }
           ]
         }
       ]
     }
   }
   ```

   Replace:
   - `/absolute/path/to/gate/` with the actual path
   - `your-token-here` with the token from localStorage

3. **Test the integration:**

   ```bash
   # Start Claude CLI
   claude

   # Try a command that requires approval
   > "Run ls -la"

   # Check Web UI - you should see a notification
   # Approve/deny - Claude will receive the decision
   ```

## API Endpoints

### POST `/v1/requests`

Submit a permission request and wait for user decision.

**Request:**

```json
{
  "id": "uuid-v4",
  "summary": "Bash: ls -la",
  "details": {
    "cwd": "/path/to/project",
    "command": "ls -la",
    "rawPrompt": "{...}"
  },
  "timeoutSec": 60
}
```

**Response (200 OK):**

```json
{
  "decision": "allow"
}
```

or

```json
{
  "decision": "deny"
}
```

**Authentication:** Bearer token required in `Authorization` header.

### POST `/v1/decisions`

Respond to a pending permission request.

**Request:**

```json
{
  "id": "uuid-v4",
  "decision": "allow"
}
```

**Response (200 OK):**

```json
{
  "success": true
}
```

**Authentication:** Bearer token required.

### POST `/v1/pair`

Pair a new client using a 6-digit code.

**Request:**

```json
{
  "code": "123456"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "clientId": "uuid-v4"
}
```

**No authentication required** (this is how you get the initial token).

### GET `/health`

Health check endpoint.

**Response (200 OK):**

```json
{
  "status": "ok",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "version": "0.0.1"
}
```

## WebSocket

Connect to `ws://localhost:3000/ws?token=your-jwt-token`

**Authentication:** Token required in query parameter.

### Message Types

**Sent to client:**

```json
{
  "type": "permission_request",
  "payload": {
    "id": "uuid-v4",
    "summary": "Bash: ls -la",
    "details": { ... },
    "timeoutSec": 60
  }
}
```

```json
{
  "type": "permission_resolved",
  "payload": {
    "id": "uuid-v4",
    "decision": "allow"
  }
}
```

## Security

- **JWT authentication** required for all mutation endpoints
- **6-digit pairing codes** with 5-minute expiration
- **First-response-wins** logic prevents race conditions
- **60-second timeout** prevents indefinite blocking
- **Fail closed** on errors (deny by default)

## Development

```bash
pnpm dev        # Start with tsx watch
pnpm build      # Build TypeScript
pnpm typecheck  # Type-check only
pnpm lint       # ESLint
```
