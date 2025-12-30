"use client";

import { AuthStorage } from "./auth";

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
 * API response for retry
 */
export interface RetryResponse {
  success: boolean;
  newId?: string;
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
    const token = AuthStorage.getToken();

    if (!token) {
      throw new Error("Not authenticated");
    }

    try {
      const response = await fetch(`${this.baseUrl}/v1/decisions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
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
   * Retry a timed-out request
   */
  async retryRequest(id: string): Promise<RetryResponse> {
    const token = AuthStorage.getToken();

    if (!token) {
      throw new Error("Not authenticated");
    }

    try {
      const response = await fetch(`${this.baseUrl}/v1/requests/retry/${id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Request not found or expired");
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("[API] Failed to retry request:", error);
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
