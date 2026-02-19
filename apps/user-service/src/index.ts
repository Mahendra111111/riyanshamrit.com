/**
 * User Service — Profile & Address Management
 * Port: 3003
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
  verifyInternalToken,
  logger,
} from "@ayurveda/shared-utils";

const app: Application = express();
const PORT = Number(process.env["PORT"] ?? 3003);
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

// ─── Internal Auth Middleware ──────────────────────────────────────────────
// All requests come from the API Gateway, which attaches user headers.
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

// ─── Request Logging ───────────────────────────────────────────────────────
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

// ─── Routes ────────────────────────────────────────────────────────────────

// GET /v1/users/me
app.get(
  "/v1/users/me",
  requireGateway,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.headers["x-user-id"] as string | undefined;
      if (!userId) {
        res.status(401).json(createErrorResponse("UNAUTHORIZED", "No user ID"));
        return;
      }

      const { data, error } = await supabase
        .from("users")
        .select("id, email, role, is_verified, created_at, updated_at")
        .eq("id", userId)
        .single();

      if (error || !data) {
        res
          .status(404)
          .json(createErrorResponse("NOT_FOUND", "User not found"));
        return;
      }
      res.json(createSuccessResponse(data));
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /v1/users/me
app.patch(
  "/v1/users/me",
  requireGateway,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.headers["x-user-id"] as string | undefined;
      if (!userId) {
        res.status(401).json(createErrorResponse("UNAUTHORIZED", "No user ID"));
        return;
      }

      // Only allow safe field updates — never email/password/role via this endpoint
      const { full_name, phone } = req.body as {
        full_name?: string;
        phone?: string;
      };
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (full_name !== undefined) updates["full_name"] = full_name;
      if (phone !== undefined) updates["phone"] = phone;

      const { data, error } = await supabase
        .from("users")
        .update(updates)
        .eq("id", userId)
        .select("id, email, role, is_verified, created_at, updated_at")
        .single();

      if (error) {
        res
          .status(500)
          .json(
            createErrorResponse("UPDATE_FAILED", "Failed to update profile"),
          );
        return;
      }
      res.json(createSuccessResponse(data, "Profile updated"));
    } catch (err) {
      next(err);
    }
  },
);

// GET /v1/users/me/addresses
app.get(
  "/v1/users/me/addresses",
  requireGateway,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.headers["x-user-id"] as string | undefined;
      if (!userId) {
        res.status(401).json(createErrorResponse("UNAUTHORIZED", "No user ID"));
        return;
      }

      const { data, error } = await supabase
        .from("addresses")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        res
          .status(500)
          .json(createErrorResponse("DB_ERROR", "Failed to fetch addresses"));
        return;
      }
      res.json(createSuccessResponse(data ?? []));
    } catch (err) {
      next(err);
    }
  },
);

// POST /v1/users/me/addresses
app.post(
  "/v1/users/me/addresses",
  requireGateway,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.headers["x-user-id"] as string | undefined;
      if (!userId) {
        res.status(401).json(createErrorResponse("UNAUTHORIZED", "No user ID"));
        return;
      }

      const { line1, line2, city, state, pincode, country, is_default } =
        req.body as {
          line1: string;
          line2?: string;
          city: string;
          state: string;
          pincode: string;
          country: string;
          is_default?: boolean;
        };

      if (!line1 || !city || !state || !pincode || !country) {
        res
          .status(400)
          .json(
            createErrorResponse(
              "VALIDATION_ERROR",
              "Missing required address fields",
            ),
          );
        return;
      }

      const { data, error } = await supabase
        .from("addresses")
        .insert({
          user_id: userId,
          line1,
          line2,
          city,
          state,
          pincode,
          country,
          is_default: is_default ?? false,
        })
        .select()
        .single();

      if (error) {
        res
          .status(500)
          .json(createErrorResponse("DB_ERROR", "Failed to create address"));
        return;
      }
      res.status(201).json(createSuccessResponse(data, "Address created"));
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /v1/users/me/addresses/:id
app.delete(
  "/v1/users/me/addresses/:id",
  requireGateway,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.headers["x-user-id"] as string | undefined;
      if (!userId) {
        res.status(401).json(createErrorResponse("UNAUTHORIZED", "No user ID"));
        return;
      }

      const { error } = await supabase
        .from("addresses")
        .delete()
        .eq("id", req.params["id"])
        .eq("user_id", userId); // IDOR protection

      if (error) {
        res
          .status(500)
          .json(createErrorResponse("DB_ERROR", "Failed to delete address"));
        return;
      }
      res.json(createSuccessResponse(null, "Address deleted"));
    } catch (err) {
      next(err);
    }
  },
);

// ─── Health Check ──────────────────────────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "user-service",
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
  logger.info(`User Service running on port ${PORT}`);
});

export default app;
