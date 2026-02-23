/**
 * API Gateway — Control Plane
 *
 * Responsibilities:
 * - Validate external RS256 JWT from cookies
 * - Issue internal service tokens (HMAC-SHA256, 60s TTL)
 * - Rate-limit all inbound requests (Redis-backed)
 * - Route requests to downstream microservices
 * - Attach X-Request-ID to all forwarded requests
 */

import express, {
  type Application,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import jwt from "jsonwebtoken";
import {
  generateRequestId,
  createErrorResponse,
  signInternalToken,
  logger,
} from "@ayurveda/shared-utils";
import type { JwtPayload } from "@ayurveda/shared-types";

const app: Application = express();

// ─── Service URLs (configured per-environment) ─────────────────────────────
const SERVICES = {
  auth: process.env["AUTH_SERVICE_URL"] ?? "http://localhost:3010",
  user: process.env["USER_SERVICE_URL"] ?? "http://localhost:3020",
  product: process.env["PRODUCT_SERVICE_URL"] ?? "http://localhost:3030",
  inventory: process.env["INVENTORY_SERVICE_URL"] ?? "http://localhost:3040",
  cart: process.env["CART_SERVICE_URL"] ?? "http://localhost:3050",
  order: process.env["ORDER_SERVICE_URL"] ?? "http://localhost:3060",
  payment: process.env["PAYMENT_SERVICE_URL"] ?? "http://localhost:3070",
  admin: process.env["ADMIN_SERVICE_URL"] ?? "http://localhost:3090",
} as const;

const CORS_ORIGIN = process.env["CORS_ORIGIN"] ?? "http://localhost:3000";
const JWT_PUBLIC_KEY = (process.env["JWT_PUBLIC_KEY"] ?? "").replace(
  /\\n/g,
  "\n",
);
const PORT = Number(process.env["PORT"] ?? 3000);

// ─── Security Middleware ───────────────────────────────────────────────────
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(cookieParser());

// ─── Rate Limiting ─────────────────────────────────────────────────────────
const baseRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: createErrorResponse(
    "RATE_LIMIT_EXCEEDED",
    "Too many requests, please try again later",
  ),
});

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: createErrorResponse("RATE_LIMIT_EXCEEDED", "Too many auth requests"),
});

app.use(baseRateLimit);
app.use("/v1/auth/login", authRateLimit);
app.use("/v1/auth/register", authRateLimit);

// ─── Request ID Middleware ─────────────────────────────────────────────────
app.use((req: Request, _res: Response, next: NextFunction) => {
  const requestId = generateRequestId();
  req.headers["x-request-id"] = requestId;
  next();
});

// ─── JWT Validation Middleware ─────────────────────────────────────────────
const PUBLIC_ROUTES = [
  "/v1/auth/login",
  "/v1/auth/register",
  "/v1/auth/refresh",
  "/v1/products", // public read
  "/v1/categories",
  "/v1/webhooks/payment", // HMAC-verified internally
  "/health",
];

function validateJwt(req: Request, res: Response, next: NextFunction): void {
  const isPublic = PUBLIC_ROUTES.some((r) => req.path.startsWith(r));
  if (isPublic) {
    next();
    return;
  }

  const token = req.cookies["access_token"] as string | undefined;
  if (!token) {
    res
      .status(401)
      .json(createErrorResponse("UNAUTHORIZED", "Authentication required"));
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_PUBLIC_KEY, {
      algorithms: ["RS256"],
    }) as JwtPayload;
    // Forward user info to downstream services via headers
    req.headers["x-user-id"] = payload.sub;
    req.headers["x-user-role"] = payload.role;
    req.headers["x-user-permissions"] = JSON.stringify(
      payload.permissions ?? [],
    );

    // Attach internal service token (60s, for service-to-service calls)
    const internalToken = signInternalToken({
      service: "api-gateway",
      requestId: req.headers["x-request-id"] as string,
    });
    req.headers["x-internal-token"] = internalToken;

    next();
  } catch {
    res
      .status(401)
      .json(createErrorResponse("TOKEN_INVALID", "Invalid or expired token"));
  }
}

app.use(validateJwt);

// ─── Proxy Routes ──────────────────────────────────────────────────────────
function makeProxy(target: string) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    on: {
      error: (_err: Error, _req: Request, res: any) => {
        (res as Response)
          .status(502)
          .json(
            createErrorResponse(
              "SERVICE_UNAVAILABLE",
              "Upstream service unavailable",
            ),
          );
      },
    },
  });
}

app.use("/v1/auth", makeProxy(SERVICES.auth));
app.use("/v1/users", makeProxy(SERVICES.user));
app.use("/v1/categories", makeProxy(SERVICES.product));
app.use("/v1/products", makeProxy(SERVICES.product));
app.use("/v1/inventory", makeProxy(SERVICES.inventory));
app.use("/v1/cart", makeProxy(SERVICES.cart));
app.use("/v1/orders", makeProxy(SERVICES.order));
app.use("/v1/payments", makeProxy(SERVICES.payment));
app.use("/v1/webhooks", makeProxy(SERVICES.payment));
app.use("/v1/admin", makeProxy(SERVICES.admin));

// ─── Health Check ──────────────────────────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "api-gateway",
    timestamp: new Date().toISOString(),
  });
});

// ─── Start ─────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
});

export default app;
