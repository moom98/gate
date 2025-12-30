import { Request, Response } from "express";
import { DecisionPayload } from "../types";
import { pendingRequests } from "../pending-requests";
import { wsManager } from "../websocket";

/**
 * POST /v1/decisions
 * Receive decision from client (web-ui/iOS)
 *
 * Resolves pending request and broadcasts resolution to WebSocket clients
 */
export function postDecisions(
  req: Request<unknown, { success: boolean }, DecisionPayload>,
  res: Response<{ success: boolean }>
) {
  const { id, decision } = req.body;

  // Validate required fields
  if (
    typeof id !== "string" ||
    id.trim().length === 0 ||
    (decision !== "allow" && decision !== "deny")
  ) {
    console.warn("[Broker] Invalid decision payload");
    return res.status(400).json({ success: false });
  }

  console.log("[Broker] Received decision:", { id, decision });

  // Attempt to resolve pending request
  const resolved = pendingRequests.resolve(id, { decision });

  // If already resolved, return 409 Conflict
  if (!resolved) {
    console.warn(`[Broker] Decision for ${id} rejected (already resolved or not found)`);
    return res.status(409).json({ success: false });
  }

  // Broadcast resolution to WebSocket clients
  wsManager.broadcastResolution(id, decision, "manual");

  res.json({ success: true });
}
