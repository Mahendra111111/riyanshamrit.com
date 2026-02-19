/**
 * Product Service — Products, Categories, Admin CRUD
 * Port: 3004
 */

import express, {
  type Application,
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
  createPaginatedResponse,
  verifyInternalToken,
  logger,
} from "@ayurveda/shared-utils";

const app: Application = express();
const PORT = Number(process.env["PORT"] ?? 3004);
const CORS_ORIGIN = process.env["CORS_ORIGIN"] ?? "http://localhost:3000";

const supabase = createClient(
  process.env["SUPABASE_URL"] ?? "",
  process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "",
);

app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "10kb" }));

// ─── Internal Auth Middleware ──────────────────────────────────────────────
function requireGateway(req: Request, res: Response, next: NextFunction): void {
  const internalToken = req.headers["x-internal-token"] as string | undefined;
  if (!internalToken) {
    res
      .status(401)
      .json(createErrorResponse("UNAUTHORIZED", "Missing internal token"));
    return;
  }
  try {
    verifyInternalToken(internalToken);
    next();
  } catch {
    res
      .status(401)
      .json(createErrorResponse("UNAUTHORIZED", "Invalid internal token"));
  }
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const role = req.headers["x-user-role"] as string | undefined;
  if (role !== "admin") {
    res
      .status(403)
      .json(createErrorResponse("FORBIDDEN", "Admin access required"));
    return;
  }
  next();
}

// ─── Request Logging ───────────────────────────────────────────────────────
app.use((req: Request, _res: Response, next: NextFunction) => {
  const requestId =
    (req.headers["x-request-id"] as string | undefined) ?? generateRequestId();
  logger.info(`${req.method} ${req.path}`, undefined, { requestId });
  next();
});

// ─── Routes ────────────────────────────────────────────────────────────────

// GET /v1/products — public paginated listing
app.get(
  "/v1/products",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = Math.max(1, Number(req.query["page"] ?? 1));
      const limit = Math.min(50, Math.max(1, Number(req.query["limit"] ?? 12)));
      const category =
        typeof req.query["category"] === "string"
          ? req.query["category"]
          : undefined;
      const offset = (page - 1) * limit;

      let query = supabase
        .from("products")
        .select(
          "id, name, slug, price, discount_price, category_id, categories(name), product_images(image_url, is_primary)",
          { count: "exact" },
        )
        .eq("is_active", true)
        .range(offset, offset + limit - 1)
        .order("created_at", { ascending: false });

      if (category) query = query.eq("categories.slug", category);

      const { data, error, count } = await query;
      if (error) {
        res
          .status(500)
          .json(createErrorResponse("DB_ERROR", "Failed to fetch products"));
        return;
      }
      res.json(createPaginatedResponse(data ?? [], count ?? 0, page, limit));
    } catch (err) {
      next(err);
    }
  },
);

// GET /v1/products/:slug — public product detail
app.get(
  "/v1/products/:slug",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*, categories(id, name, slug), product_images(*)")
        .eq("slug", req.params["slug"])
        .eq("is_active", true)
        .single();

      if (error || !data) {
        res
          .status(404)
          .json(createErrorResponse("NOT_FOUND", "Product not found"));
        return;
      }
      res.json(createSuccessResponse(data));
    } catch (err) {
      next(err);
    }
  },
);

// GET /v1/categories — public
app.get(
  "/v1/categories",
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, slug")
        .order("name");
      if (error) {
        res
          .status(500)
          .json(createErrorResponse("DB_ERROR", "Failed to fetch categories"));
        return;
      }
      res.json(createSuccessResponse(data ?? []));
    } catch (err) {
      next(err);
    }
  },
);

// POST /v1/products (admin only)
app.post(
  "/v1/products",
  requireGateway,
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as {
        name: string;
        slug: string;
        description?: string;
        price: number;
        discount_price?: number;
        category_id: string;
        is_active?: boolean;
      };
      if (!body.name || !body.slug || !body.price || !body.category_id) {
        res
          .status(400)
          .json(
            createErrorResponse(
              "VALIDATION_ERROR",
              "Missing required product fields",
            ),
          );
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from("products") as any)
        .insert(body)
        .select()
        .single();
      if (error) {
        res.status(409).json(createErrorResponse("CONFLICT", error.message));
        return;
      }
      res.status(201).json(createSuccessResponse(data, "Product created"));
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /v1/products/:id (admin only)
app.patch(
  "/v1/products/:id",
  requireGateway,
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from("products") as any)
        .update({
          ...(req.body as Record<string, unknown>),
          updated_at: new Date().toISOString(),
        })
        .eq("id", req.params["id"])
        .select()
        .single();
      if (error) {
        res
          .status(500)
          .json(
            createErrorResponse("UPDATE_FAILED", "Failed to update product"),
          );
        return;
      }
      res.json(createSuccessResponse(data, "Product updated"));
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /v1/products/:id (admin only — soft delete)
app.delete(
  "/v1/products/:id",
  requireGateway,
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from("products") as any)
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", req.params["id"]);
      if (error) {
        res
          .status(500)
          .json(
            createErrorResponse("DELETE_FAILED", "Failed to delete product"),
          );
        return;
      }
      res.json(createSuccessResponse(null, "Product deactivated"));
    } catch (err) {
      next(err);
    }
  },
);

// ─── Health Check ──────────────────────────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "product-service",
    timestamp: new Date().toISOString(),
  });
});

// ─── Global Error Handler ──────────────────────────────────────────────────
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error("Unhandled error", err);
  res
    .status(500)
    .json(
      createErrorResponse("INTERNAL_ERROR", "An unexpected error occurred"),
    );
});

app.listen(PORT, () => {
  logger.info(`Product Service running on port ${PORT}`);
});

export default app;
