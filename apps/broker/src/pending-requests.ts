import { PermissionRequest, PermissionResponse } from "./types";

/**
 * Deferred promise for pending requests
 */
interface DeferredDecision {
  promise: Promise<PermissionResponse>;
  resolve: (decision: PermissionResponse) => void;
  reject: (error: Error) => void;
  timeoutId: NodeJS.Timeout;
  request: PermissionRequest;
  resolved: boolean;
}

/**
 * In-memory store for pending permission requests
 */
class PendingRequestStore {
  private pending = new Map<string, DeferredDecision>();
  private timeoutRequests = new Map<string, PermissionRequest>();

  /**
   * Create a new pending request with timeout
   */
  create(request: PermissionRequest): Promise<PermissionResponse> {
    const timeoutSec = request.timeoutSec ?? 60;

    let resolve: (decision: PermissionResponse) => void;
    let reject: (error: Error) => void;

    const promise = new Promise<PermissionResponse>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    // Set up timeout to auto-deny
    const timeoutId = setTimeout(() => {
      console.log(
        `[Broker] Request ${request.id} timed out after ${timeoutSec}s, auto-denying`
      );
      this.resolve(request.id, { decision: "deny" });

      // Store in timeout requests for retry functionality (keep for 5 minutes)
      this.timeoutRequests.set(request.id, request);
      setTimeout(() => {
        this.timeoutRequests.delete(request.id);
        console.log(`[Broker] Timeout request ${request.id} expired (5 min cleanup)`);
      }, 5 * 60 * 1000);
    }, timeoutSec * 1000);

    const deferred: DeferredDecision = {
      promise,
      resolve: resolve!,
      reject: reject!,
      timeoutId,
      request,
      resolved: false,
    };

    this.pending.set(request.id, deferred);

    console.log(
      `[Broker] Created pending request ${request.id} with ${timeoutSec}s timeout`
    );

    return promise;
  }

  /**
   * Resolve a pending request with a decision
   * Returns true if resolved, false if already resolved or not found
   */
  resolve(id: string, decision: PermissionResponse): boolean {
    const deferred = this.pending.get(id);

    if (!deferred) {
      console.warn(`[Broker] Request ${id} not found`);
      return false;
    }

    if (deferred.resolved) {
      console.warn(`[Broker] Request ${id} already resolved`);
      return false;
    }

    // Mark as resolved and clear timeout
    deferred.resolved = true;
    clearTimeout(deferred.timeoutId);

    // Resolve the promise
    deferred.resolve(decision);

    console.log(`[Broker] Resolved request ${id} with decision: ${decision.decision}`);

    // Clean up after a short delay to allow response to be sent
    setTimeout(() => {
      this.pending.delete(id);
    }, 1000);

    return true;
  }

  /**
   * Get pending request by ID
   */
  get(id: string): PermissionRequest | undefined {
    return this.pending.get(id)?.request;
  }

  /**
   * Check if request is already resolved
   */
  isResolved(id: string): boolean {
    return this.pending.get(id)?.resolved ?? false;
  }

  /**
   * Get all pending (unresolved) requests
   */
  getPending(): PermissionRequest[] {
    return Array.from(this.pending.values())
      .filter((d) => !d.resolved)
      .map((d) => d.request);
  }

  /**
   * Get timeout request by ID (for retry functionality)
   */
  getTimeout(id: string): PermissionRequest | undefined {
    return this.timeoutRequests.get(id);
  }
}

// Singleton instance
export const pendingRequests = new PendingRequestStore();
