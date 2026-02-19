# Shared Packages

Shared packages provide reusable logic across services.

They must:

- Be framework-agnostic
- Contain no environment secrets
- Avoid direct database access
- Remain stateless

---

# 1. shared-types

packages/shared-types/

Contains:

- User types
- Product types
- Order interfaces
- JWT payload types
- API response types

Used by:

- Frontend
- Backend
- Auth service

Ensures type consistency across system.

---

# 2. shared-utils

packages/shared-utils/

Contains:

- Date utilities
- Error helpers
- Response formatters
- Logging helpers
- Common constants

No external service calls allowed.

---

# 3. validation-schemas

packages/validation-schemas/

Contains:

- Zod schemas
- Input validation logic
- Shared DTO definitions

Used by:

- Backend APIs
- Auth service

Ensures consistent validation.

---

# 4. config

packages/config/

Contains:

- Shared ESLint config
- TypeScript base config
- Environment variable schema

No runtime secrets stored here.

---

# 5. Architectural Rules

- Shared packages must not depend on apps.
- Shared packages must not access database.
- Shared packages must not contain side effects.
- Shared packages are pure logic only.

Violating these rules breaks microservice boundaries.
