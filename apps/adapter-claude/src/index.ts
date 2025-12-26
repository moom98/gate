import { loadConfig } from "./config";
import { PtyManager } from "./pty-manager";

console.log("[Adapter] Starting Gate Adapter for Claude CLI");

// Load configuration
const config = loadConfig();
console.log("[Adapter] Configuration loaded:");
console.log(`  Broker URL: ${config.brokerUrl}`);
console.log(`  Claude Command: ${config.claudeCommand}`);
console.log(`  Working Directory: ${config.cwd}`);

// Create PTY manager
const ptyManager = new PtyManager({
  config,
  onData: (_data: string) => {
    // TODO (Step 5): Detect permission prompts and send to broker
    // For now, just pass through to stdout (handled in PtyManager)
  },
  onExit: (code: number) => {
    console.log(`[Adapter] Exiting with code: ${code}`);
    process.exit(code);
  },
});

// Spawn Claude CLI with error handling
try {
  ptyManager.spawn();
} catch (error) {
  console.error(
    "[Adapter] Failed to spawn Claude CLI:",
    error instanceof Error ? error.message : error
  );
  process.exit(1);
}

// Guard flag to prevent duplicate shutdown
let isShuttingDown = false;

// Handle process termination
process.on("SIGINT", () => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log("[Adapter] Received SIGINT, shutting down...");
  ptyManager.kill();
  process.exit(0);
});

process.on("SIGTERM", () => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log("[Adapter] Received SIGTERM, shutting down...");
  ptyManager.kill();
  process.exit(0);
});
