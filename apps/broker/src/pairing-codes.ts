import crypto from "crypto";

/**
 * Pairing code entry
 */
interface PairingCodeEntry {
  code: string;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * In-memory pairing code store
 * Codes are short-lived (default 5 minutes)
 */
export class PairingCodeStore {
  private codes: Map<string, PairingCodeEntry> = new Map();
  private codeExpiryMinutes: number;

  constructor(codeExpiryMinutes: number = 5) {
    this.codeExpiryMinutes = codeExpiryMinutes;

    // Clean up expired codes every minute
    setInterval(() => {
      this.cleanupExpiredCodes();
    }, 60 * 1000);
  }

  /**
   * Generate a new 6-digit pairing code
   */
  generateCode(): string {
    const code = crypto.randomInt(100000, 999999).toString();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.codeExpiryMinutes * 60 * 1000);

    const entry: PairingCodeEntry = {
      code,
      createdAt: now,
      expiresAt,
    };

    this.codes.set(code, entry);
    console.log(`[PairingCode] Generated code: ${code} (expires at ${expiresAt.toISOString()})`);

    return code;
  }

  /**
   * Validate and consume a pairing code
   * Returns true if valid, false otherwise
   * Valid codes are removed after use (one-time use)
   */
  validateAndConsume(code: string): boolean {
    const entry = this.codes.get(code);

    if (!entry) {
      console.log(`[PairingCode] Code not found: ${code}`);
      return false;
    }

    const now = new Date();
    if (now > entry.expiresAt) {
      console.log(`[PairingCode] Code expired: ${code}`);
      this.codes.delete(code);
      return false;
    }

    // Consume the code (one-time use)
    this.codes.delete(code);
    console.log(`[PairingCode] Code validated and consumed: ${code}`);
    return true;
  }

  /**
   * Clean up expired codes
   */
  private cleanupExpiredCodes(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [code, entry] of this.codes.entries()) {
      if (now > entry.expiresAt) {
        this.codes.delete(code);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[PairingCode] Cleaned up ${cleanedCount} expired codes`);
    }
  }

  /**
   * Get count of active pairing codes
   */
  getActiveCount(): number {
    return this.codes.size;
  }
}
