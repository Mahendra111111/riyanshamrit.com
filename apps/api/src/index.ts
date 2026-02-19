/**
 * API — Express application entry point.
 *
 * Key setup:
 * - Raw body middleware for webhook signature verification
 * - Helmet (security headers)
 * - CORS (explicit origins, credentials)
 * - Cookie parser (httpOnly access_token/refresh_token)
 * - Body size limit
 * - Versioned routes at /v1
 * - Global error handler (no stack traces in production)
 */

import express, {
  type Application,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import {
  createErrorResponse,
  logger,
  generateRequestId,
} from "@ayurveda/shared-utils";
import apiRoutes from "./routes/index.js";

const app: Application = express();

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
      if (!origin || allowedOrigins.includes(origin)) callback(null, true);
      else callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  }),
);

// ─── Cookie Parser ────────────────────────────────────────────────────────────

app.use(cookieParser());

// ─── Raw Body (for webhook signature verification) ────────────────────────────

// The raw body must be captured BEFORE express.json() parses it.
// This preserves the exact bytes used in the HMAC signature.
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.path.includes("/webhooks/")) {
    let rawBody = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => {
      rawBody += chunk;
    });
    req.on("end", () => {
      (req as Request & { rawBody: string }).rawBody = rawBody;
      next();
    });
  } else {
    next();
  }
});

// ─── JSON Body Parser ─────────────────────────────────────────────────────────

app.use(express.json({ limit: "10kb" }));

// ─── Request ID Middleware ────────────────────────────────────────────────────

app.use((req: Request, res: Response, next: NextFunction) => {
  req.requestId = generateRequestId();
  res.setHeader("X-Request-Id", req.requestId);
  next();
});

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "api",
    timestamp: new Date().toISOString(),
  });
});

// ─── Versioned Routes ─────────────────────────────────────────────────────────

app.use("/v1", apiRoutes);

// ─── 404 ─────────────────────────────────────────────────────────────────────

app.use((_req: Request, res: Response) => {
  res.status(404).json(createErrorResponse("NOT_FOUND", "Endpoint not found"));
});

// ─── Global Error Handler ─────────────────────────────────────────────────────

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error("Unhandled API error", error);
  res
    .status(500)
    .json(
      createErrorResponse(
        "INTERNAL_ERROR",
        "An internal server error occurred",
      ),
    );
});

// ─── Start (only in non-serverless mode) ─────────────────────────────────────

const PORT = parseInt(process.env["PORT"] ?? "3002", 10);
if (process.env["NODE_ENV"] !== "production" || process.env["VERCEL"] !== "1") {
  app.listen(PORT, () =>
    logger.info(`API running on port ${PORT}`, { port: PORT }),
  );
}

export default app;
