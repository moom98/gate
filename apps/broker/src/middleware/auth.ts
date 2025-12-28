import { Request, Response, NextFunction } from "express";
import { AuthService } from "../auth";

/**
 * Middleware to require Bearer token authentication
 */
export function requireAuth(authService: AuthService) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = authService.extractBearerToken(authHeader);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Missing or invalid Authorization header",
      });
    }

    const payload = authService.verifyToken(token);

    if (!payload) {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired token",
      });
    }

    // Attach client ID to request for downstream use
    (req as Request & { clientId: string }).clientId = payload.clientId;

    next();
  };
}
