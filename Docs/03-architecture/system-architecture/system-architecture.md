# System Architecture

## 1. Architecture Philosophy

The system follows a layered, domain-driven microservices architecture with a separated control plane.

Core principles:

- Security first (Zero trust between services)
- Domain-based service boundaries
- Edge-optimized content delivery
- Asymmetric JWT authentication (RS256)
- Event-driven communication for async operations
- Independent scalability of services
- Clear separation of responsibilities

---

## 2. High-Level Request Flow

User Request Flow:

User (Web / Mobile)
    ↓
Cloudflare CDN + WAF
    ↓
Cloudflare Load Balancer
    ↓
NGINX (Reverse Proxy)
    ↓
API Gateway (Control Plane)
    ↓
Target Microservice
    ↓
Database / Redis / Object Storage
    ↓
Response back to user

---

## 3. Layered Architecture Overview

The system is divided into 5 primary layers:

1. Edge Layer
2. Control Plane
3. Core Commerce Layer
4. Support & Growth Layer
5. Infrastructure Layer

---

# 4. Edge Layer

Components:
- Cloudflare CDN
- Web Application Firewall (WAF)
- Cloudflare Load Balancer

Responsibilities:
- Serve static content (via Vercel CDN)
- Block malicious traffic
- DDoS protection
- SSL termination
- Geographic routing
- Cache static assets

Important:
Static pages are handled by Next.js SSG/ISR and cached at the edge.
Backend services are not involved in static rendering.

---

# 5. Control Plane

## 5.1 API Gateway

Acts as:

- Traffic controller
- Authentication validator
- Authorization entry point
- Rate limiter
- Service router
- Internal token issuer

Responsibilities:

- Validate external JWT (RS256)
- Extract user role & permissions
- Apply rate limits (Redis-backed)
- Forward request to correct microservice
- Issue short-lived internal service token
- Attach request ID for tracing

The gateway must NOT:
- Execute business logic
- Access the database directly

---

## 5.2 Auth Service

Responsibilities:

- User login
- Admin login
- Password hashing
- Email verification
- JWT generation (RS256)
- Refresh token management
- Key rotation policy

External tokens:
Signed using private key.

Other services:
Verify using public key.

---

# 6. Core Commerce Layer

Domain-driven services.

Each service owns:
- Its own logic
- Its own validation
- Its own data access layer

## 6.1 User Service
Handles:
- Profile management
- Address management
- User preferences

## 6.2 Product Service
Handles:
- Product listing
- Product detail
- Categories
- Filtering

## 6.3 Inventory Service
Handles:
- Stock updates
- Reservation during checkout
- Stock validation

## 6.4 Cart Service
Handles:
- Guest cart
- User cart
- Redis-backed fast access

## 6.5 Order Service
Handles:
- Order creation
- Order state transitions
- Order history

## 6.6 Payment Service
Handles:
- Payment intent creation
- Payment verification
- Webhook validation
- Refund processing

## 6.7 Admin Service
Handles:
- Product management
- Order management
- Analytics dashboard APIs

---

# 7. Support & Growth Layer

These services support business growth and scalability.

## 7.1 Notification Service
Handles:
- Email
- SMS
- Push notifications
- Triggered by events

## 7.2 Search Service
Handles:
- Full-text search
- Product indexing

## 7.3 Analytics Service
Handles:
- Business metrics
- Event tracking
- Admin dashboards

## 7.4 CMS / Content Service
Handles:
- Static content management
- Marketing pages

## 7.5 Media Service
Handles:
- Image uploads
- File storage
- Object storage interaction (S3-like)

---

# 8. Infrastructure Layer

## 8.1 Database (Supabase PostgreSQL)

Used for:
- Users
- Products
- Orders
- Payments
- Inventory
- Reviews

Strict constraints:
- Transactions for order + payment
- Foreign keys enforced
- Indexing for performance

---

## 8.2 Redis

Used for:
- Rate limiting
- Caching API responses
- Cart storage
- Token blacklisting
- Event streaming

NOT used for:
- Static HTML pages

---

## 8.3 Event Bus (Redis Streams / Kafka future)

Used for asynchronous communication.

Examples:

Order Service → emits ORDER_CREATED
Payment Service → listens
Inventory Service → listens
Notification Service → listens

Avoid synchronous chaining of services.

---

## 8.4 Object Storage (S3 Compatible)

Used for:
- Product images
- Media uploads
- Static file storage

---

## 8.5 Observability & Monitoring

Each service must provide:

- Structured logging
- /health endpoint
- /metrics endpoint
- Request ID tracing
- Error reporting

Monitoring stack:
- Zoho monitoring
- Log aggregation
- Alert thresholds

---

# 9. Internal Service Communication

Communication model:

- HTTP REST between services
- Internal JWT token for verification
- Short-lived (30–60 seconds)
- Signed with separate internal private key

Future:
- mTLS between services

No service trusts another without token validation.

---

# 10. Security Model

- Asymmetric JWT (RS256)
- Role-based + permission-based authorization
- Rate limiting at gateway
- WAF at edge
- No direct database exposure
- No frontend database access
- Webhook signature verification
- Input validation at service level

---

# 11. Scalability Model

Services are independently scalable.

Scaling strategies:

- Horizontal scaling via container replicas
- NGINX load balancing
- Redis cluster for high load
- Read replicas for database (future)

Static content:
Scaled automatically via CDN.

---

# 12. Deployment Model

Frontend:
- Hosted on Vercel

Backend:
- Container-based microservices
- Reverse proxied by NGINX
- Cloudflare in front

Database:
- Managed Supabase instance

---

# 13. Failure Isolation

If one service fails:

- Gateway returns controlled error
- Other services continue operating
- Circuit breaker logic recommended (future)

No cascading failure allowed.

---

# 14. Evolution Plan

Phase 1:
- Core commerce services
- Auth
- Gateway

Phase 2:
- Notification
- Analytics
- CMS

Phase 3:
- Advanced search
- Event-driven scaling
- Service mesh

---


