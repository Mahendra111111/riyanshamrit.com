# Backend Structure

The backend consists of:

- Vercel Serverless APIs
- AWS EC2 Auth Service

Each service follows clean architecture principles.

---

# 1. Vercel Backend (apps/api)

apps/api/
│
├── src/
│ ├── controllers/
│ ├── services/
│ ├── repositories/
│ ├── middleware/
│ ├── routes/
│ ├── validators/
│ └── utils/
│
├── package.json
└── tsconfig.json

---

## 1.1 Clean Architecture Pattern

Controller → Service → Repository

Controllers:

- Handle request/response
- No business logic

Services:

- Business logic
- Domain rules

Repositories:

- Database interaction
- Supabase queries

---

# 2. Auth Service (apps/auth-service)

apps/auth-service/
│
├── src/
│ ├── controllers/
│ ├── services/
│ ├── repositories/
│ ├── crypto/
│ ├── routes/
│ └── utils/
│
├── Dockerfile
├── nginx.conf
└── package.json

---

## 2.1 Responsibilities

- Login
- Refresh token rotation
- Logout
- JWT signing (RS256)
- Public key endpoint

Private key exists only here.

---

# 3. Security Enforcement

Each backend service must:

- Verify access token
- Validate input
- Enforce role permissions
- Log request ID
