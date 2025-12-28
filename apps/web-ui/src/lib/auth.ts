"use client";

const TOKEN_KEY = "gate_auth_token";
const CLIENT_ID_KEY = "gate_client_id";

/**
 * Token storage and retrieval utilities
 */
export class AuthStorage {
  /**
   * Store authentication token and client ID
   */
  static setToken(token: string, clientId: string): void {
    if (typeof window === "undefined") {
      return;
    }

    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(CLIENT_ID_KEY, clientId);
  }

  /**
   * Retrieve stored token
   */
  static getToken(): string | null {
    if (typeof window === "undefined") {
      return null;
    }

    return localStorage.getItem(TOKEN_KEY);
  }

  /**
   * Retrieve stored client ID
   */
  static getClientId(): string | null {
    if (typeof window === "undefined") {
      return null;
    }

    return localStorage.getItem(CLIENT_ID_KEY);
  }

  /**
   * Check if user is authenticated
   */
  static isAuthenticated(): boolean {
    return this.getToken() !== null;
  }

  /**
   * Clear stored authentication data
   */
  static clearAuth(): void {
    if (typeof window === "undefined") {
      return;
    }

    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(CLIENT_ID_KEY);
  }
}
