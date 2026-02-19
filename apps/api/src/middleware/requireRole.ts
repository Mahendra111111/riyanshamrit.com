/**
 * Role and permission guard middleware.
 *
 * Usage:
 *   router.post("/products", verifyJwt, requireRole("admin"), handler)
 *   router.get("/orders", verifyJwt, requirePermission("read_own_orders"), handler)
 */

import type { Request, Response, NextFunction } from "express";
import type { UserRole } from "@ayurveda/shared-types";
import { createErrorResponse } from "@ayurveda/shared-utils";

/**
 * Requires a specific role. Admin includes all user permissions.
 */
export function requireRole(role: UserRole) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res
        .status(401)
        .json(createErrorResponse("UNAUTHORIZED", "Authentication required"));
      return;
    }
    if (req.user.role !== role) {
      res
        .status(403)
        .json(createErrorResponse("FORBIDDEN", "Insufficient role"));
      return;
    }
    next();
  };
}

/**
 * Requires a specific permission in the JWT payload.
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res
        .status(401)
        .json(createErrorResponse("UNAUTHORIZED", "Authentication required"));
      return;
    }
    if (!req.user.permissions.includes(permission)) {
      res
        .status(403)
        .json(createErrorResponse("FORBIDDEN", "Insufficient permissions"));
      return;
    }
    next();
  };
}
