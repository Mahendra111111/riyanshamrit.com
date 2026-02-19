/**
 * Cart Service — Redis-backed with DB persistence fallback
 * Port: 3006
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
import Redis from "ioredis";
import { createClient } from "@supabase/supabase-js";
import {
  generateRequestId,
  createSuccessResponse,
  createErrorResponse,
  verifyInternalToken,
  logger,
} from "@ayurveda/shared-utils";

const app: Application = express();
const PORT = Number(process.env["PORT"] ?? 3006);
const CORS_ORIGIN = process.env["CORS_ORIGIN"] ?? "http://localhost:3000";
const CART_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

const redis = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379");
const supabase = createClient(
  process.env["SUPABASE_URL"] ?? "",
  process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "",
);

app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "10kb" }));

// ─── Internal Auth ─────────────────────────────────────────────────────────
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

app.use((req: Request, _res: Response, next: NextFunction) => {
  const requestId =
    (req.headers["x-request-id"] as string | undefined) ?? generateRequestId();
  const userId = req.headers["x-user-id"] as string | undefined;
  logger.info(`${req.method} ${req.path}`, undefined, {
    requestId,
    ...(userId !== undefined && { userId }),
  });
  next();
});

// ─── Redis Cart Helpers ────────────────────────────────────────────────────
function cartKey(userId: string): string {
  return `cart:${userId}`;
}

interface CartItem {
  productId: string;
  quantity: number;
}

async function getCartFromRedis(userId: string): Promise<CartItem[]> {
  const raw = await redis.get(cartKey(userId));
  if (!raw) return [];
  return JSON.parse(raw) as CartItem[];
}

async function saveCartToRedis(
  userId: string,
  items: CartItem[],
): Promise<void> {
  await redis.setex(cartKey(userId), CART_TTL_SECONDS, JSON.stringify(items));
}

// ─── Routes ────────────────────────────────────────────────────────────────

// GET /v1/cart
app.get(
  "/v1/cart",
  requireGateway,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.headers["x-user-id"] as string | undefined;
      if (!userId) {
        res.status(401).json(createErrorResponse("UNAUTHORIZED", "No user ID"));
        return;
      }
      const items = await getCartFromRedis(userId);
      res.json(createSuccessResponse(items));
    } catch (err) {
      next(err);
    }
  },
);

// POST /v1/cart — add or update item
app.post(
  "/v1/cart",
  requireGateway,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.headers["x-user-id"] as string | undefined;
      if (!userId) {
        res.status(401).json(createErrorResponse("UNAUTHORIZED", "No user ID"));
        return;
      }

      const { productId, quantity } = req.body as {
        productId: string;
        quantity: number;
      };
      if (!productId || !quantity || quantity < 1) {
        res
          .status(400)
          .json(
            createErrorResponse(
              "VALIDATION_ERROR",
              "productId and quantity (≥1) required",
            ),
          );
        return;
      }

      const items = await getCartFromRedis(userId);
      const existing = items.find((i) => i.productId === productId);
      if (existing) {
        existing.quantity += quantity;
      } else {
        items.push({ productId, quantity });
      }
      await saveCartToRedis(userId, items);
      res.json(createSuccessResponse(items, "Cart updated"));
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /v1/cart/:productId — set exact quantity
app.patch(
  "/v1/cart/:productId",
  requireGateway,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.headers["x-user-id"] as string | undefined;
      if (!userId) {
        res.status(401).json(createErrorResponse("UNAUTHORIZED", "No user ID"));
        return;
      }

      const { quantity } = req.body as { quantity: number };
      if (!quantity || quantity < 1) {
        res
          .status(400)
          .json(
            createErrorResponse("VALIDATION_ERROR", "quantity (≥1) required"),
          );
        return;
      }

      const items = await getCartFromRedis(userId);
      const item = items.find((i) => i.productId === req.params["productId"]);
      if (!item) {
        res
          .status(404)
          .json(createErrorResponse("NOT_FOUND", "Item not in cart"));
        return;
      }
      item.quantity = quantity;
      await saveCartToRedis(userId, items);
      res.json(createSuccessResponse(items, "Quantity updated"));
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /v1/cart/:productId — remove item
app.delete(
  "/v1/cart/:productId",
  requireGateway,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.headers["x-user-id"] as string | undefined;
      if (!userId) {
        res.status(401).json(createErrorResponse("UNAUTHORIZED", "No user ID"));
        return;
      }

      const items = await getCartFromRedis(userId);
      const filtered = items.filter(
        (i) => i.productId !== req.params["productId"],
      );
      await saveCartToRedis(userId, filtered);
      res.json(createSuccessResponse(filtered, "Item removed"));
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /v1/cart — clear entire cart (called by order-service after order creation)
app.delete(
  "/v1/cart",
  requireGateway,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.headers["x-user-id"] as string | undefined;
      if (!userId) {
        res.status(401).json(createErrorResponse("UNAUTHORIZED", "No user ID"));
        return;
      }
      await redis.del(cartKey(userId));
      // Also clear from DB for persistence
      await supabase.from("cart_items").delete().eq("user_id", userId);
      res.json(createSuccessResponse([], "Cart cleared"));
    } catch (err) {
      next(err);
    }
  },
);

// ─── Health Check ──────────────────────────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "cart-service",
    timestamp: new Date().toISOString(),
  });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error("Unhandled error", err);
  res
    .status(500)
    .json(
      createErrorResponse("INTERNAL_ERROR", "An unexpected error occurred"),
    );
});

app.listen(PORT, () => {
  logger.info(`Cart Service running on port ${PORT}`);
});

export default app;
