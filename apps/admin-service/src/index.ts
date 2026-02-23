/**
 * Admin Service — Order Management, User Management, Analytics
 * Port: 3090
 *
 * All routes require admin role (enforced by api-gateway + this service).
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
import adminRoutes from "./routes/admin.routes.js";

const app: Application = express();
const PORT = Number(process.env["PORT"] ?? 3090);
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
app.use(express.json({ limit: "10kb" }));

// ─── Request Logging & Context ───────────────────────────────────────────────
app.use((req: Request, _res: Response, next: NextFunction) => {
  const requestId =
    (req.headers["x-request-id"] as string | undefined) ?? generateRequestId();
  const userId = req.headers["x-user-id"] as string | undefined;

  (req as any).requestId = requestId;

  logger.info(`ADMIN ${req.method} ${req.path}`, undefined, {
    requestId,
    ...(userId !== undefined && { userId }),
  });
  next();
});

// ─── Internal + Admin Auth Middleware ──────────────────────────────────────
function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers["x-internal-token"] as string | undefined;
  if (!token) {
    res
      .status(401)
      .json(createErrorResponse("UNAUTHORIZED", "Missing internal token"));
    return;
  }
  try {
    verifyInternalToken(token);
  } catch {
    res
      .status(401)
      .json(createErrorResponse("UNAUTHORIZED", "Invalid internal token"));
    return;
  }

  const role = req.headers["x-user-role"] as string | undefined;
  if (role !== "admin") {
    res
      .status(403)
      .json(createErrorResponse("FORBIDDEN", "Admin role required"));
    return;
  }
  next();
}

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/v1/admin", requireAdmin, adminRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "admin-service",
    timestamp: new Date().toISOString(),
  });
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json(createErrorResponse("NOT_FOUND", "Endpoint not found"));
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error("Unhandled error in admin service", err);
  res
    .status(500)
    .json(
      createErrorResponse("INTERNAL_ERROR", "An unexpected error occurred"),
    );
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`Admin Service running on port ${PORT}`);
});

export default app;
