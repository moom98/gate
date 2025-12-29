import { randomUUID } from "crypto";

/**
 * Broker API types
 */
export interface PermissionRequest {
  id: string;
  summary: string;
  details: {
    cwd: string;
    command: string;
    rawPrompt: string;
  };
  timeoutSec?: number;
}

export interface PermissionResponse {
  decision: "allow" | "deny";
}

/**
 * HTTP client for broker communication
 */
export class BrokerClient {
  private brokerUrl: string;
  private token?: string;

  constructor(brokerUrl: string, token?: string) {
    this.brokerUrl = brokerUrl;
    this.token = token;
  }

  /**
   * Send permission request to broker and wait for decision
   */
  async requestPermission(
    summary: string,
    details: {
      cwd: string;
      command: string;
      rawPrompt: string;
    },
    timeoutSec = 60
  ): Promise<PermissionResponse> {
    const request: PermissionRequest = {
      id: randomUUID(),
      summary,
      details,
      timeoutSec,
    };

    console.log(`[BrokerClient] Sending permission request: ${request.id}`);
    console.log(`[BrokerClient] Summary: ${summary}`);

    try {
      const response = await fetch(`${this.brokerUrl}/v1/requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.token && { Authorization: `Bearer ${this.token}` }),
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout((timeoutSec + 5) * 1000), // Add 5s buffer
      });

      if (!response.ok) {
        throw new Error(
          `Broker returned ${response.status}: ${response.statusText}`
        );
      }

      const decision = (await response.json()) as PermissionResponse;

      console.log(
        `[BrokerClient] Received decision for ${request.id}: ${decision.decision}`
      );

      return decision;
    } catch (error) {
      console.error("[BrokerClient] Error requesting permission:", error);

      // Default to deny on error
      return { decision: "deny" };
    }
  }

  /**
   * Health check
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.brokerUrl}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

      return response.ok;
    } catch (error) {
      console.warn("[BrokerClient] Health check failed:", error);
      return false;
    }
  }
}
