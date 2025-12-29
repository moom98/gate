import { loadConfig } from "./config";
import { ProcessManager } from "./process-manager";

console.log("[Adapter] Starting Gate Adapter for Claude CLI");
console.log("[Adapter] Note: Using --dangerously-skip-permissions mode");
console.log(
  "[Adapter] All permission prompts are automatically approved by Claude CLI"
);

// Load configuration
const config = loadConfig();
console.log("[Adapter] Configuration loaded:");
console.log(`  Broker URL: ${config.brokerUrl}`);
console.log(`  Claude Command: ${config.claudeCommand}`);
console.log(`  Working Directory: ${config.cwd}`);

// Create process manager
const processManager = new ProcessManager({
  config,
  onExit: (code: number) => {
    console.log(`[Adapter] Exiting with code: ${code}`);
    process.exit(code);
  },
});

// Spawn Claude CLI with error handling
try {
  processManager.spawn();
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
  processManager.kill();
  // Note: onExit handler will call process.exit(code)
});

process.on("SIGTERM", () => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log("[Adapter] Received SIGTERM, shutting down...");
  processManager.kill();
  // Note: onExit handler will call process.exit(code)
});
