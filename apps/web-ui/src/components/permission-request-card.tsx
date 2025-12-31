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
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [retrySuccess, setRetrySuccess] = useState(false);

  const api = useMemo(() => new BrokerAPI(brokerUrl), [brokerUrl]);

  // Truncate summary to 80 characters
  const truncatedSummary = useMemo(() => {
    if (request.summary.length <= 80) {
      return request.summary;
    }
    return request.summary.slice(0, 77) + "...";
  }, [request.summary]);

  // Truncate raw prompt to 100 characters when collapsed
  const displayPrompt = useMemo(() => {
    if (isPromptExpanded || request.details.rawPrompt.length <= 100) {
      return request.details.rawPrompt;
    }
    return request.details.rawPrompt.slice(0, 97) + "...";
  }, [request.details.rawPrompt, isPromptExpanded]);

  const handleDecision = async (decision: "allow" | "deny" | "alwaysAllow") => {
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

  const handleRetry = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await api.retryRequest(request.id);
      if (response.success && response.newId) {
        console.log(`[UI] Retry successful, new request ID: ${response.newId}`);
        setRetrySuccess(true);
        // The new request will appear via WebSocket
      } else {
        setError("Request not found or expired");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      console.error(`[UI] Failed to retry request:`, err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Determine card border color
  const borderColor = resolved || retrySuccess
    ? "border-green-500"
    : request.isTimeout
      ? "border-orange-500"
      : "border-yellow-500";

  return (
    <Card className={borderColor}>
      <CardHeader>
        <CardTitle>{truncatedSummary}</CardTitle>
        <CardDescription>
          Request ID: {request.id}
          {request.isTimeout && <span className="ml-2 text-orange-600 font-medium">(Timed Out)</span>}
        </CardDescription>
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
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium">Prompt:</p>
            {request.details.rawPrompt.length > 100 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsPromptExpanded(!isPromptExpanded)}
                className="h-6 text-xs"
              >
                {isPromptExpanded ? "Show less" : "Show more"}
              </Button>
            )}
          </div>
          <pre className="text-xs text-muted-foreground bg-muted p-2 rounded overflow-auto max-h-32">
            {displayPrompt}
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
        ) : retrySuccess ? (
          <p className="text-sm text-green-600 font-medium">Retry successful - new request created</p>
        ) : request.isTimeout ? (
          <Button
            onClick={handleRetry}
            disabled={isProcessing}
            className="flex-1 bg-orange-600 hover:bg-orange-700"
          >
            {isProcessing ? "Retrying..." : "Retry"}
          </Button>
        ) : (
          <>
            <Button
              onClick={() => handleDecision("deny")}
              disabled={isProcessing}
              variant="destructive"
              className="flex-1"
            >
              {isProcessing ? "Sending..." : "Deny"}
            </Button>
            {request.allowAlwaysAllow && (
              <Button
                onClick={() => handleDecision("alwaysAllow")}
                disabled={isProcessing}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {isProcessing ? "Sending..." : "Always Allow"}
              </Button>
            )}
            <Button
              onClick={() => handleDecision("allow")}
              disabled={isProcessing}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? "Sending..." : "Allow"}
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
