import jwt from "jsonwebtoken";
import crypto from "crypto";

/**
 * JWT token payload
 */
export interface TokenPayload {
  clientId: string;
  iat: number;
  exp: number;
}

/**
 * Token generation and validation
 */
export class AuthService {
  private secret: string;
  private tokenExpiryDays: number;

  constructor(secret?: string, tokenExpiryDays: number = 30) {
    this.secret = secret || this.generateSecret();
    this.tokenExpiryDays = tokenExpiryDays;
  }

  /**
   * Generate a random secret for JWT signing
   */
  private generateSecret(): string {
    return crypto.randomBytes(64).toString("hex");
  }

  /**
   * Generate a JWT token for a client
   */
  generateToken(clientId: string): string {
    const payload: Omit<TokenPayload, "iat" | "exp"> = {
      clientId,
    };

    return jwt.sign(payload, this.secret, {
      expiresIn: `${this.tokenExpiryDays}d`,
    });
  }

  /**
   * Verify and decode a JWT token
   */
  verifyToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.secret) as TokenPayload;
      return decoded;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[Auth] Token verification failed:", message);
      return null;
    }
  }

  /**
   * Extract token from Authorization header
   */
  extractBearerToken(authHeader: string | undefined): string | null {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return null;
    }

    return parts[1];
  }
}
