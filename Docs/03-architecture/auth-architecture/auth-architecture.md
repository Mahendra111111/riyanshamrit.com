# Authentication Architecture

## 1. Authentication Philosophy

The system implements a secure, production-grade authentication model using:

- Asymmetric JWT (RS256)
- Short-lived access tokens
- Rotating refresh tokens
- Token blacklisting
- Secure httpOnly cookies
- Zero trust validation across services

Authentication is isolated in a dedicated Auth Service hosted on AWS EC2.

---

# 2. High-Level Architecture

Auth Service (AWS EC2)

- Generates tokens
- Stores refresh sessions
- Rotates refresh tokens
- Exposes public key

Backend Services (Vercel)

- Verify access tokens
- Enforce role-based permissions
- Never generate tokens

Database (Supabase)

- Users table
- Refresh sessions table

Redis

- Token blacklist
- Suspicious activity tracking

---

# 3. Token Model

The system uses a dual-token strategy:

1. Access Token (short-lived)
2. Refresh Token (long-lived, rotating)

---

# 4. Access Token

## 4.1 Properties

- Algorithm: RS256
- Signed using Auth Service private key
- Verified using public key
- Validity: 10–15 minutes
- Stored in httpOnly secure cookie

## 4.2 Purpose

- Used for API authorization
- Sent automatically via cookie
- Verified on every backend request

## 4.3 Payload Structure

Example:

{
"sub": "user_id",
"role": "user",
"permissions": ["read_products", "place_order"],
"iat": 1700000000,
"exp": 1700000900
}

Fields:

sub → User ID
role → user or admin
permissions → granular access rights
iat → issued at timestamp
exp → expiration timestamp

---

# 5. Refresh Token (Rotating Model)

## 5.1 Properties

- Long-lived (7 days)
- Rotated on every use
- Stored in httpOnly secure cookie
- Hashed before storing in database

## 5.2 Rotation Strategy

Each time refresh token is used:

1. Old refresh token is invalidated
2. New refresh token is generated
3. Old token is added to blacklist
4. Database record is updated

This prevents replay attacks.

---

# 6. Authentication Flow

## 6.1 Login Flow

1. User sends POST /login
2. Auth Service verifies credentials
3. Access Token generated
4. Refresh Token generated
5. Refresh token hash stored in DB
6. Tokens sent as httpOnly cookies

Cookies:

Set-Cookie: access_token
Set-Cookie: refresh_token

---

## 6.2 Authenticated API Request

1. Client sends request to backend
2. Backend extracts access token from cookie
3. Verifies JWT using public key
4. If valid → request processed
5. If expired → return 401

---

## 6.3 Token Refresh Flow

When access token expires:

1. Client calls POST /refresh
2. Auth Service verifies refresh token
3. Checks token hash in DB
4. Ensures token is not blacklisted
5. Generates new access token
6. Generates new refresh token
7. Invalidates old refresh token
8. Stores new token hash
9. Sends updated cookies

---

## 6.4 Replay Attack Handling

If old refresh token is reused:

1. Token not found in DB
2. Or found in blacklist
3. Session revoked
4. All tokens invalidated

User must log in again.

---

## 6.5 Logout Flow

1. Client calls POST /logout
2. Auth Service deletes refresh session from DB
3. Adds refresh token to blacklist
4. Clears cookies
5. Session fully terminated

---

# 7. Database Schema (Refresh Sessions)

Table: refresh_sessions

Columns:

id
user_id
token_hash
expires_at
created_at
is_revoked

Rules:

- Store only hashed refresh tokens
- No plaintext storage
- On rotation → update record
- On logout → mark revoked

---

# 8. Cookie Security Policy

Access Token Cookie:

- httpOnly
- Secure
- SameSite=Strict
- Short expiration

Refresh Token Cookie:

- httpOnly
- Secure
- SameSite=Strict
- Path=/refresh
- Long expiration

Tokens are never stored in localStorage.

---

# 9. Role-Based Authorization

Roles:

- user
- admin

Permissions embedded inside JWT.

Authorization enforced:

- At backend service level
- Not trusted from frontend

Example:

Admin endpoints require:
role === "admin"

---

# 10. Key Management

Private Key:

- Stored only in AWS Auth Service
- Never committed to repository
- Loaded via environment variable

Public Key:

- Shared with backend services
- Used for verification only

Future:

- Support key rotation
- Maintain key versioning

---

# 11. Blacklist Strategy

Redis stores:

- Invalidated refresh tokens
- Expired access tokens (optional)

TTL:

- Matches token expiration

Prevents reuse of compromised tokens.

---

# 12. Security Controls

- RS256 asymmetric signing
- Token rotation
- Short-lived access tokens
- httpOnly cookies
- Strict SameSite policy
- Rate limiting on login
- Brute-force protection
- Input validation
- Webhook verification

---

# 13. Failure Handling

If Auth Service is unavailable:

- Login and refresh endpoints unavailable
- Existing access tokens remain valid until expiry

This prevents total system outage.

---

# 14. Security Level Assessment

This authentication model provides:

- Protection against replay attacks
- Short attack window for access tokens
- Session invalidation capability
- Isolation of signing authority
- Production-grade security suitable for payment systems

---
