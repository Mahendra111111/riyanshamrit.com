/**
 * Auth Repository — Supabase database access layer.
 *
 * ONLY this file performs database reads/writes for authentication.
 * No business logic. No token generation. Data access only.
 */

import { createClient } from "@supabase/supabase-js";
import { logger } from "@ayurveda/shared-utils";

// ─── Supabase Client ──────────────────────────────────────────────────────────

function getSupabaseClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

// ─── User Interfaces ──────────────────────────────────────────────────────────

export interface DbUser {
  id: string;
  email: string;
  password_hash: string;
  role: "user" | "admin";
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbRefreshSession {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  is_revoked: boolean;
  created_at: string;
}

// ─── User Operations ──────────────────────────────────────────────────────────

/**
 * Finds a user by their email address.
 * Returns null if not found.
 */
export async function findUserByEmail(email: string): Promise<DbUser | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // row not found
    logger.error("findUserByEmail DB error", error);
    throw new Error("Database error while fetching user");
  }

  return data as DbUser;
}

/**
 * Finds a user by their ID.
 * Returns null if not found.
 */
export async function findUserById(id: string): Promise<DbUser | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, email, role, is_verified, created_at, updated_at")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    logger.error("findUserById DB error", error);
    throw new Error("Database error while fetching user");
  }

  return data as DbUser;
}

/**
 * Creates a new user record.
 * Password hash (bcrypt) is provided by the service layer.
 */
export async function createUser(params: {
  email: string;
  password_hash: string;
  role?: "user" | "admin";
}): Promise<DbUser> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("users")
    .insert({
      email: params.email,
      password_hash: params.password_hash,
      role: params.role ?? "user",
      is_verified: false,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("EMAIL_ALREADY_EXISTS");
    }
    logger.error("createUser DB error", error);
    throw new Error("Database error while creating user");
  }

  return data as DbUser;
}

// ─── Refresh Session Operations ───────────────────────────────────────────────

/**
 * Creates a new refresh session record.
 * Stores the HASH of the refresh token — never the plaintext.
 */
export async function createRefreshSession(params: {
  user_id: string;
  token_hash: string;
  expires_at: Date;
}): Promise<DbRefreshSession> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("refresh_sessions")
    .insert({
      user_id: params.user_id,
      token_hash: params.token_hash,
      expires_at: params.expires_at.toISOString(),
      is_revoked: false,
    })
    .select()
    .single();

  if (error) {
    logger.error("createRefreshSession DB error", error);
    throw new Error("Database error while creating refresh session");
  }

  return data as DbRefreshSession;
}

/**
 * Finds a refresh session by token hash.
 * Returns null if not found or already revoked.
 */
export async function findRefreshSessionByHash(
  tokenHash: string,
): Promise<DbRefreshSession | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("refresh_sessions")
    .select("*")
    .eq("token_hash", tokenHash)
    .eq("is_revoked", false)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    logger.error("findRefreshSessionByHash DB error", error);
    throw new Error("Database error while fetching refresh session");
  }

  return data as DbRefreshSession;
}

/**
 * Rotates a refresh session: marks old token as revoked and creates a new one.
 * This is a two-step operation (no DB transaction here; idempotency is on service layer).
 */
export async function rotateRefreshSession(params: {
  old_session_id: string;
  user_id: string;
  new_token_hash: string;
  new_expires_at: Date;
}): Promise<DbRefreshSession> {
  const supabase = getSupabaseClient();

  // Mark old session as revoked
  const { error: revokeError } = await supabase
    .from("refresh_sessions")
    .update({ is_revoked: true })
    .eq("id", params.old_session_id);

  if (revokeError) {
    logger.error("rotateRefreshSession revoke error", revokeError);
    throw new Error("Database error while revoking old session");
  }

  // Create new session
  return createRefreshSession({
    user_id: params.user_id,
    token_hash: params.new_token_hash,
    expires_at: params.new_expires_at,
  });
}

/**
 * Revokes all refresh sessions for a user (used on logout or security breach).
 */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("refresh_sessions")
    .update({ is_revoked: true })
    .eq("user_id", userId);

  if (error) {
    logger.error("revokeAllUserSessions DB error", error);
    throw new Error("Database error while revoking user sessions");
  }
}
