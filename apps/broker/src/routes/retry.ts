import { Request, Response } from "express";
import { PermissionRequest } from "../types";
import { pendingRequests } from "../pending-requests";
import { wsManager } from "../websocket";
import { randomUUID } from "crypto";

/**
 * POST /v1/requests/retry/:id
 * Retry a timed-out permission request
 *
 * Creates a new request with the same details but a new ID
 */
export function postRetry(
  req: Request<{ id: string }>,
  res: Response<{ success: boolean; newId?: string }>
) {
  const { id } = req.params;

  // Get the original timeout request
  const originalRequest = pendingRequests.getTimeout(id);

  if (!originalRequest) {
    console.warn(`[Broker] Retry failed: Request ${id} not found in timeout requests`);
    return res.status(404).json({ success: false });
  }

  // Create a new request with the same details but a new ID
  const newRequest: PermissionRequest = {
    ...originalRequest,
    id: randomUUID(),
    timeoutSec: 60,
  };

  console.log(`[Broker] Retrying request ${id} as new request ${newRequest.id}`);

  // Create pending request and broadcast to WebSocket clients
  pendingRequests.create(newRequest);
  wsManager.broadcastRequest(newRequest);

  res.json({ success: true, newId: newRequest.id });
}
