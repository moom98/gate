"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PermissionRequestCard } from "@/components/permission-request-card";
import { useWebSocket } from "@/lib/websocket";

const BROKER_URL = process.env.NEXT_PUBLIC_BROKER_URL || "http://localhost:3000";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3000/ws";

export default function Home() {
  const { connectionState, requests } = useWebSocket(WS_URL);

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
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">Gate</h1>
          <p className="text-muted-foreground">Claude Code Permission Gateway</p>
          <div className="text-sm font-mono">{getConnectionBadge()}</div>
        </div>

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
                  <>Connection error. Failed to connect to broker at {" "}
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
