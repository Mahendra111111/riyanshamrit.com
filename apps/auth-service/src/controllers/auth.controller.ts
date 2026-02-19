/**
 * Auth Controller — request handling layer.
 *
 * Responsibilities:
 * - Parse and validate request input (using Zod schemas)
 * - Call service methods
 * - Set/clear httpOnly cookies
 * - Return structured API responses
 *
 * No business logic here.
 */

import type { Request, Response, NextFunction } from "express";
import { LoginSchema, RegisterSchema } from "@ayurveda/validation-schemas";
import {
  createSuccessResponse,
  createErrorResponse,
  generateRequestId,
  REFRESH_TOKEN_TTL_DAYS,
  logger,
} from "@ayurveda/shared-utils";
import {
  registerUser,
  loginUser,
  refreshTokens,
  logoutUser,
  getCurrentUser,
} from "../services/auth.service.js";
import { getPublicKey } from "../crypto/jwt.js";

// ─── Cookie Helpers ───────────────────────────────────────────────────────────

const IS_PRODUCTION = process.env["NODE_ENV"] === "production";

/**
 * Sets the access_token as a secure httpOnly cookie.
 */
function setAccessTokenCookie(res: Response, token: string): void {
  res.cookie("access_token", token, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "strict",
    // Access token expires in 10 minutes — cookie matches token lifetime
    maxAge: 10 * 60 * 1000,
    path: "/",
  });
}

/**
 * Sets the refresh_token as a secure httpOnly cookie.
 * Path is restricted to the refresh endpoint only.
 */
function setRefreshTokenCookie(
  res: Response,
  token: string,
  expiry: Date,
): void {
  res.cookie("refresh_token", token, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "strict",
    expires: expiry,
    path: "/v1/auth/refresh",
  });
}

/**
 * Clears both auth cookies on logout.
 */
function clearAuthCookies(res: Response): void {
  res.clearCookie("access_token", { path: "/" });
  res.clearCookie("refresh_token", { path: "/v1/auth/refresh" });
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /v1/auth/register
 * Creates a new user account.
 */
export async function registerController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const requestId = generateRequestId();

  try {
    const parseResult = RegisterSchema.safeParse(req.body);
    if (!parseResult.success) {
      res
        .status(400)
        .json(
          createErrorResponse(
            "VALIDATION_ERROR",
            parseResult.error.errors[0]?.message ?? "Invalid input",
          ),
        );
      return;
    }

    const { email, password } = parseResult.data;
    const user = await registerUser(email, password, { requestId });

    res
      .status(201)
      .json(createSuccessResponse(user, "Registration successful"));
  } catch (error) {
    if (error instanceof Error && error.message === "REGISTRATION_FAILED") {
      // Generic message prevents email enumeration
      res
        .status(409)
        .json(
          createErrorResponse(
            "REGISTRATION_FAILED",
            "Unable to create account",
          ),
        );
      return;
    }
    next(error);
  }
}

/**
 * POST /v1/auth/login
 * Authenticates a user and sets httpOnly cookie tokens.
 */
export async function loginController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const requestId = generateRequestId();

  try {
    const parseResult = LoginSchema.safeParse(req.body);
    if (!parseResult.success) {
      res
        .status(400)
        .json(
          createErrorResponse(
            "VALIDATION_ERROR",
            "Invalid email or password format",
          ),
        );
      return;
    }

    const { email, password } = parseResult.data;
    const tokens = await loginUser(email, password, { requestId });

    setAccessTokenCookie(res, tokens.accessToken);
    setRefreshTokenCookie(res, tokens.refreshToken, tokens.refreshTokenExpiry);

    res
      .status(200)
      .json(createSuccessResponse({ message: "Login successful" }));
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_CREDENTIALS") {
      res
        .status(401)
        .json(
          createErrorResponse(
            "INVALID_CREDENTIALS",
            "Invalid email or password",
          ),
        );
      return;
    }
    next(error);
  }
}

/**
 * POST /v1/auth/refresh
 * Validates and rotates the refresh token; issues new token pair.
 */
export async function refreshController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const requestId = generateRequestId();

  try {
    const rawRefreshToken = (req.cookies as Record<string, string | undefined>)[
      "refresh_token"
    ];
    if (!rawRefreshToken) {
      res
        .status(401)
        .json(
          createErrorResponse(
            "MISSING_REFRESH_TOKEN",
            "Refresh token is required",
          ),
        );
      return;
    }

    const tokens = await refreshTokens(rawRefreshToken, { requestId });

    setAccessTokenCookie(res, tokens.accessToken);
    setRefreshTokenCookie(res, tokens.refreshToken, tokens.refreshTokenExpiry);

    res.status(200).json(createSuccessResponse({ message: "Token refreshed" }));
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message === "INVALID_REFRESH_TOKEN" ||
        error.message === "REFRESH_TOKEN_EXPIRED" ||
        error.message === "TOKEN_REUSE_DETECTED"
      ) {
        clearAuthCookies(res);
        res
          .status(401)
          .json(
            createErrorResponse(
              error.message,
              "Session expired. Please log in again.",
            ),
          );
        return;
      }
    }
    next(error);
  }
}

/**
 * POST /v1/auth/logout
 * Revokes the session and clears cookies.
 */
export async function logoutController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const requestId = generateRequestId();

  try {
    const rawRefreshToken = (req.cookies as Record<string, string | undefined>)[
      "refresh_token"
    ];
    const userId = (req as Request & { user?: { sub: string } }).user?.sub;

    // Even if token is missing, clear cookies and return success (idempotent)
    if (rawRefreshToken && userId) {
      await logoutUser(rawRefreshToken, userId, { requestId });
    }

    clearAuthCookies(res);
    res
      .status(200)
      .json(createSuccessResponse({ message: "Logged out successfully" }));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /v1/auth/me
 * Returns the current authenticated user's profile.
 * Requires a valid access token (via authenticate middleware).
 */
export async function getMeController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = (req as Request & { user?: { sub: string } }).user?.sub;
    if (!userId) {
      res
        .status(401)
        .json(createErrorResponse("UNAUTHORIZED", "Authentication required"));
      return;
    }

    const user = await getCurrentUser(userId);
    res.status(200).json(createSuccessResponse(user));
  } catch (error) {
    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      res
        .status(404)
        .json(createErrorResponse("USER_NOT_FOUND", "User not found"));
      return;
    }
    next(error);
  }
}

/**
 * GET /public-key
 * Returns the RS256 public key for backend services to use for JWT verification.
 * This endpoint is intentionally public.
 */
export function getPublicKeyController(_req: Request, res: Response): void {
  const publicKey = getPublicKey();
  res.status(200).json(createSuccessResponse({ publicKey }));
}
