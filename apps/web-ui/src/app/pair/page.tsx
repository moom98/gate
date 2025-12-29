"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { AuthStorage } from "@/lib/auth";
import { useRouter } from "next/navigation";

const BROKER_URL = process.env.NEXT_PUBLIC_BROKER_URL || "http://localhost:3000";

export default function PairPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [isPairing, setIsPairing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);

  const handlePair = async () => {
    if (!code || code.length !== 6) {
      setError("Please enter a valid 6-digit code");
      return;
    }

    setIsPairing(true);
    setError(null);

    console.log("[Pair] Starting pairing request to:", `${BROKER_URL}/v1/pair`);
    console.log("[Pair] Code length:", code.length);

    try {
      // Add timeout to fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`${BROKER_URL}/v1/pair`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log("[Pair] Response status:", response.status);
      console.log("[Pair] Response headers:", Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Invalid or expired pairing code");
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("[Pair] Response data:", data);

      if (!data.success || !data.token || !data.clientId) {
        throw new Error("Invalid response from server");
      }

      // Store token and client ID
      AuthStorage.setToken(data.token, data.clientId);

      console.log("[Pair] Successfully paired with client ID:", data.clientId);

      // Redirect to home page
      router.push("/");
    } catch (err) {
      let errorMessage = "Unknown error";

      if (err instanceof Error) {
        if (err.name === "AbortError") {
          errorMessage = `Request timed out. Please check if broker is running at ${BROKER_URL}`;
        } else if (err.message.includes("fetch")) {
          errorMessage = `Cannot connect to broker at ${BROKER_URL}. Please verify:\n1. Broker is running (cd apps/broker && pnpm dev)\n2. Broker URL is correct\n3. No firewall blocking the connection`;
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
      console.error("[Pair] Failed to pair:", err);
      console.error("[Pair] Error details:", {
        name: err instanceof Error ? err.name : "unknown",
        message: err instanceof Error ? err.message : String(err),
        brokerUrl: BROKER_URL,
      });
    } finally {
      setIsPairing(false);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
    setCode(value);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handlePair();
    }
  };

  const checkBrokerConnection = async () => {
    setIsCheckingConnection(true);
    setConnectionStatus(null);

    try {
      console.log("[Pair] Checking broker connection at:", `${BROKER_URL}/health`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(`${BROKER_URL}/health`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        setConnectionStatus(`✅ Broker is reachable (${data.status || "ok"})`);
        console.log("[Pair] Broker health check success:", data);
      } else {
        setConnectionStatus(`⚠️ Broker responded with status ${response.status}`);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setConnectionStatus(`❌ Connection timeout - broker may not be running at ${BROKER_URL}`);
      } else {
        setConnectionStatus(`❌ Cannot connect to broker at ${BROKER_URL}`);
      }
      console.error("[Pair] Broker health check failed:", err);
    } finally {
      setIsCheckingConnection(false);
    }
  };

  return (
    <main className="min-h-screen p-8 bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">Gate</h1>
          <p className="text-muted-foreground">Pair with Broker</p>
        </div>

        {/* Pairing Card */}
        <Card>
          <CardHeader>
            <CardTitle>Enter Pairing Code</CardTitle>
            <CardDescription>
              Enter the 6-digit code displayed in the broker console
            </CardDescription>
            <div className="text-xs text-muted-foreground pt-2">
              Broker URL: <code className="bg-gray-100 px-1 py-0.5 rounded">{BROKER_URL}</code>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={handleCodeChange}
                onKeyPress={handleKeyPress}
                placeholder="000000"
                disabled={isPairing}
                className="w-full px-4 py-3 text-center text-2xl font-mono border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
            </div>

            {error && (
              <div className="text-sm text-red-500 bg-red-50 p-3 rounded whitespace-pre-line">
                {error}
              </div>
            )}

            {connectionStatus && (
              <div className="text-sm p-3 rounded bg-gray-50 border border-gray-200">
                {connectionStatus}
              </div>
            )}

            <Button
              onClick={handlePair}
              disabled={isPairing || code.length !== 6}
              className="w-full"
            >
              {isPairing ? "Pairing..." : "Pair Device"}
            </Button>

            <Button
              onClick={checkBrokerConnection}
              disabled={isCheckingConnection}
              variant="outline"
              className="w-full"
            >
              {isCheckingConnection ? "Checking..." : "Test Broker Connection"}
            </Button>

            <div className="text-xs text-muted-foreground text-center pt-2">
              <p>Pairing codes expire after 5 minutes</p>
              <p className="mt-1">
                Don&apos;t have a code? Check the broker console or generate a new one
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
