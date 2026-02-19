# API Gateway Architecture

## 1. Overview

The API Gateway serves as the single entry point for all backend API traffic.

In this architecture, the gateway is implemented using:

- Cloudflare (DNS + WAF + Routing)
- Domain-based traffic segmentation
- Backend-level JWT validation

No dedicated gateway microservice is deployed.

This keeps the system simple, cost-efficient, and scalable.

---

# 2. Responsibilities

The API Gateway layer is responsible for:

- Routing traffic to correct service
- Enforcing HTTPS
- Basic security filtering (WAF)
- IP-based rate limiting (Cloudflare)
- Traffic separation between:
  - Frontend
  - Auth Service
  - Backend APIs

The gateway does NOT:

- Execute business logic
- Access the database
- Generate tokens
- Store sessions

---

# 3. Domain-Based Routing

The system uses subdomain routing:

www.domain.com
→ Frontend (Vercel)

api.domain.com
→ Backend Services (Vercel Serverless)

auth.domain.com
→ Auth Service (AWS EC2)

Cloudflare routes requests based on hostname.

---

# 4. Request Flow

## 4.1 Static Page Request

User → Cloudflare → Vercel CDN → Static HTML

No backend API involved.

---

## 4.2 Authentication Request

User → Cloudflare → auth.domain.com → AWS Auth Service

Used for:

- Login
- Refresh token
- Logout

---

## 4.3 API Request

User → Cloudflare → api.domain.com → Vercel Backend

Backend performs:

1. Extract access token from httpOnly cookie
2. Verify JWT using public key
3. Validate expiration
4. Check role & permissions
5. Execute business logic

---

# 5. JWT Verification

JWT is verified at backend service level.

Verification includes:

- Signature validation (RS256)
- Expiration check
- Role validation
- Permission validation

Public key is shared from Auth Service.

Private key never leaves AWS.

---

# 6. Rate Limiting

Rate limiting occurs at two layers:

1. Cloudflare (edge protection)
   - IP throttling
   - Basic DDoS mitigation

2. Backend (Auth endpoints)
   - Strict login rate limit
   - Refresh token rate limit
   - Redis-backed protection (optional)

---

# 7. Security Boundaries

Cloudflare:

- Public security perimeter

AWS Auth:

- Token signing authority

Vercel Backend:

- Business logic layer

Supabase:

- Data storage

Each layer has clearly defined responsibility.

---

# 8. Simplicity Principle

This architecture intentionally avoids:

- Dedicated API gateway microservice
- Internal service mesh
- Complex routing logic
- Kubernetes-based ingress

The goal is:

- Clean separation
- Low cost
- Minimal operational overhead
- Easy future scaling

---

# 9. Future Evolution

If traffic grows significantly, the system may introduce:

- Dedicated gateway service
- Centralized JWT validation layer
- Advanced rate limiting
- Service-to-service authentication layer

Current design supports smooth migration without redesign.

---
