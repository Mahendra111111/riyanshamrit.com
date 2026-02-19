/**
 * Authentication middleware for protected routes.
 *
 * Extracts the access_token from the httpOnly cookie, verifies RS256 signature,
 * and attaches the decoded payload to req.user.
 *
 * Used by: GET /v1/auth/me, POST /v1/auth/logout
 */

import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../crypto/jwt.js";
import { createErrorResponse, logger } from "@ayurveda/shared-utils";
import type { JwtPayload } from "@ayurveda/shared-types";

// Extend Express Request to carry the JWT payload
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Middleware: requires a valid access_token cookie.
 * Returns 401 if missing or invalid.
 */
export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token = (req.cookies as Record<string, string | undefined>)[
    "access_token"
  ];

  if (!token) {
    res
      .status(401)
      .json(createErrorResponse("UNAUTHORIZED", "Authentication required"));
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    logger.warn("Invalid access token", undefined, { requestId: "middleware" });
    res
      .status(401)
      .json(createErrorResponse("INVALID_TOKEN", "Invalid or expired token"));
  }
}
