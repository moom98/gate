import { spawn, ChildProcess } from "child_process";
import { AdapterConfig } from "./config";
import { BrokerClient } from "./broker-client";

export interface ProcessManagerOptions {
  config: AdapterConfig;
  onExit?: (code: number) => void;
}

/**
 * Manages Claude CLI process without PTY
 * Uses --dangerously-skip-permissions flag and communicates via stdio
 */
export class ProcessManager {
  private childProcess: ChildProcess | null = null;
  private options: ProcessManagerOptions;
  private brokerClient: BrokerClient;

  constructor(options: ProcessManagerOptions) {
    this.options = options;
    this.brokerClient = new BrokerClient(
      options.config.brokerUrl,
      options.config.brokerToken
    );
  }

  /**
   * Spawn Claude CLI with --dangerously-skip-permissions
   */
  spawn(): void {
    const { config } = this.options;

    console.log(`[Adapter] Spawning Claude CLI: ${config.claudeCommand}`);
    console.log(`[Adapter] Working directory: ${config.cwd}`);
    console.log(`[Adapter] Using --dangerously-skip-permissions mode`);

    try {
      // Prepare environment variables
      const env: { [key: string]: string } = {};
      for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) {
          env[key] = String(value);
        }
      }

      // Spawn Claude CLI with --dangerously-skip-permissions flag
      this.childProcess = spawn(
        config.claudeCommand,
        ["--dangerously-skip-permissions"],
        {
          cwd: config.cwd,
          env,
          stdio: ["pipe", "pipe", "pipe"],
        }
      );

      // Forward stdout to console
      this.childProcess.stdout?.on("data", (data: Buffer) => {
        process.stdout.write(data);
      });

      // Forward stderr to console
      this.childProcess.stderr?.on("data", (data: Buffer) => {
        process.stderr.write(data);
      });

      // Handle process exit
      this.childProcess.on("exit", (code) => {
        const exitCode = code ?? 0;
        console.log(`[Adapter] Claude CLI exited with code: ${exitCode}`);

        if (this.options.onExit) {
          this.options.onExit(exitCode);
        }

        this.childProcess = null;
      });

      // Handle spawn errors
      this.childProcess.on("error", (error) => {
        console.error("[Adapter] Failed to spawn Claude CLI process");
        console.error(`[Adapter] Command: ${config.claudeCommand}`);
        console.error("[Adapter] Spawn error:", error);

        if (this.options.onExit) {
          this.options.onExit(1);
        }
      });

      // Forward stdin from console to Claude
      process.stdin.pipe(this.childProcess.stdin!);

      console.log(
        `[Adapter] Claude CLI spawned successfully (PID: ${this.childProcess.pid})`
      );
      console.log(
        `[Adapter] All permission prompts are automatically approved (--dangerously-skip-permissions)`
      );
    } catch (error) {
      console.error("[Adapter] Failed to spawn Claude CLI process");
      console.error(`[Adapter] Command: ${config.claudeCommand}`);
      console.error("[Adapter] Spawn error:", error);

      this.childProcess = null;

      if (this.options.onExit) {
        this.options.onExit(1);
      }
    }
  }

  /**
   * Write data to Claude stdin
   */
  write(data: string): void {
    if (!this.childProcess || !this.childProcess.stdin) {
      console.warn("[Adapter] Cannot write: Process not spawned");
      return;
    }

    this.childProcess.stdin.write(data);
  }

  /**
   * Kill Claude process
   */
  kill(): void {
    if (!this.childProcess) {
      console.warn("[Adapter] Cannot kill: Process not spawned");
      return;
    }

    console.log("[Adapter] Killing Claude CLI...");
    this.childProcess.kill();
  }

  /**
   * Check if process is running
   */
  isRunning(): boolean {
    return this.childProcess !== null;
  }
}
