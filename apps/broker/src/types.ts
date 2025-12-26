/**
 * Permission request from adapter to broker
 */
export interface PermissionRequest {
  /** Unique request ID */
  id: string;
  /** Summary of the command/action */
  summary: string;
  /** Detailed context */
  details: {
    /** Current working directory */
    cwd: string;
    /** Command to be executed */
    command: string;
    /** Raw prompt from Claude CLI */
    rawPrompt: string;
  };
  /** Timeout in seconds (default: 60) */
  timeoutSec?: number;
}

/**
 * Response to permission request
 */
export interface PermissionResponse {
  /** Decision: allow or deny */
  decision: "allow" | "deny";
}

/**
 * Decision payload from client (web-ui/iOS)
 */
export interface DecisionPayload {
  /** Request ID to respond to */
  id: string;
  /** Decision: allow or deny */
  decision: "allow" | "deny";
}

/**
 * Health check response
 */
export interface HealthResponse {
  status: "ok";
  timestamp: string;
  version: string;
}
