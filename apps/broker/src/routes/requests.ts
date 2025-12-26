import { Request, Response } from "express";
import { PermissionRequest, PermissionResponse } from "../types";

/**
 * POST /v1/requests
 * Receive permission request from adapter
 *
 * TODO (Step 4): Implement deferred response pattern with WebSocket broadcast
 * For now, returns deny immediately
 */
export function postRequests(
  req: Request<unknown, PermissionResponse, PermissionRequest>,
  res: Response<PermissionResponse>
) {
  const request = req.body;

  console.log("[Broker] Received permission request:", {
    id: request.id,
    summary: request.summary,
    cwd: request.details.cwd,
    command: request.details.command,
  });

  // TODO: Create pending request, broadcast to WebSocket clients, wait for decision
  // For now, immediately deny all requests
  res.json({
    decision: "deny",
  });
}
