"use client";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PermissionRequest } from "@/lib/websocket";
import { useState, useMemo } from "react";
import { BrokerAPI } from "@/lib/api";
import { ChevronDown, ChevronUp } from "lucide-react";

interface PermissionRequestCardProps {
  request: PermissionRequest;
  brokerUrl: string;
}

export function PermissionRequestCard({ request, brokerUrl }: PermissionRequestCardProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());
  const [retrySuccess, setRetrySuccess] = useState(false);

  const api = useMemo(() => new BrokerAPI(brokerUrl), [brokerUrl]);

  const toggleField = (field: string) => {
    const newExpanded = new Set(expandedFields);
    if (newExpanded.has(field)) {
      newExpanded.delete(field);
    } else {
      newExpanded.add(field);
    }
    setExpandedFields(newExpanded);
  };

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
        <CardTitle className="line-clamp-2">{request.summary}</CardTitle>
        <CardDescription>
          Request ID: {request.id}
          {request.isTimeout && <span className="ml-2 text-orange-600 font-medium">(Timed Out)</span>}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Command Field */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium">Command:</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleField("command")}
              className="h-6 text-xs p-1"
              aria-label={expandedFields.has("command") ? "Collapse command" : "Expand command"}
            >
              {expandedFields.has("command") ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </Button>
          </div>
          <p
            className={`text-sm text-muted-foreground font-mono cursor-pointer ${expandedFields.has("command") ? "" : "line-clamp-2"}`}
            onClick={() => toggleField("command")}
          >
            {request.details.command}
          </p>
        </div>

        {/* Working Directory Field */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium">Working Directory:</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleField("directory")}
              className="h-6 text-xs p-1"
              aria-label={expandedFields.has("directory") ? "Collapse directory" : "Expand directory"}
            >
              {expandedFields.has("directory") ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </Button>
          </div>
          <p
            className={`text-sm text-muted-foreground font-mono cursor-pointer ${expandedFields.has("directory") ? "" : "line-clamp-2"}`}
            onClick={() => toggleField("directory")}
          >
            {request.details.cwd}
          </p>
        </div>

        {/* Prompt Field */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium">Prompt:</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleField("prompt")}
              className="h-6 text-xs p-1"
              aria-label={expandedFields.has("prompt") ? "Collapse prompt" : "Expand prompt"}
            >
              {expandedFields.has("prompt") ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </Button>
          </div>
          <pre
            className={`text-xs text-muted-foreground bg-muted p-2 rounded overflow-auto cursor-pointer ${expandedFields.has("prompt") ? "max-h-96" : "line-clamp-2"}`}
            onClick={() => toggleField("prompt")}
          >
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
