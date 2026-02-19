/**
 * JWT crypto helpers — RS256 sign and verify.
 *
 * The private key is used exclusively here, in the Auth Service.
 * The public key is distributed to backend services for VERIFICATION ONLY.
 *
 * SECURITY: Private key is NEVER committed. It is loaded from an environment variable.
 */

import jwt from "jsonwebtoken";
import type { JwtPayload } from "@ayurveda/shared-types";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_DAYS,
} from "@ayurveda/shared-utils";

// ─── Key Loading ──────────────────────────────────────────────────────────────

function loadPrivateKey(): string {
  const key = process.env["JWT_PRIVATE_KEY"];
  if (!key) {
    throw new Error("JWT_PRIVATE_KEY environment variable is required");
  }
  // Allow newline escapes in env vars (common in CI environments)
  return key.replace(/\\n/g, "\n");
}

function loadPublicKey(): string {
  const key = process.env["JWT_PUBLIC_KEY"];
  if (!key) {
    throw new Error("JWT_PUBLIC_KEY environment variable is required");
  }
  return key.replace(/\\n/g, "\n");
}

// ─── Access Token ─────────────────────────────────────────────────────────────

/**
 * Signs a short-lived access token (10 minutes) using RS256.
 * Payload follows the documented JWT structure.
 */
export function signAccessToken(
  payload: Omit<JwtPayload, "iat" | "exp">,
): string {
  return jwt.sign(payload, loadPrivateKey(), {
    algorithm: "RS256",
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  });
}

/**
 * Verifies and decodes an RS256 access token using the public key.
 * Throws if the token is expired, invalid, or tampered.
 */
export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, loadPublicKey(), {
    algorithms: ["RS256"],
  });
  return decoded as JwtPayload;
}

// ─── Refresh Token ────────────────────────────────────────────────────────────

/**
 * Generates an opaque random refresh token string.
 * The raw token is sent to the client; only the hash is stored in DB.
 */
export function generateRefreshTokenValue(): string {
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("hex");
}

/**
 * Returns the expiry Date for a new refresh token (7 days from now).
 */
export function getRefreshTokenExpiry(): Date {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + REFRESH_TOKEN_TTL_DAYS);
  return expiry;
}

// ─── Public Key Endpoint ──────────────────────────────────────────────────────

/**
 * Returns the public key string for distribution to backend services.
 * Only the PUBLIC key is returned — never the private key.
 */
export function getPublicKey(): string {
  return loadPublicKey();
}
