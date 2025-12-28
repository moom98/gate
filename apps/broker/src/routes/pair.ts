import { Router, Request, Response } from "express";
import { AuthService } from "../auth";
import { PairingCodeStore } from "../pairing-codes";
import crypto from "crypto";

export function createPairRouter(
  authService: AuthService,
  pairingCodeStore: PairingCodeStore
): Router {
  const router = Router();

  /**
   * POST /v1/pair
   * Pair a client using a pairing code
   */
  router.post("/", (req: Request, res: Response) => {
    const { code } = req.body;

    if (!code || typeof code !== "string") {
      return res.status(400).json({
        success: false,
        error: "Missing or invalid pairing code",
      });
    }

    // Validate and consume the pairing code
    const isValid = pairingCodeStore.validateAndConsume(code);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired pairing code",
      });
    }

    // Generate a unique client ID
    const clientId = crypto.randomUUID();

    // Generate JWT token
    const token = authService.generateToken(clientId);

    console.log(`[Pair] Client paired successfully: ${clientId}`);

    return res.json({
      success: true,
      token,
      clientId,
    });
  });

  /**
   * POST /v1/pair/generate
   * Generate a new pairing code (for testing/admin use)
   */
  router.post("/generate", (req: Request, res: Response) => {
    const code = pairingCodeStore.generateCode();

    return res.json({
      success: true,
      code,
      expiresIn: "5 minutes",
    });
  });

  return router;
}
