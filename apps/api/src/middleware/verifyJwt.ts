/**
 * JWT verification middleware for the backend API.
 *
 * Extracts the access_token from the httpOnly cookie,
 * verifies it using the RS256 PUBLIC KEY (private key never here),
 * and attaches the decoded payload to req.user.
 *
 * Security:
 * - Only the public key is used here — the private key stays on the Auth Service
 * - Tokens are read from httpOnly cookies (never localStorage)
 * - Expired tokens return 401
 */

import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "@ayurveda/shared-types";
import { createErrorResponse, logger } from "@ayurveda/shared-utils";

function loadPublicKey(): string {
  const key = process.env["JWT_PUBLIC_KEY"];
  if (!key) throw new Error("JWT_PUBLIC_KEY environment variable is required");
  return key.replace(/\\n/g, "\n");
}

// Extend Express Request type
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
      requestId?: string;
    }
  }
}

/**
 * Middleware: requires a valid RS256 access token in the access_token cookie.
 */
export function verifyJwt(
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
    const decoded = jwt.verify(token, loadPublicKey(), {
      algorithms: ["RS256"],
    });
    req.user = decoded as JwtPayload;
    next();
  } catch (error) {
    logger.warn("JWT verification failed", undefined, {
      ...(req.requestId !== undefined && { requestId: req.requestId }),
    });
    if (error instanceof jwt.TokenExpiredError) {
      res
        .status(401)
        .json(createErrorResponse("TOKEN_EXPIRED", "Access token has expired"));
      return;
    }
    res
      .status(401)
      .json(createErrorResponse("INVALID_TOKEN", "Invalid access token"));
  }
}
