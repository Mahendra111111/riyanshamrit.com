# 🌿 Riyanshamrit – Production-Grade Ayurveda E-Commerce Platform

A hybrid, microservices-based e-commerce platform built with modern full-stack architecture, secure authentication, and production-grade DevOps practices.

This project demonstrates:

- Hybrid Cloud Architecture (AWS + Vercel + Cloudflare)
- Monorepo-based Microservices
- RS256 JWT Authentication with Refresh Rotation
- Secure Payment Webhook Handling
- ACID-Safe Order Transactions
- Production-Grade Testing Architecture
- CI/CD with GitHub Actions
- Clean Code Governance
- Security-First Development

---

# 🚀 Architecture Overview

## 🔹 Deployment Model

Frontend:
- Next.js
- Hosted on Vercel
- Behind Cloudflare CDN

Backend APIs:
- Vercel Serverless Functions

Authentication Service:
- AWS EC2 (Dockerized)
- RS256 JWT signing authority

Database:
- Supabase (PostgreSQL)

Cache & Token Blacklist:
- Managed Redis

Edge Layer:
- Cloudflare (CDN + WAF + SSL)

---

# 🏗 System Architecture


User
↓
Cloudflare (CDN + WAF)
↓
Routing by subdomain
├── www.riyanshamrit.com
 → Vercel Frontend
├── api.riyanshamrit.com → Vercel Backend
└── auth.riyanshamrit.com → AWS Auth Service


Security is enforced at every layer.

---

# 🔐 Authentication Model

- RS256 Asymmetric JWT
- Access Token (10–15 min)
- Rotating Refresh Token (7 days)
- Token Blacklist (Redis)
- Replay Attack Protection
- httpOnly Secure Cookies
- Role-Based Authorization (user/admin)

Refresh tokens are rotated on every use and old tokens are invalidated.

---

# 📦 Monorepo Structure


apps/
web/ → Next.js frontend
api/ → Backend APIs
auth-service/ → AWS Auth microservice

packages/
shared-types/
shared-utils/
validation-schemas/
config/

docs/
architecture/
security/
api/
clean-code/
testing/


Rules:
- Apps may import from packages.
- Packages may NOT import from apps.
- Services communicate only via API.

---

# 🗄 Database Design

PostgreSQL schema includes:

- users
- refresh_sessions
- products
- categories
- inventory
- cart_items
- orders
- order_items
- payments
- reviews
- admin_logs

Financial operations use database transactions to prevent partial writes.

---

# 🔔 Webhook Security

- Payment confirmation handled server-side.
- Signature verification required.
- Idempotent processing.
- Inventory updated only after verified payment.
- Duplicate webhook calls handled safely.

---

# 🧪 Testing Architecture

Production-grade testing pyramid:

- Unit Tests
- Service Tests
- API Tests
- Integration Tests
- Webhook Security Tests
- Concurrency Tests
- End-to-End Tests (Playwright)

Coverage enforced via CI.

Deployment blocked if tests fail.

---

# 🔄 CI/CD Pipeline

GitHub Actions workflow:

On Pull Request:
- Install dependencies
- Lint
- Type check
- Run unit tests
- Run integration tests
- Enforce coverage

On Main Branch:
- Run full test suite
- Build Docker (Auth Service)
- Deploy Auth to AWS
- Deploy Frontend & API to Vercel

No deployment occurs if tests fail.

---

# 🛡 Security Principles

- Zero Trust Architecture
- Least Privilege Access
- No secrets exposed to frontend
- Strict input validation
- JWT signature verification
- Refresh token rotation
- Secure cookie policies
- Rate limiting on auth endpoints
- WAF at edge layer

---

# ⚙️ Local Development Setup

## 1️⃣ Clone Repository

git clone <repo-url>
cd repo

---

## 2️⃣ Install Dependencies

npm install

---

## 3️⃣ Configure Environment

Create:

.env.local
.env.test

Set:

- DATABASE_URL
- REDIS_URL
- JWT_PRIVATE_KEY
- JWT_PUBLIC_KEY
- PAYMENT_PROVIDER_SECRET
- SUPABASE_SERVICE_ROLE_KEY

Never commit `.env` files.

---

## 4️⃣ Start Development

Frontend:

cd apps/web
npm run dev

Backend:

cd apps/api
npm run dev


Auth Service (Docker):

cd apps/auth-service
docker build -t auth-service .
docker run -p 4000:4000 auth-service

---

# 🧪 Running Tests

Run all tests:
npm run test
Run with coverage:
npm run test:coverage
Run E2E:
npm run test:e2e

---

# 📊 Coverage Targets

Minimum thresholds:

- 80% lines
- 80% functions
- 70% branches

CI fails if below threshold.

---

# 🧱 Tech Stack

Frontend:
- Next.js
- React
- ShadCN
- Tailwind CSS
- TypeScript

Backend:
- Node.js
- Express
- Vercel Serverless

Auth:
- AWS EC2
- Docker
- NGINX

Database:
- Supabase (Postgres)

Cache:
- Redis

Testing:
- Jest
- Supertest
- React Testing Library
- Playwright

CI/CD:
- GitHub Actions

---

# 📈 Future Enhancements

- Multi-region AWS deployment
- Kafka event streaming
- Device-based session management
- Service mesh integration
- Advanced fraud detection
- Multi-warehouse inventory

---

# 📜 Clean Code Governance

All contributors must follow:

- docs/09-clean-code
- docs/11-security
- docs/03-architecture

Pull requests violating architecture will be rejected.

---

# 🧠 Project Goals

This project demonstrates:

- Secure distributed system design
- Hybrid cloud architecture
- Production-grade authentication
- Financial transaction safety
- DevOps automation
- Clean architecture discipline

---

# 📄 License

This project is proprietary.

---

# 👨‍💻 Author

Designed and engineered as a production-ready hybrid microservices e-commerce architecture.

---
