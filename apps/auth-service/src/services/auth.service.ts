/**
 * Auth Service — business logic for authentication.
 *
 * Responsibilities:
 * - Password hashing and comparison
 * - Token generation (access + refresh)
 * - Refresh token rotation with replay attack prevention
 * - Logout with full session revocation
 */

import bcrypt from "bcryptjs";
import crypto from "crypto";
import type { User } from "@ayurveda/shared-types";
import { logger, getErrorMessage } from "@ayurveda/shared-utils";
import {
  signAccessToken,
  generateRefreshTokenValue,
  getRefreshTokenExpiry,
} from "../crypto/jwt.js";
import {
  blacklistRefreshToken,
  isRefreshTokenBlacklisted,
} from "../utils/redis.js";
import {
  findUserByEmail,
  findUserById,
  createUser,
  createRefreshSession,
  findRefreshSessionByHash,
  rotateRefreshSession,
  revokeAllUserSessions,
} from "../repositories/auth.repository.js";

/** bcrypt salt rounds — 12 is a good balance of security and performance */
const BCRYPT_SALT_ROUNDS = 12;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiry: Date;
}

export interface AuthUser {
  id: string;
  email: string;
  role: "user" | "admin";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Hashes a refresh token value using SHA-256 for secure DB storage.
 * We never store the plaintext refresh token.
 */
function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Builds an AuthUser (public-safe view) from a DB user */
function toAuthUser(dbUser: {
  id: string;
  email: string;
  role: "user" | "admin";
}): AuthUser {
  return { id: dbUser.id, email: dbUser.email, role: dbUser.role };
}

// ─── Register ─────────────────────────────────────────────────────────────────

/**
 * Registers a new user account.
 * Hashes password before storage. Returns early with generic message to prevent
 * email enumeration attacks.
 */
export async function registerUser(
  email: string,
  password: string,
  context: { requestId: string },
): Promise<AuthUser> {
  logger.info("User registration attempt", { email }, context);

  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  try {
    const user = await createUser({ email, password_hash: passwordHash });
    logger.info("User registered successfully", { userId: user.id }, context);
    return toAuthUser(user);
  } catch (error) {
    if (getErrorMessage(error) === "EMAIL_ALREADY_EXISTS") {
      // Return generic error — never reveal if email exists
      throw new Error("REGISTRATION_FAILED");
    }
    throw error;
  }
}

// ─── Login ────────────────────────────────────────────────────────────────────

/**
 * Authenticates a user and issues a new token pair.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export async function loginUser(
  email: string,
  password: string,
  context: { requestId: string },
): Promise<TokenPair> {
  logger.info("Login attempt", { email }, context);

  const user = await findUserByEmail(email);

  // Always run bcrypt.compare to prevent timing attacks, even if user not found
  const hashToCompare =
    user?.password_hash ?? "$2b$12$invalidhashfortimingprotection";
  const isValid = await bcrypt.compare(password, hashToCompare);

  if (!user || !isValid) {
    // Generic error prevents username enumeration
    throw new Error("INVALID_CREDENTIALS");
  }

  const tokens = await issueTokenPair(user.id, user.role, user.email, context);
  logger.info("Login successful", { userId: user.id }, context);
  return tokens;
}

// ─── Refresh Token ────────────────────────────────────────────────────────────

/**
 * Rotates a refresh token and issues a new token pair.
 *
 * Security:
 * 1. Validates refresh token exists in DB and is not revoked
 * 2. Checks Redis blacklist for previously revoked token
 * 3. Detects replay attacks (used token → revoke ALL user sessions)
 * 4. Issues new tokens and blacklists the old refresh token
 */
export async function refreshTokens(
  rawRefreshToken: string,
  context: { requestId: string },
): Promise<TokenPair> {
  const tokenHash = hashRefreshToken(rawRefreshToken);

  logger.info("Token refresh attempt", undefined, context);

  // Check Redis blacklist first (fast path)
  const isBlacklisted = await isRefreshTokenBlacklisted(tokenHash);
  if (isBlacklisted) {
    logger.warn(
      "Replay attack detected — blacklisted token used",
      undefined,
      context,
    );
    throw new Error("TOKEN_REUSE_DETECTED");
  }

  // Lookup session in DB
  const session = await findRefreshSessionByHash(tokenHash);
  if (!session) {
    logger.warn(
      "Invalid or already-revoked refresh token used",
      undefined,
      context,
    );
    throw new Error("INVALID_REFRESH_TOKEN");
  }

  // Check if token has expired
  if (new Date(session.expires_at) < new Date()) {
    throw new Error("REFRESH_TOKEN_EXPIRED");
  }

  // Get user details for new token payload
  const user = await findUserById(session.user_id);
  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  // Generate new tokens
  const newRawToken = generateRefreshTokenValue();
  const newTokenHash = hashRefreshToken(newRawToken);
  const newExpiry = getRefreshTokenExpiry();

  // Rotate: mark old session as revoked + create new session
  await rotateRefreshSession({
    old_session_id: session.id,
    user_id: user.id,
    new_token_hash: newTokenHash,
    new_expires_at: newExpiry,
  });

  // Blacklist the old refresh token in Redis
  await blacklistRefreshToken(tokenHash);

  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    permissions: getPermissionsForRole(user.role),
  });

  logger.info("Token rotated successfully", { userId: user.id }, context);

  return {
    accessToken,
    refreshToken: newRawToken,
    refreshTokenExpiry: newExpiry,
  };
}

// ─── Logout ───────────────────────────────────────────────────────────────────

/**
 * Logs out a user: revokes all DB sessions and blacklists the current refresh token.
 */
export async function logoutUser(
  rawRefreshToken: string,
  userId: string,
  context: { requestId: string },
): Promise<void> {
  logger.info("Logout attempt", { userId }, context);

  const tokenHash = hashRefreshToken(rawRefreshToken);

  // Revoke all sessions for this user in DB
  await revokeAllUserSessions(userId);

  // Blacklist the current refresh token in Redis
  await blacklistRefreshToken(tokenHash);

  logger.info("Logout successful", { userId }, context);
}

// ─── Get Current User ─────────────────────────────────────────────────────────

/**
 * Returns the public user profile for an authenticated user.
 */
export async function getCurrentUser(userId: string): Promise<User> {
  const user = await findUserById(userId);
  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    is_verified: user.is_verified,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Issues a fresh token pair: access token + refresh token stored (hashed) in DB.
 */
async function issueTokenPair(
  userId: string,
  role: "user" | "admin",
  _email: string,
  context: { requestId: string },
): Promise<TokenPair> {
  const rawRefreshToken = generateRefreshTokenValue();
  const tokenHash = hashRefreshToken(rawRefreshToken);
  const refreshExpiry = getRefreshTokenExpiry();

  await createRefreshSession({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: refreshExpiry,
  });

  const accessToken = signAccessToken({
    sub: userId,
    role,
    permissions: getPermissionsForRole(role),
  });

  logger.info("Token pair issued", { userId }, context);

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    refreshTokenExpiry: refreshExpiry,
  };
}

/**
 * Returns the permission set for a given role.
 * Permissions are embedded in the JWT payload.
 */
function getPermissionsForRole(role: "user" | "admin"): string[] {
  if (role === "admin") {
    return [
      "read_products",
      "write_products",
      "delete_products",
      "read_orders",
      "manage_orders",
      "place_order",
      "read_users",
    ];
  }
  return ["read_products", "place_order", "read_own_orders"];
}
