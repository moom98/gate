import { PermissionRequest } from "./types";

/**
 * Rule for always allowing specific permission requests
 */
interface AlwaysAllowRule {
  /** Pattern to match command */
  commandPattern: string;
  /** Pattern to match working directory */
  cwdPattern: string;
  /** Timestamp when rule was created */
  createdAt: Date;
}

/**
 * Manages always-allow rules
 */
class AlwaysAllowRuleStore {
  private rules: AlwaysAllowRule[] = [];

  /**
   * Add a new always-allow rule based on a request
   */
  add(request: PermissionRequest): void {
    const rule: AlwaysAllowRule = {
      commandPattern: this.escapeRegex(request.details.command),
      cwdPattern: this.escapeRegex(request.details.cwd),
      createdAt: new Date(),
    };

    // Check if rule already exists
    const exists = this.rules.some(
      (r) => r.commandPattern === rule.commandPattern && r.cwdPattern === rule.cwdPattern
    );

    if (!exists) {
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
   * Escape special regex characters for exact string matching
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}

export const alwaysAllowRules = new AlwaysAllowRuleStore();
