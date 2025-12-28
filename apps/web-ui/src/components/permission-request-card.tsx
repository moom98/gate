"use client";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PermissionRequest } from "@/lib/websocket";
import { useState, useMemo } from "react";
import { BrokerAPI } from "@/lib/api";

interface PermissionRequestCardProps {
  request: PermissionRequest;
  brokerUrl: string;
}

export function PermissionRequestCard({ request, brokerUrl }: PermissionRequestCardProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);

  const api = useMemo(() => new BrokerAPI(brokerUrl), [brokerUrl]);

  const handleDecision = async (decision: "allow" | "deny") => {
    setIsProcessing(true);
    setError(null);

    try {
      await api.sendDecision(request.id, decision);
      setResolved(true);
      console.log(`[UI] Decision sent: ${decision} for ${request.id}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      console.error(`[UI] Failed to send decision:`, err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className={resolved ? "border-green-500" : "border-yellow-500"}>
      <CardHeader>
        <CardTitle>{request.summary}</CardTitle>
        <CardDescription>Request ID: {request.id}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div>
          <p className="text-sm font-medium">Command:</p>
          <p className="text-sm text-muted-foreground font-mono">{request.details.command}</p>
        </div>
        <div>
          <p className="text-sm font-medium">Working Directory:</p>
          <p className="text-sm text-muted-foreground font-mono">{request.details.cwd}</p>
        </div>
        <div>
          <p className="text-sm font-medium">Prompt:</p>
          <pre className="text-xs text-muted-foreground bg-muted p-2 rounded overflow-auto max-h-32">
            {request.details.rawPrompt}
          </pre>
        </div>
        {error && (
          <div className="text-sm text-red-500 bg-red-50 p-2 rounded">
            Error: {error}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex gap-2">
        {resolved ? (
          <p className="text-sm text-green-600 font-medium">Decision sent successfully</p>
        ) : (
          <>
            <Button
              onClick={() => handleDecision("allow")}
              disabled={isProcessing}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? "Sending..." : "Allow"}
            </Button>
            <Button
              onClick={() => handleDecision("deny")}
              disabled={isProcessing}
              variant="destructive"
              className="flex-1"
            >
              {isProcessing ? "Sending..." : "Deny"}
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
