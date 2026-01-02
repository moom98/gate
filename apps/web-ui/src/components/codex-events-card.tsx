"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CodexTurnComplete } from "@/lib/websocket";
import { Terminal, X, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface CodexEventsCardProps {
  events: CodexTurnComplete[];
  onDismiss: (threadId: string) => void;
}

export function CodexEventsCard({ events, onDismiss }: CodexEventsCardProps) {
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  if (events.length === 0) {
    return null;
  }

  const toggleExpand = (threadId: string) => {
    const next = new Set(expandedEvents);
    if (next.has(threadId)) {
      next.delete(threadId);
    } else {
      next.add(threadId);
    }
    setExpandedEvents(next);
  };

  return (
    <Card className="border-purple-500 bg-purple-50">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-purple-600" />
            <div>
              <CardTitle className="text-purple-900">Codex Activity</CardTitle>
              <CardDescription className="text-purple-800">
                Recent agent turn completions
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {events.map((event) => {
          const isExpanded = expandedEvents.has(event.threadId);
          const timestamp = getFormattedTime(event.ts);
          const shortThreadId = event.threadId.slice(0, 8);
          const shortCwd = truncatePath(event.cwd, 40);

          return (
            <div
              key={event.threadId}
              className="bg-white rounded-lg border border-purple-200 p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-mono">
                      {shortThreadId}...
                    </code>
                    {timestamp && (
                      <span className="text-xs text-purple-600">{timestamp}</span>
                    )}
                  </div>
                  <p className="text-sm text-purple-900 font-medium">
                    {event.message || 'Agent turn completed'}
                  </p>
                  <p className="text-xs text-purple-700 font-mono mt-1">
                    {shortCwd}
                  </p>
                </div>
                <div className="flex items-start gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-purple-600"
                    onClick={() => toggleExpand(event.threadId)}
                    aria-label={isExpanded ? "Collapse details" : "Expand details"}
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-purple-600"
                    onClick={() => onDismiss(event.threadId)}
                    aria-label="Dismiss event"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {isExpanded && (
                <div className="pt-2 border-t border-purple-200 space-y-1">
                  <div className="text-xs">
                    <span className="font-medium text-purple-800">Thread ID:</span>
                    <code className="ml-2 bg-purple-100 text-purple-900 px-1 rounded font-mono">
                      {event.threadId}
                    </code>
                  </div>
                  <div className="text-xs">
                    <span className="font-medium text-purple-800">Directory:</span>
                    <code className="ml-2 bg-purple-100 text-purple-900 px-1 rounded font-mono">
                      {event.cwd}
                    </code>
                  </div>
                  <div className="text-xs">
                    <span className="font-medium text-purple-800">Timestamp:</span>
                    <span className="ml-2 text-purple-900">{event.ts}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
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

function truncatePath(path: string, maxLength: number): string {
  if (path.length <= maxLength) {
    return path;
  }
  // Show beginning and end of path
  const keep = Math.floor((maxLength - 3) / 2);
  return path.slice(0, keep) + '...' + path.slice(-keep);
}
