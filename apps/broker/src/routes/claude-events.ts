import { Request, Response } from "express";
import { ClaudeEventPayload } from "../types";
import { wsManager } from "../websocket";

/**
 * POST /v1/claude-events
 * Receive Claude Code event (e.g., idle_prompt) from hook script
 *
 * Broadcasts event to all WebSocket clients for notification display
 */
export function postClaudeEvents(
  req: Request<unknown, { success: boolean }, ClaudeEventPayload>,
  res: Response<{ success: boolean }>
) {
  const event = req.body;

  // Validate required fields
  if (
    !event ||
    typeof event !== "object" ||
    event.type !== "idle_prompt" ||
    typeof event.ts !== "string"
  ) {
    console.warn("[Broker] Invalid claude event payload");
    return res.status(400).json({ success: false });
  }

  console.log("[Broker] Received Claude event:", {
    type: event.type,
    project: event.project || "unknown",
    ts: event.ts,
  });

  // Broadcast to WebSocket clients
  wsManager.broadcastClaudeEvent(event);

  res.json({ success: true });
}
