/**
 * Notification Service — Redis Streams Consumer
 * Port: 3080 (health/admin only; no external traffic)
 *
 * Listens to ORDER and PAYMENT event streams and sends emails via Resend.
 * Runs as a standalone process — no public HTTP endpoints (only /health).
 */

import express, {
  type Application,
  type Request,
  type Response,
} from "express";
import { logger } from "@ayurveda/shared-utils";
import { startWorker } from "./worker.js";

const app: Application = express();
const PORT = Number(process.env["PORT"] ?? 3080);

// Health endpoint for Docker/Kubernetes probes
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "notification-service",
    timestamp: new Date().toISOString(),
  });
});

// Start the HTTP server
app.listen(PORT, () => {
  logger.info(`Notification Service HTTP running on port ${PORT}`);
});

// Start the event worker
void startWorker();

export default app;
