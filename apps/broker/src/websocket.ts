import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { IncomingMessage } from "http";
import { parse } from "url";
import {
  PermissionRequest,
  PermissionResolved,
  ClaudeEventPayload,
} from "./types";
import { AuthService } from "./auth";

/**
 * WebSocket message types
 */
export type WSMessage =
  | { type: "permission_request"; payload: PermissionRequest }
  | {
      type: "permission_resolved";
      payload: PermissionResolved;
    }
  | { type: "claude_idle_prompt"; payload: ClaudeEventPayload };

/**
 * WebSocket connection manager
 */
class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients = new Set<WebSocket>();
  private authService: AuthService | null = null;

  /**
   * Initialize WebSocket server
   */
  init(server: Server, authService: AuthService): void {
    this.authService = authService;
    this.wss = new WebSocketServer({
      server,
      path: "/ws",
      verifyClient: (info: {
        origin: string;
        secure: boolean;
        req: IncomingMessage;
      }) => this.verifyClient(info),
    });

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
  broadcastResolution(
    id: string,
    decision: "allow" | "deny" | "alwaysAllow",
    reason?: "timeout" | "manual"
  ): void {
    const message: WSMessage = {
      type: "permission_resolved",
      payload: { id, decision, reason },
    };

    this.broadcast(message);
    console.log(
      `[Broker] Broadcasted permission_resolved ${id} (${decision}, reason: ${reason || "none"}) to ${this.clients.size} clients`
    );
  }

  /**
   * Broadcast Claude idle event to all connected clients
   */
  broadcastClaudeEvent(event: ClaudeEventPayload): void {
    const message: WSMessage = {
      type: "claude_idle_prompt",
      payload: event,
    };

    this.broadcast(message);
    console.log(
      `[Broker] Broadcasted claude_idle_prompt (project: ${event.project || "unknown"}) to ${this.clients.size} clients`
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

  /**
   * Verify client authentication before WebSocket upgrade
   */
  private verifyClient(info: {
    origin: string;
    secure: boolean;
    req: IncomingMessage;
  }): boolean {
    if (!this.authService) {
      console.error("[Broker] AuthService not initialized");
      return false;
    }

    const req = info.req;
    const url = parse(req.url || "", true);
    const token = url.query.token as string | undefined;

    if (!token) {
      console.log("[Broker] WebSocket connection rejected: missing token");
      return false;
    }

    const payload = this.authService.verifyToken(token);

    if (!payload) {
      console.log("[Broker] WebSocket connection rejected: invalid token");
      return false;
    }

    console.log(`[Broker] WebSocket client authenticated: ${payload.clientId}`);
    return true;
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();
