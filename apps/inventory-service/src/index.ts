/**
 * Inventory Service — Stock Management
 * Port: 3005
 *
 * Called internally by Order Service (reserve) and Payment Service (deduct/release).
 * All endpoints require an internal service token — NOT exposed publicly.
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import helmet from "helmet";
import { createClient } from "@supabase/supabase-js";
import {
  generateRequestId,
  createSuccessResponse,
  createErrorResponse,
  verifyInternalToken,
  logger,
} from "@ayurveda/shared-utils";

const app = express();
const PORT = Number(process.env["PORT"] ?? 3005);

const supabase = createClient(
  process.env["SUPABASE_URL"] ?? "",
  process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "",
);

app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: false })); // Internal service — no external CORS
app.use(express.json({ limit: "10kb" }));

// ─── Internal Auth (required on all routes) ────────────────────────────────
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

app.use((req: Request, _res: Response, next: NextFunction) => {
  const requestId =
    (req.headers["x-request-id"] as string | undefined) ?? generateRequestId();
  logger.info(`${req.method} ${req.path}`, undefined, { requestId });
  next();
});

// ─── GET /v1/inventory/:productId ─────────────────────────────────────────
app.get(
  "/v1/inventory/:productId",
  requireInternal,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from("inventory")
        .select("*")
        .eq("product_id", req.params["productId"])
        .single();
      if (error || !data) {
        res
          .status(404)
          .json(createErrorResponse("NOT_FOUND", "Inventory record not found"));
        return;
      }
      res.json(
        createSuccessResponse({
          ...data,
          available:
            (data["stock_quantity"] as number) -
            (data["reserved_quantity"] as number),
        }),
      );
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /v1/inventory/reserve — called by order-service ─────────────────
// Atomically increments reserved_quantity; rejects if insufficient stock
app.post(
  "/v1/inventory/reserve",
  requireInternal,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { items } = req.body as {
        items: Array<{ productId: string; quantity: number }>;
      };
      if (!Array.isArray(items) || items.length === 0) {
        res
          .status(400)
          .json(
            createErrorResponse("VALIDATION_ERROR", "items array required"),
          );
        return;
      }

      const results: Array<{ productId: string; status: string }> = [];
      for (const item of items) {
        const { error } = await supabase.rpc("reserve_inventory", {
          p_product_id: item.productId,
          p_quantity: item.quantity,
        });
        if (error) {
          results.push({
            productId: item.productId,
            status: "INSUFFICIENT_STOCK",
          });
        } else {
          results.push({ productId: item.productId, status: "RESERVED" });
        }
      }

      const failed = results.filter((r) => r.status !== "RESERVED");
      if (failed.length > 0) {
        res
          .status(409)
          .json(
            createErrorResponse(
              "INSUFFICIENT_STOCK",
              `Insufficient stock for ${failed.length} item(s)`,
            ),
          );
        return;
      }
      res.json(createSuccessResponse(results, "Inventory reserved"));
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /v1/inventory/release — called by payment-service on failure ─────
app.post(
  "/v1/inventory/release",
  requireInternal,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { items } = req.body as {
        items: Array<{ productId: string; quantity: number }>;
      };
      if (!Array.isArray(items) || items.length === 0) {
        res
          .status(400)
          .json(
            createErrorResponse("VALIDATION_ERROR", "items array required"),
          );
        return;
      }
      for (const item of items) {
        await supabase.rpc("release_inventory", {
          p_product_id: item.productId,
          p_quantity: item.quantity,
        });
      }
      res.json(createSuccessResponse(null, "Inventory released"));
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /v1/inventory/deduct — called by payment-service on success ──────
app.post(
  "/v1/inventory/deduct",
  requireInternal,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { items } = req.body as {
        items: Array<{ productId: string; quantity: number }>;
      };
      if (!Array.isArray(items) || items.length === 0) {
        res
          .status(400)
          .json(
            createErrorResponse("VALIDATION_ERROR", "items array required"),
          );
        return;
      }
      for (const item of items) {
        await supabase.rpc("deduct_inventory", {
          p_product_id: item.productId,
          p_quantity: item.quantity,
        });
      }
      res.json(createSuccessResponse(null, "Inventory deducted"));
    } catch (err) {
      next(err);
    }
  },
);

// ─── Health Check ──────────────────────────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "inventory-service",
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
  logger.info(`Inventory Service running on port ${PORT}`);
});

export default app;
