import { Request, Response } from "express";
import { DecisionPayload } from "../types";
import { pendingRequests } from "../pending-requests";
import { wsManager } from "../websocket";
import { alwaysAllowRules } from "../always-allow-rules";

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
    (decision !== "allow" && decision !== "deny" && decision !== "alwaysAllow")
  ) {
    console.warn("[Broker] Invalid decision payload");
    return res.status(400).json({ success: false });
  }

  console.log("[Broker] Received decision:", { id, decision });

  // Handle "alwaysAllow" decision
  if (decision === "alwaysAllow") {
    // Get the original request BEFORE resolving (to avoid race condition)
    const request = pendingRequests.get(id);

    // Treat as "allow" for this specific request
    const resolved = pendingRequests.resolve(id, { decision: "allow" });
    if (!resolved) {
      console.warn(`[Broker] Decision for ${id} rejected (already resolved or not found)`);
      return res.status(409).json({ success: false });
    }

    // Add to always-allow rules AFTER successful resolution
    if (request) {
      alwaysAllowRules.add(request);
    }

    // Broadcast as "alwaysAllow" to inform clients
    wsManager.broadcastResolution(id, "alwaysAllow", "manual");
  } else {
    // Regular allow/deny decision
    const resolved = pendingRequests.resolve(id, { decision });
    if (!resolved) {
      console.warn(`[Broker] Decision for ${id} rejected (already resolved or not found)`);
      return res.status(409).json({ success: false });
    }

    wsManager.broadcastResolution(id, decision, "manual");
  }

  res.json({ success: true });
}
