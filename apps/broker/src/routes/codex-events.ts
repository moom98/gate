import { Request, Response } from "express";
import { CodexEventPayload } from "../types";
import { wsManager } from "../websocket";

/**
 * POST /v1/codex-events
 * Receive Codex CLI event (agent-turn-complete) from notify script
 *
 * Broadcasts event to all WebSocket clients for notification display
 */
export function postCodexEvents(
  req: Request<unknown, { success: boolean }, CodexEventPayload>,
  res: Response<{ success: boolean }>
) {
  const event = req.body;

  // Validate required fields
  if (
    !event ||
    typeof event !== "object" ||
    event.type !== "agent-turn-complete" ||
    typeof event.ts !== "string" ||
    typeof event.threadId !== "string" ||
    typeof event.cwd !== "string"
  ) {
    console.warn("[Broker] Invalid codex event payload", {
      hasEvent: !!event,
      type: event?.type,
      hasTs: typeof event?.ts === "string",
      hasThreadId: typeof event?.threadId === "string",
      hasCwd: typeof event?.cwd === "string",
    });
    return res.status(400).json({ success: false });
  }

  // Security: Truncate message to prevent payload abuse
  const sanitizedEvent = {
    ...event,
    message: event.message ? truncateMessage(event.message, 500) : undefined,
  };

  console.log("[Broker] Received Codex event:", {
    type: event.type,
    threadId: event.threadId,
    cwd: event.cwd,
    ts: event.ts,
    messageLength: event.message?.length || 0,
  });

  // Broadcast to WebSocket clients
  wsManager.broadcastCodexEvent(sanitizedEvent);

  res.json({ success: true });
}

/**
 * Truncate message to max length with ellipsis
 */
function truncateMessage(message: string, maxLength: number): string {
  if (message.length <= maxLength) {
    return message;
  }
  return message.substring(0, maxLength - 3) + "...";
}
