import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { getHealth } from "./routes/health";
import { postRequests } from "./routes/requests";
import { postDecisions } from "./routes/decisions";
import { postRetry } from "./routes/retry";
import { postClaudeEvents } from "./routes/claude-events";
import { postCodexEvents } from "./routes/codex-events";
import { wsManager } from "./websocket";
import { AuthService } from "./auth";
import { PairingCodeStore } from "./pairing-codes";
import { createPairRouter } from "./routes/pair";
import { requireAuth } from "./middleware/auth";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

// Debug: Verify JWT_SECRET is loaded
console.log("[Broker] Checking JWT_SECRET...");
console.log("[Broker] JWT_SECRET exists:", !!process.env.JWT_SECRET);
if (process.env.JWT_SECRET) {
  console.log(
    "[Broker] JWT_SECRET (first 20 chars):",
    process.env.JWT_SECRET.substring(0, 20) + "..."
  );
} else {
  console.log("[Broker] WARNING: JWT_SECRET not found in environment");
}

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize auth services
const authService = new AuthService(process.env.JWT_SECRET);
const pairingCodeStore = new PairingCodeStore();

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.get("/health", getHealth);
app.use("/v1/pair", createPairRouter(authService, pairingCodeStore));
app.post("/v1/requests", requireAuth(authService), postRequests);
app.post("/v1/decisions", requireAuth(authService), postDecisions);
app.post("/v1/requests/retry/:id", requireAuth(authService), postRetry);
app.post("/v1/claude-events", requireAuth(authService), postClaudeEvents);
app.post("/v1/codex-events", requireAuth(authService), postCodexEvents);

// Error handling middleware (must come after all routes)
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("[Broker] Unhandled error:", err.message);
    console.error(err.stack);

    if (res.headersSent) {
      return;
    }

    res.status(500).json({ error: "Internal server error" });
  }
);

// Start server
const server = app.listen(PORT, () => {
  // Initialize WebSocket server after HTTP server is listening
  wsManager.init(server, authService);

  console.log(`[Broker] Server running on http://localhost:${PORT}`);
  console.log(`[Broker] Health check: http://localhost:${PORT}/health`);
  console.log(`[Broker] WebSocket endpoint: ws://localhost:${PORT}/ws`);
  console.log(`[Broker] Version: 0.0.1`);
  console.log("");

  // Generate initial pairing code for easy setup (non-production only)
  if (process.env.NODE_ENV !== "production") {
    const initialCode = pairingCodeStore.generateCode();
    console.log("┌─────────────────────────────────────────┐");
    console.log("│         PAIRING CODE                    │");
    console.log("│                                         │");
    console.log(`│         ${initialCode}                        │`);
    console.log("│                                         │");
    console.log("│  Use this code to pair clients          │");
    console.log("│  Expires in 5 minutes                   │");
    console.log("└─────────────────────────────────────────┘");
    console.log("");
  } else {
    console.log(
      "[Broker] Production mode: Use POST /v1/pair/generate to create pairing codes"
    );
    console.log("");
  }
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`[Broker] Port ${PORT} is already in use.`);
  } else {
    console.error("[Broker] Server failed to start:", err.message);
  }
  process.exit(1);
});
