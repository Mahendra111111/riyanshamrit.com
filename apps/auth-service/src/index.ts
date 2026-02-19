/**
 * Auth Service — Express application entry point.
 *
 * Configures:
 * - Helmet (security headers)
 * - CORS (allowed origins only — no wildcard)
 * - Cookie parser (for httpOnly cookie access)
 * - JSON parsing with body size limit
 * - Health endpoint
 * - Auth routes at /v1/auth
 * - Public key endpoint at /public-key
 * - Global error handler
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createErrorResponse, logger } from "@ayurveda/shared-utils";
import authRoutes from "./routes/auth.routes.js";
import { getPublicKeyController } from "./controllers/auth.controller.js";

const app = express();

// ─── Security Headers ─────────────────────────────────────────────────────────

app.use(helmet());

// ─── CORS ────────────────────────────────────────────────────────────────────

const allowedOrigins = (
  process.env["ALLOWED_ORIGINS"] ?? "http://localhost:3000"
)
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. server-to-server)
      if (!origin ?? allowedOrigins.includes(origin ?? "")) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true, // Allows httpOnly cookies to be sent
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  }),
);

// ─── Middleware ───────────────────────────────────────────────────────────────

// Cookie parser is required to read httpOnly cookies
app.use(cookieParser());

// Limit body size to prevent DoS via large payloads
app.use(express.json({ limit: "10kb" }));

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get("/health", (_req: Request, res: Response) => {
  res
    .status(200)
    .json({
      status: "ok",
      service: "auth-service",
      timestamp: new Date().toISOString(),
    });
});

// ─── Routes ───────────────────────────────────────────────────────────────────

// Auth endpoints: /v1/auth/login, /v1/auth/register, etc.
app.use("/v1/auth", authRoutes);

// Public key endpoint for backend services to verify JWTs
app.get("/public-key", getPublicKeyController);

// ─── 404 Handler ─────────────────────────────────────────────────────────────

app.use((_req: Request, res: Response) => {
  res.status(404).json(createErrorResponse("NOT_FOUND", "Endpoint not found"));
});

// ─── Global Error Handler ─────────────────────────────────────────────────────

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error("Unhandled error in auth service", error);

  // Never expose stack traces in production
  res
    .status(500)
    .json(
      createErrorResponse(
        "INTERNAL_ERROR",
        "An internal server error occurred",
      ),
    );
});

// ─── Start Server ─────────────────────────────────────────────────────────────

const PORT = parseInt(process.env["PORT"] ?? "3001", 10);

app.listen(PORT, () => {
  logger.info(`Auth service running on port ${PORT}`, { port: PORT });
});

export default app;
