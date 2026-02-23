/**
 * Inventory Service — Stock Management
 * Port: 3040
 *
 * Called internally by Order Service (reserve) and Payment Service (deduct/release).
 * All endpoints require an internal service token — NOT exposed publicly.
 */

import express, {
  type Application,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import helmet from "helmet";
import {
  generateRequestId,
  createErrorResponse,
  verifyInternalToken,
  logger,
} from "@ayurveda/shared-utils";
import inventoryRoutes from "./routes/inventory.routes.js";

const app: Application = express();
const PORT = Number(process.env["PORT"] ?? 3040);

// ─── Security Headers ─────────────────────────────────────────────────────────
app.set("trust proxy", 1);
app.use(helmet());

// ─── CORS ────────────────────────────────────────────────────────────────────
app.use(cors({ origin: false })); // Internal service — no external CORS

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10kb" }));

// ─── Request Logging & Context ───────────────────────────────────────────────
app.use((req: Request, _res: Response, next: NextFunction) => {
  const requestId =
    (req.headers["x-request-id"] as string | undefined) ?? generateRequestId();

  (req as any).requestId = requestId;

  logger.info(`${req.method} ${req.path}`, undefined, { requestId });
  next();
});

// ─── Internal Auth Middleware ──────────────────────────────────────────────
function requireInternal(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token = req.headers["x-internal-token"] as string | undefined;
  if (!token) {
    res
      .status(401)
      .json(createErrorResponse("UNAUTHORIZED", "Internal token required"));
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
app.use("/v1/inventory", requireInternal, inventoryRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "inventory-service",
    timestamp: new Date().toISOString(),
  });
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json(createErrorResponse("NOT_FOUND", "Endpoint not found"));
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error("Unhandled error in inventory service", err);
  res
    .status(500)
    .json(
      createErrorResponse("INTERNAL_ERROR", "An unexpected error occurred"),
    );
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`Inventory Service running on port ${PORT}`);
});

export default app;
