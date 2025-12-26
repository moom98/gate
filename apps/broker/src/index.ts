import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { getHealth } from "./routes/health";
import { postRequests } from "./routes/requests";
import { postDecisions } from "./routes/decisions";

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

// Start server
app.listen(PORT, () => {
  console.log(`[Broker] Server running on http://localhost:${PORT}`);
  console.log(`[Broker] Health check: http://localhost:${PORT}/health`);
  console.log(`[Broker] Version: 0.0.1`);
});
