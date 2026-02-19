# Monorepo Structure

## 1. Monorepo Philosophy

The project uses a monorepo architecture to:

- Maintain a single source of truth
- Share types and utilities safely
- Enforce consistent linting and configuration
- Simplify CI/CD
- Avoid dependency drift between services

The monorepo follows a domain-driven microservices model.

---

# 2. Root Folder Structure

repo/
│
├── apps/
│   ├── web/                  → Next.js frontend
│   ├── api/                  → Vercel backend APIs
│   ├── auth-service/         → AWS EC2 Auth microservice
│
├── packages/
│   ├── shared-types/
│   ├── shared-utils/
│   ├── validation-schemas/
│   ├── config/
│   └── eslint-config/
│
├── docs/
├── .github/
├── package.json
├── turbo.json (or nx.json)
└── README.md

---

# 3. Apps Directory

The `apps` folder contains all deployable services.

Each app:
- Has its own package.json
- Can be deployed independently
- Has isolated environment variables

---

# 4. Packages Directory

The `packages` folder contains shared logic that:

- Is not deployable independently
- Must remain framework-agnostic
- Contains no environment-specific logic

---

# 5. Build System

Recommended tools:

- Turborepo or Nx
- TypeScript project references
- Shared ESLint configuration

CI ensures:
- Independent build validation
- No circular dependencies
- Type safety across services

---

# 6. Architectural Rules

- Apps may import from packages.
- Packages may NOT import from apps.
- No direct cross-service imports.
- Communication between services occurs via API only.

This preserves microservice boundaries.
