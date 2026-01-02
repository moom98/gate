"use client";

import { useEffect, useState, useRef, useCallback } from "react";

/**
 * WebSocket message types from broker
 */
export type WSMessage =
  | { type: "permission_request"; payload: PermissionRequest }
  | {
      type: "permission_resolved";
      payload: { id: string; decision: "allow" | "deny" | "alwaysAllow"; reason?: "timeout" | "manual" };
    }
  | {
      type: "claude_idle_prompt";
      payload: ClaudeIdlePrompt;
    }
  | {
      type: "codex_turn_complete";
      payload: CodexTurnComplete;
    };

export interface ClaudeIdlePrompt {
  type: "idle_prompt";
  raw?: unknown;
  ts: string;
  project?: string;
}

export interface CodexTurnComplete {
  type: "agent-turn-complete";
  threadId: string;
  cwd: string;
  raw?: unknown;
  ts: string;
  message?: string;
}

/**
 * Permission request from broker
 */
export interface PermissionRequest {
  id: string;
  summary: string;
  details: {
    cwd: string;
    command: string;
    rawPrompt: string;
  };
  timeoutSec?: number;
  isTimeout?: boolean;
  allowAlwaysAllow?: boolean;
}

/**
 * WebSocket connection state
 */
export type ConnectionState = "connecting" | "connected" | "disconnected" | "error";

/**
 * WebSocket hook for broker connection
 */
export function useWebSocket(url: string) {
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [requests, setRequests] = useState<Map<string, PermissionRequest>>(new Map());
  const [claudeIdlePrompt, setClaudeIdlePrompt] = useState<ClaudeIdlePrompt | null>(null);
  const [codexEvents, setCodexEvents] = useState<CodexTurnComplete[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isMountedRef = useRef(true);
  const removeTimeoutsRef = useRef<Set<NodeJS.Timeout>>(new Set());
  const lastCodexThreadRef = useRef<{ threadId: string; timestamp: number } | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    const removeTimeouts = removeTimeoutsRef.current;

    const connect = () => {
      if (!isMountedRef.current) {
        return; // Prevent connection after unmount
      }

      // Don't connect with empty URL (wait for token to load)
      if (!url) {
        setConnectionState("disconnected");
        return;
      }

      // Close existing WebSocket if URL changed
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close();
        wsRef.current = null;
      }

      try {
        setConnectionState("connecting");
        const ws = new WebSocket(url);

        ws.onopen = () => {
          console.log("[WebSocket] Connected to broker");
          setConnectionState("connected");
          reconnectAttemptsRef.current = 0;
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as WSMessage;

            if (message.type === "permission_request") {
              console.log("[WebSocket] Received permission request:", message.payload.id);
              setRequests((prev) => {
                const next = new Map(prev);
                const isNewRequest = !next.has(message.payload.id);
                next.set(message.payload.id, message.payload);

                if (isNewRequest) {
                  sendDesktopNotification("新しい権限リクエスト", {
                    body: message.payload.summary,
                    tag: message.payload.id,
                  });
                }

                return next;
              });
              setClaudeIdlePrompt(null);
            } else if (message.type === "permission_resolved") {
              console.log(
                "[WebSocket] Permission resolved:",
                message.payload.id,
                message.payload.decision,
                "reason:",
                message.payload.reason || "none"
              );

              // Handle timeout vs manual resolution
              if (message.payload.reason === "timeout") {
                // Mark request as timed out instead of removing it
                setRequests((prev) => {
                  const next = new Map(prev);
                  const request = next.get(message.payload.id);
                  if (request) {
                    next.set(message.payload.id, { ...request, isTimeout: true });
                  }
                  return next;
                });
              } else {
                // Remove resolved request immediately
                setRequests((prev) => {
                  const next = new Map(prev);
                  next.delete(message.payload.id);
                  return next;
                });
              }
            } else if (message.type === "claude_idle_prompt") {
              console.log("[WebSocket] Claude idle prompt received");
              setClaudeIdlePrompt(message.payload);
              sendDesktopNotification("Claude が待機中", {
                body: message.payload.project ? `${message.payload.project} で入力待ちです` : "入力を待機しています",
                tag: `claude-idle-${message.payload.ts}`,
              });
            } else if (message.type === "codex_turn_complete") {
              console.log("[WebSocket] Codex turn complete received:", message.payload.threadId);

              // Deduplication: Ignore same threadId within 5 seconds
              const now = Date.now();
              const last = lastCodexThreadRef.current;
              if (last && last.threadId === message.payload.threadId && (now - last.timestamp) < 5000) {
                console.log("[WebSocket] Ignoring duplicate Codex event for threadId:", message.payload.threadId);
                return;
              }

              lastCodexThreadRef.current = { threadId: message.payload.threadId, timestamp: now };

              // Add to events list (keep last 10)
              setCodexEvents((prev) => {
                const next = [message.payload, ...prev];
                return next.slice(0, 10);
              });

              // Send notification
              sendDesktopNotification("Codex Agent Complete", {
                body: message.payload.message || `Thread ${message.payload.threadId.slice(0, 8)}... in ${message.payload.cwd}`,
                tag: `codex-turn-${message.payload.threadId}`,
              });
            }
          } catch (error) {
            console.error("[WebSocket] Failed to parse message:", error);
          }
        };

        ws.onerror = (error) => {
          console.error("[WebSocket] Error:", error);
          setConnectionState("error");
        };

        ws.onclose = () => {
          console.log("[WebSocket] Disconnected");
          setConnectionState("disconnected");
          wsRef.current = null;

          // Only attempt reconnection if component is still mounted
          if (!isMountedRef.current) {
            return;
          }

          // Attempt reconnection with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          console.log(`[WebSocket] Reconnecting in ${delay}ms...`);
          reconnectAttemptsRef.current++;

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        };

        wsRef.current = ws;
      } catch (error) {
        console.error("[WebSocket] Connection failed:", error);
        setConnectionState("error");
      }
    };

    connect();

    return () => {
      isMountedRef.current = false;

      // Clear reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Clear all pending remove timeouts
      removeTimeouts.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      removeTimeouts.clear();

      // Close WebSocket connection
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [url]);

  const dismissClaudeIdlePrompt = useCallback(() => {
    setClaudeIdlePrompt(null);
  }, []);

  const dismissCodexEvent = useCallback((threadId: string) => {
    setCodexEvents((prev) => prev.filter((e) => e.threadId !== threadId));
  }, []);

  return {
    connectionState,
    requests: Array.from(requests.values()),
    claudeIdlePrompt,
    dismissClaudeIdlePrompt,
    codexEvents,
    dismissCodexEvent,
  };
}

function sendDesktopNotification(title: string, options?: NotificationOptions) {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return;
  }

  if (Notification.permission !== "granted") {
    return;
  }

  try {
    new Notification(title, options);
  } catch (error) {
    console.error("[Notification] Failed to show notification:", error);
  }
}
