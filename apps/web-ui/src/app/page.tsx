"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PermissionRequestCard } from "@/components/permission-request-card";
import { ClaudeIdleCard } from "@/components/claude-idle-card";
import { useWebSocket } from "@/lib/websocket";
import { AuthStorage } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const BROKER_URL = process.env.NEXT_PUBLIC_BROKER_URL || "http://localhost:3000";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3000/ws";

export default function Home() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "checking" | "unsupported">("checking");

  useEffect(() => {
    const storedToken = AuthStorage.getToken();
    const storedClientId = AuthStorage.getClientId();

    if (!storedToken) {
      router.push("/pair");
      return;
    }

    setToken(storedToken);
    setClientId(storedClientId);
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }

    setNotificationPermission(Notification.permission);
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      return;
    }

    try {
      const result = await Notification.requestPermission();
      setNotificationPermission(result);
    } catch (error) {
      console.error("[Notifications] Failed to request permission", error);
    }
  }, []);

  const wsUrlWithToken = token ? `${WS_URL}?token=${encodeURIComponent(token)}` : "";
  const { connectionState, requests, claudeIdlePrompt, dismissClaudeIdlePrompt } = useWebSocket(wsUrlWithToken);

  const handleLogout = () => {
    AuthStorage.clearAuth();
    router.push("/pair");
  };

  if (!token) {
    return null; // Redirect in progress
  }

  const getConnectionBadge = () => {
    switch (connectionState) {
      case "connected":
        return <span className="text-green-600">● Connected</span>;
      case "connecting":
        return <span className="text-yellow-600">● Connecting...</span>;
      case "disconnected":
        return <span className="text-gray-600">● Disconnected</span>;
      case "error":
        return <span className="text-red-600">● Error</span>;
    }
  };

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex justify-between items-start">
            <div className="text-center flex-1 space-y-2">
              <h1 className="text-4xl font-bold">Gate</h1>
              <p className="text-muted-foreground">Claude Code Permission Gateway</p>
              <div className="text-sm font-mono">{getConnectionBadge()}</div>
              {clientId && (
                <p className="text-xs text-muted-foreground">
                  Client ID: {clientId.slice(0, 8)}...
                </p>
              )}
            </div>
            <Button onClick={handleLogout} variant="outline" size="sm">
              Logout
            </Button>
          </div>
        </div>

        {claudeIdlePrompt && (
          <ClaudeIdleCard prompt={claudeIdlePrompt} onDismiss={dismissClaudeIdlePrompt} />
        )}

        {notificationPermission !== "granted" &&
          notificationPermission !== "unsupported" &&
          notificationPermission !== "checking" && (
          <Card className="border-blue-500 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-blue-900">Enable Desktop Notifications</CardTitle>
              <CardDescription className="text-blue-800">
                Allow Gate to send macOS notifications for Claude requests and idle events.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {notificationPermission === "denied" ? (
                <p className="text-sm text-blue-900">
                  Notifications are blocked in your browser. Please enable them in Settings &gt; Notifications.
                </p>
              ) : (
                <Button onClick={requestNotificationPermission} className="bg-blue-600 hover:bg-blue-700">
                  Allow Notifications
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Permission Requests</CardTitle>
            <CardDescription>
              Approve or deny command execution requests from Claude Code CLI
            </CardDescription>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No pending requests. Waiting for Claude Code CLI...
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">
                {requests.length} pending {requests.length === 1 ? "request" : "requests"}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Permission Requests */}
        <div className="space-y-4">
          {requests.map((request) => (
            <PermissionRequestCard
              key={request.id}
              request={request}
              brokerUrl={BROKER_URL}
            />
          ))}
        </div>

        {/* Footer Info */}
        {(connectionState === "disconnected" || connectionState === "error") && (
          <Card className={connectionState === "error" ? "border-red-500 bg-red-50" : "border-yellow-500 bg-yellow-50"}>
            <CardContent className="pt-6">
              <p className={connectionState === "error" ? "text-sm text-red-800" : "text-sm text-yellow-800"}>
                {connectionState === "error" ? (
                  <>Connection error. Failed to connect to broker at{" "}
                  <code className="font-mono bg-red-100 px-1 rounded">{BROKER_URL}</code></>
                ) : (
                  <>Not connected to broker. Make sure the broker is running at{" "}
                  <code className="font-mono bg-yellow-100 px-1 rounded">{BROKER_URL}</code></>
                )}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
