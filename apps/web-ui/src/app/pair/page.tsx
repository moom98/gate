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

  const handlePair = async () => {
    if (!code || code.length !== 6) {
      setError("Please enter a valid 6-digit code");
      return;
    }

    setIsPairing(true);
    setError(null);

    try {
      const response = await fetch(`${BROKER_URL}/v1/pair`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Invalid or expired pairing code");
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success || !data.token || !data.clientId) {
        throw new Error("Invalid response from server");
      }

      // Store token and client ID
      AuthStorage.setToken(data.token, data.clientId);

      console.log("[Pair] Successfully paired with client ID:", data.clientId);

      // Redirect to home page
      router.push("/");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      console.error("[Pair] Failed to pair:", err);
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
              <div className="text-sm text-red-500 bg-red-50 p-3 rounded">
                {error}
              </div>
            )}

            <Button
              onClick={handlePair}
              disabled={isPairing || code.length !== 6}
              className="w-full"
            >
              {isPairing ? "Pairing..." : "Pair Device"}
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
