import * as pty from "node-pty";
import { AdapterConfig } from "./config";
import { PatternDetector, DetectionPattern } from "./detection";
import { BrokerClient } from "./broker-client";

export interface PtyManagerOptions {
  config: AdapterConfig;
  patterns?: DetectionPattern[];
  onData?: (data: string) => void;
  onExit?: (code: number) => void;
}

/**
 * Manages PTY instance for Claude CLI
 */
export class PtyManager {
  private ptyProcess: pty.IPty | null = null;
  private options: PtyManagerOptions;
  private detector: PatternDetector;
  private brokerClient: BrokerClient;
  private isProcessingPermission = false;

  constructor(options: PtyManagerOptions) {
    this.options = options;
    this.detector = new PatternDetector(options.patterns);
    this.brokerClient = new BrokerClient(
      options.config.brokerUrl,
      options.config.brokerToken
    );
  }

  /**
   * Spawn Claude CLI in PTY
   */
  spawn(): void {
    const { config } = this.options;

    console.log(`[Adapter] Spawning Claude CLI: ${config.claudeCommand}`);
    console.log(`[Adapter] Working directory: ${config.cwd}`);

    // Spawn PTY process with error handling
    try {
      this.ptyProcess = pty.spawn(config.claudeCommand, [], {
        name: "xterm-color",
        cols: 80,
        rows: 30,
        cwd: config.cwd,
        env: process.env as { [key: string]: string },
      });
    } catch (error) {
      console.error("[Adapter] Failed to spawn Claude CLI PTY process");
      console.error(`[Adapter] Command: ${config.claudeCommand}, CWD: ${config.cwd}`);
      console.error("[Adapter] Spawn error:", error);

      this.ptyProcess = null;

      if (this.options.onExit) {
        this.options.onExit(1);
      }

      return;
    }

    // Handle stdout/stderr data
    this.ptyProcess.onData(async (data: string) => {
      // Log output
      process.stdout.write(data);

      // Check for permission prompt pattern
      if (!this.isProcessingPermission) {
        const detection = this.detector.process(data);

        if (detection.matched) {
          console.log(
            `\n[Adapter] Permission prompt detected: ${detection.patternName}`
          );

          // Set flag immediately to prevent race condition
          this.isProcessingPermission = true;

          // Request permission from broker (async operation)
          (async () => {
            try {
              const decision = await this.brokerClient.requestPermission(
                detection.patternName || "Permission request",
                {
                  cwd: detection.cwd || config.cwd,
                  command: detection.command || "Unknown command",
                  rawPrompt: detection.rawPrompt,
                }
              );

              // Inject decision into PTY
              const input = decision.decision === "allow" ? "y\n" : "n\n";
              console.log(`[Adapter] Injecting decision: ${input.trim()}`);
              this.write(input);
            } catch (error) {
              console.error("[Adapter] Error handling permission:", error);
              // Default to deny on error
              this.write("n\n");
            } finally {
              // Always reset buffer and flag
              this.detector.reset();
              this.isProcessingPermission = false;
            }
          })();
        }
      }

      // Call callback if provided
      if (this.options.onData) {
        this.options.onData(data);
      }
    });

    // Handle PTY exit
    this.ptyProcess.onExit(({ exitCode }) => {
      console.log(`[Adapter] Claude CLI exited with code: ${exitCode}`);

      if (this.options.onExit) {
        this.options.onExit(exitCode);
      }

      this.ptyProcess = null;
    });

    // Log PID after handlers are set up
    console.log(`[Adapter] Claude CLI spawned successfully (PID: ${this.ptyProcess.pid})`);
  }

  /**
   * Write data to PTY stdin
   */
  write(data: string): void {
    if (!this.ptyProcess) {
      console.warn("[Adapter] Cannot write: PTY not spawned");
      return;
    }

    this.ptyProcess.write(data);
  }

  /**
   * Kill PTY process
   */
  kill(): void {
    if (!this.ptyProcess) {
      console.warn("[Adapter] Cannot kill: PTY not spawned");
      return;
    }

    console.log("[Adapter] Killing Claude CLI...");
    this.ptyProcess.kill();
    // Note: ptyProcess will be set to null by onExit handler
  }

  /**
   * Check if PTY is running
   */
  isRunning(): boolean {
    return this.ptyProcess !== null;
  }
}
