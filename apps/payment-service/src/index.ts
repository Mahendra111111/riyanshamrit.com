/**
 * Payment Service — Razorpay Integration + HMAC Webhook Verification
 * Port: 3070
 */

import express, {
  type Application,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import {
  generateRequestId,
  createErrorResponse,
  verifyInternalToken,
  logger,
} from "@ayurveda/shared-utils";
import paymentRoutes, { webhookRouter } from "./routes/payment.routes.js";

const app: Application = express();
const PORT = Number(process.env["PORT"] ?? 3070);
const CORS_ORIGIN = process.env["CORS_ORIGIN"] ?? "http://localhost:3000";

// ─── Security Headers ─────────────────────────────────────────────────────────
app.set("trust proxy", 1);
app.use(helmet());

// ─── CORS ────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
  }),
);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cookieParser());

// Webhook needs raw body, intent needs JSON.
// Standardized initialization:
app.use("/v1/webhooks", webhookRouter);
app.use(express.json({ limit: "10kb" }));

// ─── Request Logging & Context ───────────────────────────────────────────────
app.use((req: Request, _res: Response, next: NextFunction) => {
  const requestId =
    (req.headers["x-request-id"] as string | undefined) ?? generateRequestId();
  const userId = req.headers["x-user-id"] as string | undefined;

  (req as any).requestId = requestId;

  logger.info(`${req.method} ${req.path}`, undefined, {
    requestId,
    ...(userId !== undefined && { userId }),
  });
  next();
});

// ─── Internal Auth Middleware ──────────────────────────────────────────────
function requireGateway(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers["x-internal-token"] as string | undefined;
  if (!token) {
    res
      .status(401)
      .json(createErrorResponse("UNAUTHORIZED", "Missing internal token"));
    return;
  }
  try {
    verifyInternalToken(token);
    next();
  } catch {
    res
      .status(401)
      .json(createErrorResponse("UNAUTHORIZED", "Invalid internal token"));
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/v1/payments", requireGateway, paymentRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "payment-service",
    timestamp: new Date().toISOString(),
  });
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json(createErrorResponse("NOT_FOUND", "Endpoint not found"));
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error("Unhandled error in payment service", err);
  res
    .status(500)
    .json(
      createErrorResponse("INTERNAL_ERROR", "An unexpected error occurred"),
    );
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`Payment Service running on port ${PORT}`);
});

export default app;
