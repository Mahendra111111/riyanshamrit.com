# Security Architecture

## 1. Security Philosophy

The system follows a defense-in-depth model.

Security is enforced at multiple layers:

- Edge layer (Cloudflare)
- Authentication layer (AWS Auth Service)
- Application layer (Vercel Backend)
- Data layer (Supabase + Redis)

The architecture follows:

- Zero Trust principle
- Least privilege access
- Short-lived authentication tokens
- Secure secret management
- No direct frontend-to-database access

---

# 2. Security Zones

Zone 1 – Public Edge

- Cloudflare CDN
- WAF
- SSL termination
- DDoS mitigation

Zone 2 – Authentication Plane

- AWS EC2 Auth Service
- JWT private key storage

Zone 3 – Application Layer

- Vercel Backend APIs
- Role-based authorization

Zone 4 – Data Layer

- Supabase (PostgreSQL)
- Managed Redis

Each zone has clearly defined access boundaries.

---

# 3. Edge Security (Cloudflare)

Cloudflare provides:

- HTTPS enforcement
- WAF filtering
- Bot protection
- IP throttling
- DDoS mitigation

Only HTTPS traffic is allowed.

All services are accessed through Cloudflare.

---

# 4. Authentication Security

## 4.1 JWT Strategy

- Algorithm: RS256 (Asymmetric)
- Private key stored only on AWS Auth Service
- Public key shared with backend services
- Access token lifetime: 10–15 minutes
- Refresh token lifetime: 7 days
- Refresh token rotation enforced

---

## 4.2 Token Rotation

On every refresh:

- Old refresh token invalidated
- New refresh token generated
- Old token blacklisted
- Replay attempts rejected

Prevents replay attacks.

---

## 4.3 Cookie Policy

Access Token:

- httpOnly
- Secure
- SameSite=Strict
- Short expiration

Refresh Token:

- httpOnly
- Secure
- SameSite=Strict
- Path restricted
- Longer expiration

Tokens are never stored in localStorage.

---

# 5. Authorization Model

Role-based + permission-based access.

Roles:

- user
- admin

Authorization enforced at backend layer.

Frontend role checks are non-authoritative.

Every protected endpoint verifies:

- JWT signature
- Expiration
- Role
- Required permission

---

# 6. API Security

- Input validation on all endpoints
- Zod or equivalent schema validation
- Strict content-type enforcement
- Rate limiting on login & refresh
- Maximum request body size limits
- Structured error responses (no stack traces exposed)

---

# 7. Data Security

## 7.1 Database Security (Supabase)

- Service role key stored only in backend environment
- No direct frontend database access
- ACID transactions for payments and orders
- Proper indexing and constraints
- No raw SQL exposure

---

## 7.2 Redis Security

Used for:

- Rate limiting
- Token blacklist
- Short-term caching

Redis instance is:

- Managed
- Not publicly exposed
- Accessed via secure connection

---

# 8. Secret Management

Secrets are stored as:

- AWS environment variables (Auth Service)
- Vercel environment variables (Backend APIs)

Secrets are never:

- Hardcoded
- Committed to Git
- Sent to frontend

Secrets include:

- JWT private key
- Database credentials
- Redis credentials
- Payment gateway secrets

---

# 9. Payment Security

- Payment verification done server-side
- Webhook signature validation required
- No client-side payment confirmation trusted
- Order creation only after verified payment
- No price calculation on frontend

---

# 10. Rate Limiting & Abuse Protection

Login endpoint:

- Strict IP-based rate limiting

Refresh endpoint:

- Limited attempts per token

API endpoints:

- Basic request throttling

Cloudflare:

- IP reputation filtering
- Bot mitigation

---

# 11. Logging & Monitoring

Each backend request logs:

- Request ID
- User ID (if authenticated)
- Timestamp
- IP (if required)
- Endpoint accessed

Sensitive data (passwords, tokens) never logged.

---

# 12. Threat Model

Protected Against:

- Token replay attacks
- JWT forgery
- Brute force login attempts
- DDoS
- Unauthorized admin access
- Frontend price manipulation
- Cross-site scripting (basic protection via framework)

Not Included (Future Enhancements):

- Full mTLS between services
- Hardware security modules
- Advanced fraud detection

---

# 13. Security Review Checklist

- All tokens short-lived
- Refresh rotation enabled
- No secret leakage to frontend
- Input validation present
- Webhook signatures verified
- Admin routes protected
- Rate limits configured

Security must be reviewed before production deployment.

---
