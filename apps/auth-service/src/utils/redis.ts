/**
 * Redis client for token blacklisting and session management.
 *
 * Security:
 * - Token blacklist TTL matches token expiration
 * - Used to prevent replay attacks on revoked refresh tokens
 */

import Redis from "ioredis";
import { logger } from "@ayurveda/shared-utils";
import {
  REFRESH_TOKEN_TTL_DAYS,
  ACCESS_TOKEN_TTL_SECONDS,
} from "@ayurveda/shared-utils";

// ─── Client Singleton ─────────────────────────────────────────────────────────

let _redis: Redis | null = null;

export function getRedisClient(): Redis {
  if (!_redis) {
    const url = process.env["REDIS_URL"];
    if (!url) {
      throw new Error("REDIS_URL environment variable is required");
    }
    _redis = new Redis(url, {
      lazyConnect: false,
      maxRetriesPerRequest: 3,
    });

    _redis.on("error", (err: Error) => {
      logger.error("Redis connection error", err);
    });

    _redis.on("connect", () => {
      logger.info("Redis connected");
    });
  }
  return _redis;
}

// ─── Refresh Token Blacklist ──────────────────────────────────────────────────

const BLACKLIST_PREFIX = "blacklist:refresh:";

/**
 * Adds a refresh token hash to the Redis blacklist.
 * TTL is set to 7 days (refresh token lifetime).
 */
export async function blacklistRefreshToken(tokenHash: string): Promise<void> {
  const redis = getRedisClient();
  const ttlSeconds = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60;
  await redis.setex(`${BLACKLIST_PREFIX}${tokenHash}`, ttlSeconds, "1");
}

/**
 * Checks if a refresh token hash is in the blacklist.
 */
export async function isRefreshTokenBlacklisted(
  tokenHash: string,
): Promise<boolean> {
  const redis = getRedisClient();
  const result = await redis.get(`${BLACKLIST_PREFIX}${tokenHash}`);
  return result !== null;
}

// ─── Access Token Blacklist (optional — for logout invalidation) ──────────────

const ACCESS_BLACKLIST_PREFIX = "blacklist:access:";

/**
 * Blacklists an access token (used on logout, before natural expiry).
 * TTL is set to access token lifetime.
 */
export async function blacklistAccessToken(jti: string): Promise<void> {
  const redis = getRedisClient();
  await redis.setex(
    `${ACCESS_BLACKLIST_PREFIX}${jti}`,
    ACCESS_TOKEN_TTL_SECONDS,
    "1",
  );
}

/**
 * Checks if an access token JTI is blacklisted.
 */
export async function isAccessTokenBlacklisted(jti: string): Promise<boolean> {
  const redis = getRedisClient();
  const result = await redis.get(`${ACCESS_BLACKLIST_PREFIX}${jti}`);
  return result !== null;
}
