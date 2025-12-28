import { Request, Response } from "express";
import { PermissionRequest, PermissionResponse } from "../types";
import { pendingRequests } from "../pending-requests";
import { wsManager } from "../websocket";

/**
 * POST /v1/requests
 * Receive permission request from adapter
 *
 * Creates pending request, broadcasts to WebSocket clients, waits for decision
 */
export async function postRequests(
  req: Request<unknown, PermissionResponse, PermissionRequest>,
  res: Response<PermissionResponse>
) {
  const request = req.body;

  // Validate required fields
  if (
    !request ||
    typeof request.id !== "string" ||
    typeof request.summary !== "string" ||
    !request.details ||
    typeof request.details.cwd !== "string" ||
    typeof request.details.command !== "string" ||
    typeof request.details.rawPrompt !== "string"
  ) {
    console.warn("[Broker] Invalid permission request body");
    return res.status(400).json({ decision: "deny" });
  }

  console.log("[Broker] Received permission request:", {
    id: request.id,
    summary: request.summary,
    cwd: request.details.cwd,
    command: request.details.command,
  });

  // Create pending request and broadcast to WebSocket clients
  const decisionPromise = pendingRequests.create(request);
  wsManager.broadcastRequest(request);

  try {
    // Wait for decision (will timeout after timeoutSec)
    const decision = await decisionPromise;

    // Return decision to adapter
    res.json(decision);
  } catch (error) {
    console.error("[Broker] Error while waiting for permission decision:", error);
    res.status(500).json({ decision: "deny" });
  }
}
