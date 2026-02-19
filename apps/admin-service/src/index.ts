/**
 * Admin Service — Order Management, User Management, Analytics
 * Port: 3010
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
import { createClient } from "@supabase/supabase-js";
import {
  generateRequestId,
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
  verifyInternalToken,
  logger,
} from "@ayurveda/shared-utils";

const app: Application = express();
const PORT = Number(process.env["PORT"] ?? 3010);
const CORS_ORIGIN = process.env["CORS_ORIGIN"] ?? "http://localhost:3000";

const supabase = createClient(
  process.env["SUPABASE_URL"] ?? "",
  process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "",
);

app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "10kb" }));

// ─── Internal + Admin Auth ─────────────────────────────────────────────────
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

app.use((req: Request, _res: Response, next: NextFunction) => {
  const requestId =
    (req.headers["x-request-id"] as string | undefined) ?? generateRequestId();
  const userId = req.headers["x-user-id"] as string | undefined;
  logger.info(`ADMIN ${req.method} ${req.path}`, undefined, {
    requestId,
    ...(userId !== undefined && { userId }),
  });
  next();
});

// ─── Dashboard Analytics ───────────────────────────────────────────────────

// GET /v1/admin/analytics
app.get(
  "/v1/admin/analytics",
  requireAdmin,
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const [ordersResult, usersResult, revenueResult] = await Promise.all([
        supabase
          .from("orders")
          .select("status", { count: "exact", head: true }),
        supabase.from("users").select("id", { count: "exact", head: true }),
        supabase.from("payments").select("amount").eq("status", "captured"),
      ]);

      const totalRevenue = (revenueResult.data ?? []).reduce(
        (sum, p) => sum + (p["amount"] as number),
        0,
      );

      res.json(
        createSuccessResponse({
          totalOrders: ordersResult.count ?? 0,
          totalUsers: usersResult.count ?? 0,
          totalRevenue,
        }),
      );
    } catch (err) {
      next(err);
    }
  },
);

// ─── Order Management ──────────────────────────────────────────────────────

// GET /v1/admin/orders — all orders paginated
app.get(
  "/v1/admin/orders",
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = Math.max(1, Number(req.query["page"] ?? 1));
      const limit = Math.min(100, Number(req.query["limit"] ?? 20));
      const offset = (page - 1) * limit;
      const status =
        typeof req.query["status"] === "string"
          ? req.query["status"]
          : undefined;

      let query = supabase
        .from("orders")
        .select("*, users(email), order_items(*)", { count: "exact" })
        .range(offset, offset + limit - 1)
        .order("created_at", { ascending: false });

      if (status) query = query.eq("status", status);

      const { data, error, count } = await query;
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

// PATCH /v1/admin/orders/:id/status — update order status
app.patch(
  "/v1/admin/orders/:id/status",
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { status } = req.body as { status: string };
      const allowedStatuses = [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "failed",
        "cancelled",
        "refunded",
      ];
      if (!allowedStatuses.includes(status)) {
        res
          .status(400)
          .json(
            createErrorResponse(
              "VALIDATION_ERROR",
              `Invalid status. Must be one of: ${allowedStatuses.join(", ")}`,
            ),
          );
        return;
      }

      const { data, error } = await supabase
        .from("orders")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", req.params["id"])
        .select()
        .single();

      if (error) {
        res
          .status(500)
          .json(
            createErrorResponse(
              "UPDATE_FAILED",
              "Failed to update order status",
            ),
          );
        return;
      }

      // Admin audit log
      await supabase.from("admin_logs").insert({
        admin_id: req.headers["x-user-id"] as string,
        action: "ORDER_STATUS_UPDATED",
        entity_type: "order",
        entity_id: req.params["id"],
        details: { new_status: status },
      });

      res.json(createSuccessResponse(data, "Order status updated"));
    } catch (err) {
      next(err);
    }
  },
);

// ─── User Management ───────────────────────────────────────────────────────

// GET /v1/admin/users — all users paginated
app.get(
  "/v1/admin/users",
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = Math.max(1, Number(req.query["page"] ?? 1));
      const limit = Math.min(100, Number(req.query["limit"] ?? 20));
      const offset = (page - 1) * limit;

      const { data, error, count } = await supabase
        .from("users")
        .select("id, email, role, is_verified, created_at", { count: "exact" })
        .range(offset, offset + limit - 1)
        .order("created_at", { ascending: false });

      if (error) {
        res
          .status(500)
          .json(createErrorResponse("DB_ERROR", "Failed to fetch users"));
        return;
      }
      res.json(createPaginatedResponse(data ?? [], count ?? 0, page, limit));
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /v1/admin/users/:id/role — set user role
app.patch(
  "/v1/admin/users/:id/role",
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { role } = req.body as { role: string };
      if (!["user", "admin"].includes(role)) {
        res
          .status(400)
          .json(
            createErrorResponse(
              "VALIDATION_ERROR",
              "Role must be 'user' or 'admin'",
            ),
          );
        return;
      }

      const { data, error } = await supabase
        .from("users")
        .update({ role, updated_at: new Date().toISOString() })
        .eq("id", req.params["id"])
        .select("id, email, role")
        .single();

      if (error) {
        res
          .status(500)
          .json(
            createErrorResponse("UPDATE_FAILED", "Failed to update user role"),
          );
        return;
      }

      await supabase.from("admin_logs").insert({
        admin_id: req.headers["x-user-id"] as string,
        action: "USER_ROLE_UPDATED",
        entity_type: "user",
        entity_id: req.params["id"],
        details: { new_role: role },
      });

      res.json(createSuccessResponse(data, "User role updated"));
    } catch (err) {
      next(err);
    }
  },
);

// ─── Health Check ──────────────────────────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "admin-service",
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
  logger.info(`Admin Service running on port ${PORT}`);
});

export default app;
