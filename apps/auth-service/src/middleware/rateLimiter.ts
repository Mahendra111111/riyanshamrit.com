/**
 * Rate limiting middleware for authentication endpoints.
 *
 * Strict limits applied to:
 * - POST /login
 * - POST /register
 * - POST /refresh
 *
 * Prevents brute-force and credential stuffing attacks.
 */

import rateLimit from "express-rate-limit";
import { createErrorResponse } from "@ayurveda/shared-utils";

/** Login rate limit: 10 attempts per 15 minutes per IP */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: createErrorResponse(
    "RATE_LIMIT_EXCEEDED",
    "Too many login attempts. Please try again in 15 minutes.",
  ),
});

/** Register rate limit: 5 registrations per hour per IP */
export const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: createErrorResponse(
    "RATE_LIMIT_EXCEEDED",
    "Too many registration attempts. Please try again later.",
  ),
});

/** Refresh rate limit: 30 refreshes per 15 minutes per IP */
export const refreshRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: createErrorResponse(
    "RATE_LIMIT_EXCEEDED",
    "Too many refresh attempts. Please log in again.",
  ),
});
