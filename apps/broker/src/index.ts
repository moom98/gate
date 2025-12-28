import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { getHealth } from "./routes/health";
import { postRequests } from "./routes/requests";
import { postDecisions } from "./routes/decisions";
import { wsManager } from "./websocket";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

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
app.post("/v1/requests", postRequests);
app.post("/v1/decisions", postDecisions);

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
  console.log(`[Broker] Server running on http://localhost:${PORT}`);
  console.log(`[Broker] Health check: http://localhost:${PORT}/health`);
  console.log(`[Broker] WebSocket endpoint: ws://localhost:${PORT}/ws`);
  console.log(`[Broker] Version: 0.0.1`);
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`[Broker] Port ${PORT} is already in use.`);
  } else {
    console.error("[Broker] Server failed to start:", err.message);
  }
  process.exit(1);
});

// Initialize WebSocket server
wsManager.init(server);
