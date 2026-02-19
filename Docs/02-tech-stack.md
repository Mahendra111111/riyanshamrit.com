
# Technology Stack

## 1. Philosophy Behind the Stack

The technology stack is designed with the following priorities:

- Security-first architecture
- Independent service scalability
- Edge-optimized performance
- Domain-driven microservices
- Clear separation of control plane and business plane
- Event-driven extensibility
- Production-grade observability
- Long-term maintainability

We prioritize architectural clarity over trend-based decisions.

---

# 2. Frontend Stack

## 2.1 Next.js (React Framework)

Purpose:
- Server-side rendering (SSR)
- Static Site Generation (SSG)
- Incremental Static Regeneration (ISR)
- SEO optimization
- Edge-ready deployments

Usage Strategy:
- Static pages → SSG + CDN
- Product pages → ISR
- Authenticated pages → Client-side data fetching
- API calls → Routed through API Gateway

Deployment:
- Hosted on Vercel

Important:
Static pages never hit backend microservices directly.

---

## 2.2 React

Used as UI foundation inside Next.js.

Rules:
- Components are presentational
- No business logic inside UI
- Server Components preferred when possible
- Client Components only when required

---

## 2.3 ShadCN UI + Tailwind CSS

Purpose:
- Consistent design system
- Accessible components
- Fully customizable UI
- Utility-first styling

Rules:
- Base components in `/components/ui`
- Business components extend base components
- No inline CSS hacks

---

## 2.4 TypeScript

Strict mode enabled.

Purpose:
- Type safety
- Refactoring safety
- API contract enforcement
- Improved AI-assisted development

---

## 2.5 State Management

No Redux.

State strategy:
- Server Components for data-heavy pages
- Minimal client state
- Local state via React hooks
- Context only where necessary (e.g., auth state)
- Cart state backed by Redis via API

We avoid global client-side overengineering.

---

# 3. Backend Stack

The backend follows a microservices architecture.

---

## 3.1 Node.js

Purpose:
- High ecosystem support
- TypeScript compatibility
- Unified language across stack

---

## 3.2 Express.js

Purpose:
- Lightweight HTTP server
- Modular routing
- Middleware control

Architecture Pattern:
Controllers → Services → Repositories

No direct database access from controllers.

---

## 3.3 API Gateway (Control Plane)

Responsibilities:
- JWT validation (RS256)
- Role extraction (User/Admin)
- Rate limiting
- Request routing
- Internal service token generation
- Request tracing

The gateway does NOT execute business logic.

---

## 3.4 Microservices Architecture

Domain-driven services:

Core Commerce:
- Auth Service
- User Service
- Product Service
- Inventory Service
- Cart Service
- Order Service
- Payment Service
- Admin Service

Support & Growth:
- Notification Service
- Search Service
- Analytics Service
- CMS Service
- Media Service

Each service:
- Is independently deployable
- Owns its domain logic
- Verifies internal tokens
- Has health & metrics endpoints

---

# 4. Authentication & Authorization

## 4.1 JWT Strategy

Algorithm:
RS256 (Asymmetric)

External JWT:
- Signed by Auth Service (private key)
- Verified by Gateway (public key)

Internal Service Token:
- Short-lived (30–60 sec)
- Signed by Gateway (separate private key)
- Verified by services (public key)

No shared symmetric secret across services.

---

## 4.2 Role-Based & Permission-Based Access

JWT Payload Includes:
- user_id
- role (user/admin)
- permissions array
- expiration

Authorization enforced at service level.

Frontend role checks are non-authoritative.

---

# 5. Database Layer

## 5.1 Supabase (PostgreSQL)

Used for:
- Users
- Products
- Orders
- Payments
- Inventory
- Reviews

Rules:
- ACID transactions for orders
- Proper indexing
- Foreign key constraints
- No direct frontend access
- Service role keys never exposed

---

## 5.2 Redis

Used for:
- Rate limiting
- Cart storage
- Token blacklisting
- API caching
- Event streaming (Redis Streams)

Not used for:
- Static page rendering

---

# 6. Event-Driven Communication

Used for asynchronous flows.

Examples:
- ORDER_CREATED
- PAYMENT_COMPLETED
- STOCK_UPDATED
- EMAIL_TRIGGERED

Implementation:
- Redis Streams (Phase 1)
- Kafka (future scaling)

Avoid synchronous service chaining.

---

# 7. Reverse Proxy & Load Balancing

## 7.1 Cloudflare

Responsibilities:
- CDN
- WAF
- DDoS protection
- Global load balancing
- SSL termination

---

## 7.2 NGINX

Used as:
- Reverse proxy
- Internal service load balancer
- Retry handler
- Header forwarding
- Request ID propagation

NGINX does not handle authentication logic.

---

# 8. DevOps & Deployment

## 8.1 Docker

Each microservice:
- Independent Dockerfile
- Multi-stage builds
- Environment-based config

---

## 8.2 Monorepo Structure

Managed using:
- Turborepo or Nx

Structure:

repo/
  apps/
    web/
    auth-service/
    product-service/
    order-service/
    ...
  packages/
    shared-types/
    shared-utils/
    config/

---

## 8.3 CI/CD (GitHub Actions)

Pipeline Includes:
- Linting
- Type checking
- Unit tests
- Docker image build
- Deployment
- PR validation

No direct commits to main branch.

---

# 9. Observability & Monitoring

Each service must provide:
- Structured logging
- Request ID tracing
- /health endpoint
- /metrics endpoint

Monitoring:
- Zoho for uptime
- Log aggregation
- Error alerting
- Performance thresholds

---

# 10. Security Technologies

- RS256 JWT
- httpOnly secure cookies
- Rate limiting middleware
- Input validation (Zod)
- Webhook signature verification
- Environment-based secrets
- Zero trust between services

Security enforced at:
- Edge
- Gateway
- Service layer
- Database layer

---

# 11. What We Avoid

- Symmetric JWT shared across services
- Direct frontend database writes
- Business logic inside gateway
- Overuse of client-side state
- Premature service mesh
- Unbounded microservices

---

# 12. Future Evolution

Phase 1:
- Core commerce services
- Gateway + Auth
- Redis event bus

Phase 2:
- Dedicated search engine
- Analytics expansion
- Horizontal scaling

Phase 3:
- Kafka
- Service mesh
- Multi-region database replicas

---
