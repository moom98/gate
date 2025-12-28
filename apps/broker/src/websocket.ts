import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { PermissionRequest } from "./types";

/**
 * WebSocket message types
 */
export type WSMessage =
  | { type: "permission_request"; payload: PermissionRequest }
  | {
      type: "permission_resolved";
      payload: { id: string; decision: "allow" | "deny" };
    };

/**
 * WebSocket connection manager
 */
class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients = new Set<WebSocket>();

  /**
   * Initialize WebSocket server
   */
  init(server: Server): void {
    this.wss = new WebSocketServer({ server, path: "/ws" });

    this.wss.on("connection", (ws: WebSocket) => {
      console.log("[Broker] WebSocket client connected");
      this.clients.add(ws);

      ws.on("close", () => {
        console.log("[Broker] WebSocket client disconnected");
        this.clients.delete(ws);
      });

      ws.on("error", (error) => {
        console.error("[Broker] WebSocket error:", error.message);
        this.clients.delete(ws);
      });

      // Send initial connection confirmation
      this.sendToClient(ws, {
        type: "permission_resolved",
        payload: { id: "connection", decision: "allow" },
      });
    });

    console.log("[Broker] WebSocket server initialized on /ws");
  }

  /**
   * Broadcast permission request to all connected clients
   */
  broadcastRequest(request: PermissionRequest): void {
    const message: WSMessage = {
      type: "permission_request",
      payload: request,
    };

    this.broadcast(message);
    console.log(
      `[Broker] Broadcasted permission_request ${request.id} to ${this.clients.size} clients`
    );
  }

  /**
   * Broadcast permission resolution to all connected clients
   */
  broadcastResolution(id: string, decision: "allow" | "deny"): void {
    const message: WSMessage = {
      type: "permission_resolved",
      payload: { id, decision },
    };

    this.broadcast(message);
    console.log(
      `[Broker] Broadcasted permission_resolved ${id} (${decision}) to ${this.clients.size} clients`
    );
  }

  /**
   * Broadcast message to all connected clients
   */
  private broadcast(message: WSMessage): void {
    const payload = JSON.stringify(message);

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  /**
   * Send message to specific client
   */
  private sendToClient(client: WebSocket, message: WSMessage): void {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }

  /**
   * Get number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();
