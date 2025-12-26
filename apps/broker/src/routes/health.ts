import { Request, Response } from "express";
import { HealthResponse } from "../types";

/**
 * GET /health
 * Health check endpoint
 */
export function getHealth(_req: Request, res: Response<HealthResponse>) {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "0.0.1",
  });
}
