import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env.local first, then .env
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config();

export interface AdapterConfig {
  /** Broker HTTP URL */
  brokerUrl: string;
  /** Broker authentication token */
  brokerToken?: string;
  /** Claude CLI command */
  claudeCommand: string;
  /** Working directory for Claude CLI */
  cwd: string;
}

/**
 * Load configuration from environment variables
 */
export function loadConfig(): AdapterConfig {
  return {
    brokerUrl: process.env.BROKER_URL || "http://localhost:3033",
    brokerToken: process.env.BROKER_TOKEN,
    claudeCommand: process.env.CLAUDE_COMMAND || "claude",
    cwd: process.env.CLAUDE_CWD || process.cwd(),
  };
}
