/**
 * @package @ayurveda/shared-utils
 *
 * Shared utility functions for the Ayurveda platform.
 * Pure functions only — no external service calls, no database access.
 */

import { v4 as uuidV4 } from "uuid";
import type {
  ApiSuccessResponse,
  ApiErrorResponse,
} from "@ayurveda/shared-types";

// ─── Response Formatters ──────────────────────────────────────────────────────

/**
 * Creates a standard API success response.
 * All backend controllers must use this wrapper.
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string,
): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    ...(message !== undefined && { message }),
  };
}

/**
 * Creates a standard API error response.
 * Never exposes internal stack traces.
 */
export function createErrorResponse(
  code: string,
  message: string,
): ApiErrorResponse {
  return {
    success: false,
    error: { code, message },
  };
}

/**
 * Creates a paginated API response with meta information.
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): ApiSuccessResponse<T[]> & {
  meta: { total: number; page: number; limit: number; totalPages: number };
} {
  return {
    success: true,
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ─── Request ID ───────────────────────────────────────────────────────────────

/**
 * Generates a unique request ID for distributed tracing.
 * Attached to every incoming request.
 */
export function generateRequestId(): string {
  return uuidV4();
}

// ─── Logger ───────────────────────────────────────────────────────────────────

type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  requestId?: string;
  userId?: string;
  message: string;
  meta?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Structured logger. Never logs passwords, tokens, or secrets.
 * Use this instead of console.log in all backend code.
 */
export const logger = {
  info(
    message: string,
    meta?: Record<string, unknown>,
    context?: { requestId?: string; userId?: string },
  ): void {
    const entry: LogEntry = {
      level: "info",
      message,
      timestamp: new Date().toISOString(),
      ...(context?.requestId !== undefined && { requestId: context.requestId }),
      ...(context?.userId !== undefined && { userId: context.userId }),
      ...(meta !== undefined && { meta }),
    };
    process.stdout.write(JSON.stringify(entry) + "\n");
  },

  warn(
    message: string,
    meta?: Record<string, unknown>,
    context?: { requestId?: string; userId?: string },
  ): void {
    const entry: LogEntry = {
      level: "warn",
      message,
      timestamp: new Date().toISOString(),
      ...(context?.requestId !== undefined && { requestId: context.requestId }),
      ...(context?.userId !== undefined && { userId: context.userId }),
      ...(meta !== undefined && { meta }),
    };
    process.stdout.write(JSON.stringify(entry) + "\n");
  },

  error(
    message: string,
    error?: unknown,
    context?: { requestId?: string; userId?: string },
  ): void {
    const entry: LogEntry = {
      level: "error",
      message,
      timestamp: new Date().toISOString(),
      ...(context?.requestId !== undefined && { requestId: context.requestId }),
      ...(context?.userId !== undefined && { userId: context.userId }),
      // Only log the error message — never the full stack in production
      meta: {
        errorMessage:
          error instanceof Error ? error.message : String(error ?? "unknown"),
      },
    };
    process.stderr.write(JSON.stringify(entry) + "\n");
  },
};

// ─── Date Utilities ───────────────────────────────────────────────────────────

/**
 * Adds a number of seconds to a Date and returns the result.
 */
export function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

/**
 * Adds a number of days to a Date and returns the result.
 */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Returns an ISO 8601 timestamp string for the current moment.
 */
export function nowIso(): string {
  return new Date().toISOString();
}

// ─── Error Helpers ────────────────────────────────────────────────────────────

/**
 * Type guard to check if an unknown value is an Error instance.
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Safely extracts an error message from an unknown thrown value.
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) return error.message;
  return "An unexpected error occurred";
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Access token lifetime in seconds (10 minutes) */
export const ACCESS_TOKEN_TTL_SECONDS = 10 * 60;

/** Refresh token lifetime in days (7 days) */
export const REFRESH_TOKEN_TTL_DAYS = 7;

/** Refresh token cookie path — restricted to refresh endpoint only */
export const REFRESH_TOKEN_COOKIE_PATH = "/v1/auth/refresh";

// ─── Internal Service Token ───────────────────────────────────────────────────

import * as crypto from "crypto";

const INTERNAL_SECRET_ENV = "INTERNAL_SERVICE_SECRET";

/**
 * Signs a short-lived HMAC-SHA256 internal service token.
 * Services call each other using this token (NOT the external RS256 JWT).
 * Token expires in 60 seconds.
 */
export function signInternalToken(payload: {
  service: string;
  requestId: string;
}): string {
  const secret = process.env[INTERNAL_SECRET_ENV] ?? "dev-internal-secret";
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 60;
  const data = JSON.stringify({ ...payload, iat, exp });
  const encoded = Buffer.from(data).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(encoded)
    .digest("hex");
  return `${encoded}.${signature}`;
}

/**
 * Verifies an internal service token. Throws if invalid or expired.
 */
export function verifyInternalToken(token: string): {
  service: string;
  requestId: string;
  iat: number;
  exp: number;
} {
  const secret = process.env[INTERNAL_SECRET_ENV] ?? "dev-internal-secret";
  const parts = token.split(".");
  const encoded = parts[0];
  const signature = parts[1];
  if (!encoded || !signature) throw new Error("INVALID_INTERNAL_TOKEN");
  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(encoded)
    .digest("hex");
  if (
    !crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expectedSig, "hex"),
    )
  ) {
    throw new Error("INVALID_INTERNAL_TOKEN");
  }
  const payload = JSON.parse(
    Buffer.from(encoded, "base64url").toString("utf-8"),
  ) as { service: string; requestId: string; iat: number; exp: number };
  if (Math.floor(Date.now() / 1000) > payload.exp) {
    throw new Error("INTERNAL_TOKEN_EXPIRED");
  }
  return payload;
}

// ─── Redis Streams Event Bus ──────────────────────────────────────────────────

export type DomainEvent =
  | {
      type: "ORDER_CREATED";
      orderId: string;
      userId: string;
      totalAmount: string;
      requestId: string;
    }
  | {
      type: "PAYMENT_CAPTURED";
      orderId: string;
      paymentId: string;
      requestId: string;
    }
  | { type: "PAYMENT_FAILED"; orderId: string; requestId: string };

export const EVENT_STREAMS = {
  ORDER: "ayurveda:events:order",
  PAYMENT: "ayurveda:events:payment",
} as const;

/**
 * Publishes a domain event to a Redis Stream.
 * Non-throwing — logs error and continues if Redis is unavailable.
 */
export async function publishEvent(
  redis: {
    xadd: (stream: string, id: string, ...args: string[]) => Promise<unknown>;
  },
  stream: string,
  event: DomainEvent,
): Promise<void> {
  try {
    const fields: string[] = [];
    for (const [key, value] of Object.entries(event)) {
      fields.push(key, String(value));
    }
    await redis.xadd(stream, "*", ...fields);
  } catch (err) {
    process.stderr.write(
      JSON.stringify({
        level: "error",
        message: "Event publish failed",
        stream,
        err: String(err),
      }) + "\n",
    );
  }
}
