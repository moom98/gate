import { Request, Response } from "express";
import { DecisionPayload } from "../types";

/**
 * POST /v1/decisions
 * Receive decision from client (web-ui/iOS)
 *
 * TODO (Step 4): Implement actual decision resolution logic
 * For now, just accepts the decision and logs it
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

  // TODO: Resolve pending request with this decision
  // TODO: Return 409 if request already resolved
  // TODO: Broadcast resolution to WebSocket clients

  res.json({ success: true });
}
