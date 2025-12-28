"use client";

import { useEffect, useState, useRef } from "react";

/**
 * WebSocket message types from broker
 */
export type WSMessage =
  | { type: "permission_request"; payload: PermissionRequest }
  | {
      type: "permission_resolved";
      payload: { id: string; decision: "allow" | "deny" };
    };

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
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isMountedRef = useRef(true);
  const removeTimeoutsRef = useRef<Set<NodeJS.Timeout>>(new Set());

  useEffect(() => {
    isMountedRef.current = true;
    const removeTimeouts = removeTimeoutsRef.current;

    const connect = () => {
      if (!isMountedRef.current) {
        return; // Prevent connection after unmount
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
              setRequests((prev) => new Map(prev).set(message.payload.id, message.payload));
            } else if (message.type === "permission_resolved") {
              console.log(
                "[WebSocket] Permission resolved:",
                message.payload.id,
                message.payload.decision
              );
              // Remove resolved request after a delay to show the result
              const timeoutId = setTimeout(() => {
                if (isMountedRef.current) {
                  setRequests((prev) => {
                    const next = new Map(prev);
                    next.delete(message.payload.id);
                    return next;
                  });
                }
                removeTimeouts.delete(timeoutId);
              }, 3000);
              removeTimeouts.add(timeoutId);
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

  return {
    connectionState,
    requests: Array.from(requests.values()),
  };
}
