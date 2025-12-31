import { PermissionRequest } from "./types";

/**
 * Rule for always allowing specific permission requests
 */
interface AlwaysAllowRule {
  /** Pattern to match command */
  commandPattern: string;
  /** Pattern to match working directory */
  cwdPattern: string;
  /** Timestamp when rule was created (for future expiration features) */
  createdAt: Date;
}

/**
 * Manages always-allow rules with limits and expiration
 */
class AlwaysAllowRuleStore {
  private rules: AlwaysAllowRule[] = [];
  private readonly MAX_RULES = 100;
  private readonly RULE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Add a new always-allow rule based on a request
   */
  add(request: PermissionRequest): void {
    // Clean up expired rules before adding
    this.cleanupExpiredRules();

    const rule: AlwaysAllowRule = {
      commandPattern: request.details.command,
      cwdPattern: request.details.cwd,
      createdAt: new Date(),
    };

    // Check if rule already exists
    const exists = this.rules.some(
      (r) => r.commandPattern === rule.commandPattern && r.cwdPattern === rule.cwdPattern
    );

    if (!exists) {
      // Enforce max rule limit (remove oldest if at limit)
      if (this.rules.length >= this.MAX_RULES) {
        const removed = this.rules.shift();
        console.log(
          `[Broker] Removed oldest always-allow rule (limit reached): ${removed?.commandPattern}`
        );
      }

      this.rules.push(rule);
      console.log(
        `[Broker] Added always-allow rule: ${rule.commandPattern} in ${rule.cwdPattern}`
      );
    }
  }

  /**
   * Check if a request matches any always-allow rule
   */
  matches(request: PermissionRequest): boolean {
    // Clean up expired rules before matching
    this.cleanupExpiredRules();

    return this.rules.some((rule) => {
      const commandMatch = request.details.command === rule.commandPattern;
      const cwdMatch = request.details.cwd === rule.cwdPattern;
      return commandMatch && cwdMatch;
    });
  }

  /**
   * Get all rules
   */
  getAll(): readonly AlwaysAllowRule[] {
    return [...this.rules];
  }

  /**
   * Clear all rules
   */
  clear(): void {
    this.rules = [];
    console.log("[Broker] Cleared all always-allow rules");
  }

  /**
   * Remove expired rules (older than TTL)
   */
  private cleanupExpiredRules(): void {
    const now = Date.now();
    const initialCount = this.rules.length;

    this.rules = this.rules.filter((rule) => {
      const age = now - rule.createdAt.getTime();
      return age < this.RULE_TTL_MS;
    });

    const removedCount = initialCount - this.rules.length;
    if (removedCount > 0) {
      console.log(`[Broker] Cleaned up ${removedCount} expired always-allow rules`);
    }
  }
}

export const alwaysAllowRules = new AlwaysAllowRuleStore();
