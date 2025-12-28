"use client";

/**
 * Decision payload for POST /v1/decisions
 */
export interface DecisionPayload {
  id: string;
  decision: "allow" | "deny";
}

/**
 * API response for decisions
 */
export interface DecisionResponse {
  success: boolean;
}

/**
 * API client for broker HTTP endpoints
 */
export class BrokerAPI {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Send decision for a permission request
   */
  async sendDecision(id: string, decision: "allow" | "deny"): Promise<DecisionResponse> {
    const payload: DecisionPayload = { id, decision };

    try {
      const response = await fetch(`${this.baseUrl}/v1/decisions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        if (response.status === 409) {
          throw new Error("Decision already made for this request");
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("[API] Failed to send decision:", error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch (error) {
      console.error("[API] Health check failed:", error);
      return false;
    }
  }
}
