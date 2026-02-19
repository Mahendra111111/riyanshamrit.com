/**
 * Order Service — Atomic Order Creation, State Machine, Event Emission
 * Port: 3007
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
  createPaginatedResponse,
  verifyInternalToken,
  signInternalToken,
  publishEvent,
  EVENT_STREAMS,
  logger,
} from "@ayurveda/shared-utils";

const app: Application = express();
const PORT = Number(process.env["PORT"] ?? 3007);
const CORS_ORIGIN = process.env["CORS_ORIGIN"] ?? "http://localhost:3000";
const INVENTORY_SERVICE_URL =
  process.env["INVENTORY_SERVICE_URL"] ?? "http://localhost:3005";

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

// ─── Helper: call inventory service ───────────────────────────────────────
async function callInventory(
  path: string,
  body: unknown,
  requestId: string,
): Promise<{ ok: boolean; status: number }> {
  const internalToken = signInternalToken({
    service: "order-service",
    requestId,
  });
  const res = await fetch(`${INVENTORY_SERVICE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-token": internalToken,
      "x-request-id": requestId,
    },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status };
}

// ─── Routes ────────────────────────────────────────────────────────────────

// GET /v1/orders — user's own orders
app.get(
  "/v1/orders",
  requireGateway,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.headers["x-user-id"] as string | undefined;
      if (!userId) {
        res.status(401).json(createErrorResponse("UNAUTHORIZED", "No user ID"));
        return;
      }
      const page = Math.max(1, Number(req.query["page"] ?? 1));
      const limit = Math.min(50, Number(req.query["limit"] ?? 10));
      const offset = (page - 1) * limit;

      const { data, error, count } = await supabase
        .from("orders")
        .select("*, order_items(*)", { count: "exact" })
        .eq("user_id", userId)
        .range(offset, offset + limit - 1)
        .order("created_at", { ascending: false });

      if (error) {
        res
          .status(500)
          .json(createErrorResponse("DB_ERROR", "Failed to fetch orders"));
        return;
      }
      res.json(createPaginatedResponse(data ?? [], count ?? 0, page, limit));
    } catch (err) {
      next(err);
    }
  },
);

// GET /v1/orders/:id — user's own order detail
app.get(
  "/v1/orders/:id",
  requireGateway,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.headers["x-user-id"] as string | undefined;
      if (!userId) {
        res.status(401).json(createErrorResponse("UNAUTHORIZED", "No user ID"));
        return;
      }

      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("id", req.params["id"])
        .eq("user_id", userId) // IDOR protection
        .single();

      if (error || !data) {
        res
          .status(404)
          .json(createErrorResponse("NOT_FOUND", "Order not found"));
        return;
      }
      res.json(createSuccessResponse(data));
    } catch (err) {
      next(err);
    }
  },
);

// POST /v1/orders — create order with price snapshot + inventory reservation
app.post(
  "/v1/orders",
  requireGateway,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const requestId =
      (req.headers["x-request-id"] as string | undefined) ??
      generateRequestId();
    try {
      const userId = req.headers["x-user-id"] as string | undefined;
      if (!userId) {
        res.status(401).json(createErrorResponse("UNAUTHORIZED", "No user ID"));
        return;
      }

      const { items, addressId } = req.body as {
        items: Array<{ productId: string; quantity: number }>;
        addressId: string;
      };

      if (!Array.isArray(items) || items.length === 0 || !addressId) {
        res
          .status(400)
          .json(
            createErrorResponse(
              "VALIDATION_ERROR",
              "items and addressId required",
            ),
          );
        return;
      }

      // 1. Price snapshot — fetch current prices from DB
      const productIds = items.map((i) => i.productId);
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id, name, price, discount_price")
        .in("id", productIds)
        .eq("is_active", true);

      if (productsError || !products || products.length !== items.length) {
        res
          .status(400)
          .json(
            createErrorResponse(
              "INVALID_PRODUCTS",
              "One or more products are unavailable",
            ),
          );
        return;
      }

      // 2. Reserve inventory (atomic via inventory-service)
      const reserveResult = await callInventory(
        "/v1/inventory/reserve",
        {
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
        },
        requestId,
      );
      if (!reserveResult.ok) {
        res
          .status(409)
          .json(
            createErrorResponse(
              "INSUFFICIENT_STOCK",
              "One or more items are out of stock",
            ),
          );
        return;
      }

      // 3. Calculate order total using server-side price (never trust client prices)
      const productMap = new Map(products.map((p) => [p["id"] as string, p]));
      let totalAmount = 0;
      const orderItemInserts: Array<{
        product_id: string;
        product_name: string;
        quantity: number;
        unit_price: number;
        total_price: number;
      }> = [];

      for (const item of items) {
        const product = productMap.get(item.productId);
        if (!product) {
          res
            .status(400)
            .json(
              createErrorResponse(
                "INVALID_PRODUCT",
                `Product ${item.productId} not found`,
              ),
            );
          return;
        }
        const price =
          (product["discount_price"] as number | null) ??
          (product["price"] as number);
        const lineTotal = price * item.quantity;
        totalAmount += lineTotal;
        orderItemInserts.push({
          product_id: item.productId,
          product_name: product["name"] as string,
          quantity: item.quantity,
          unit_price: price,
          total_price: lineTotal,
        });
      }

      // 4. Create order row
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: userId,
          address_id: addressId,
          status: "pending",
          total_amount: totalAmount,
        })
        .select()
        .single();

      if (orderError || !order) {
        // Release inventory on failure
        await callInventory(
          "/v1/inventory/release",
          {
            items: items.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
            })),
          },
          requestId,
        );
        res
          .status(500)
          .json(createErrorResponse("CREATE_FAILED", "Failed to create order"));
        return;
      }

      // 5. Insert order items
      await supabase.from("order_items").insert(
        orderItemInserts.map((i) => ({
          ...i,
          order_id: order["id"] as string,
        })),
      );

      // 6. Publish ORDER_CREATED event
      await publishEvent(redis, EVENT_STREAMS.ORDER, {
        type: "ORDER_CREATED",
        orderId: order["id"] as string,
        userId,
        totalAmount: String(totalAmount),
        requestId,
      });

      res.status(201).json(createSuccessResponse(order, "Order created"));
    } catch (err) {
      next(err);
    }
  },
);

// ─── Health Check ──────────────────────────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "order-service",
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
  logger.info(`Order Service running on port ${PORT}`);
});

export default app;
