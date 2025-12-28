#!/bin/bash
set -e

echo "=== Gate Adapter Claude Setup ==="
echo ""

# Get the root directory (one level up from scripts/)
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ADAPTER_DIR="$ROOT_DIR/apps/adapter-claude"

# 1. Build adapter-claude
echo "Building adapter-claude..."
cd "$ADAPTER_DIR"
pnpm build
echo "✓ Build complete"
echo ""

# 2. Check if claude command exists
if ! command -v claude &> /dev/null; then
    echo "⚠ WARNING: 'claude' command not found in PATH"
    echo "Please install Claude Code CLI first:"
    echo "  https://docs.anthropic.com/claude/docs/claude-code"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 3. Check if broker is running
BROKER_PORT=$(grep "^PORT=" "$ROOT_DIR/apps/broker/.env.local" 2>/dev/null | cut -d'=' -f2 || echo "3000")
BROKER_URL="http://localhost:$BROKER_PORT"

echo "Checking broker at $BROKER_URL..."
if curl -sf "$BROKER_URL/health" > /dev/null 2>&1; then
    echo "✓ Broker is running"
else
    echo "⚠ WARNING: Broker is not running at $BROKER_URL"
    echo "Start broker first: cd apps/broker && pnpm dev"
    echo ""
fi

# 4. Update BROKER_URL in .env.local to match broker's PORT
if [ -f "$ADAPTER_DIR/.env.local" ]; then
    # Update BROKER_URL to match broker's PORT (cross-platform sed)
    if [ "$(uname)" = "Darwin" ]; then
        # macOS
        sed -i .bak "s|^BROKER_URL=.*|BROKER_URL=$BROKER_URL|" "$ADAPTER_DIR/.env.local"
    else
        # Linux
        sed -i.bak "s|^BROKER_URL=.*|BROKER_URL=$BROKER_URL|" "$ADAPTER_DIR/.env.local"
    fi
    echo "✓ Updated BROKER_URL to $BROKER_URL"
else
    echo "⚠ WARNING: .env.local not found in adapter-claude"
fi

# 5. Prompt for BROKER_TOKEN
echo ""
echo "To get BROKER_TOKEN:"
echo "  1. Make sure broker is running: cd apps/broker && pnpm dev"
echo "  2. Note the pairing code displayed in broker console"
echo "  3. Open Web UI: http://localhost:3001"
echo "  4. Enter the pairing code"
echo "  5. After successful pairing, you can find the token in browser localStorage under the key 'token'"
echo "     (Open DevTools > Application > localStorage > token)"
echo ""
echo "Enter BROKER_TOKEN (input will be hidden, or press Enter to skip):"
read -rs BROKER_TOKEN
echo ""

if [ -n "$BROKER_TOKEN" ]; then
    # Ensure .env.local exists
    if [ ! -f "$ADAPTER_DIR/.env.local" ]; then
        touch "$ADAPTER_DIR/.env.local"
    fi

    # Update .env.local with token (cross-platform sed)
    if grep -qE '^[[:space:]]*BROKER_TOKEN=' "$ADAPTER_DIR/.env.local" 2>/dev/null; then
        # Replace existing uncommented BROKER_TOKEN line
        if [ "$(uname)" = "Darwin" ]; then
            sed -i .bak "s|^[[:space:]]*BROKER_TOKEN=.*|BROKER_TOKEN=$BROKER_TOKEN|" "$ADAPTER_DIR/.env.local"
        else
            sed -i.bak "s|^[[:space:]]*BROKER_TOKEN=.*|BROKER_TOKEN=$BROKER_TOKEN|" "$ADAPTER_DIR/.env.local"
        fi
    elif grep -qE '^[[:space:]]*#\s*BROKER_TOKEN=' "$ADAPTER_DIR/.env.local" 2>/dev/null; then
        # Uncomment and replace existing commented BROKER_TOKEN line
        if [ "$(uname)" = "Darwin" ]; then
            sed -i .bak "s|^[[:space:]]*#\s*BROKER_TOKEN=.*|BROKER_TOKEN=$BROKER_TOKEN|" "$ADAPTER_DIR/.env.local"
        else
            sed -i.bak "s|^[[:space:]]*#\s*BROKER_TOKEN=.*|BROKER_TOKEN=$BROKER_TOKEN|" "$ADAPTER_DIR/.env.local"
        fi
    else
        # No existing entry; append a new BROKER_TOKEN line
        echo "BROKER_TOKEN=$BROKER_TOKEN" >> "$ADAPTER_DIR/.env.local"
    fi
    echo "✓ Updated BROKER_TOKEN"
else
    echo "⚠ Skipped BROKER_TOKEN setup"
    echo "  You can set it manually later in apps/adapter-claude/.env.local"
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Start adapter: cd apps/adapter-claude && pnpm dev"
echo "  2. The adapter will spawn Claude CLI automatically"
echo "  3. Do NOT run 'claude' command directly"
echo "  4. Interact with Claude in the adapter's terminal"
echo "  5. Permission prompts will be sent to Web UI/iOS app"
echo ""
echo "Troubleshooting:"
echo "  - If no logs appear, check that BROKER_URL matches broker's PORT"
echo "  - If authentication fails, set BROKER_TOKEN in .env.local"
echo "  - Run with DEBUG_MODE=true for detailed logs"
echo ""
