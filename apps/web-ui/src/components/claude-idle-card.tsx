"use client";

import { CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClaudeIdlePrompt } from "@/lib/websocket";

interface ClaudeIdleCardProps {
  prompt: ClaudeIdlePrompt;
  onDismiss: () => void;
}

export function ClaudeIdleCard({ prompt, onDismiss }: ClaudeIdleCardProps) {
  const receivedAt = getFormattedTime(prompt.ts);
  const projectLabel = prompt.project ? `Project: ${prompt.project}` : "Waiting for your input";

  return (
    <Card className="border-green-500 bg-green-50">
      <CardHeader className="flex flex-row items-start gap-3">
        <div className="rounded-full bg-green-100 p-2 text-green-600">
          <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="flex-1 space-y-1">
          <CardTitle className="text-green-900">Claude is Ready</CardTitle>
          <CardDescription className="text-green-800">{projectLabel}</CardDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-green-900"
          onClick={onDismiss}
          aria-label="Dismiss Claude idle card"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </CardHeader>
      <CardContent className="text-sm text-green-900">
        <p className="text-muted-foreground">
          Claude reported an idle prompt via the Claude API.{" "}
          {receivedAt ? `Received at ${receivedAt}.` : ""}
        </p>
      </CardContent>
    </Card>
  );
}

function getFormattedTime(timestamp: string): string | null {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).format(date);
}
