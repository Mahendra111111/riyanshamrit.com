---
trigger: always_on
---

=========================================================
CURSOR SECURITY & PERFORMANCE CONSTITUTION
FOR WEB & WEB APPLICATION DEVELOPMENT
=========================================================
STACK
Frontend: React.js, Next.js, Redux, shadcn/ui, Tailwind CSS
Backend: Node.js, Express.js
Database/Auth/Storage: Supabase
=========================================================
0️⃣ SECURITY MODE (MANDATORY)
=========================================================

SECURITY_MODE = MVP | PRODUCTION | HIGH_RISK

Cursor MUST adapt strictness, logging, MFA, CSRF, and enforcement
based on the selected SECURITY_MODE.

=========================================================
1️⃣ GLOBAL TRUST PRINCIPLES
=========================================================

Frontend is ALWAYS untrusted.

Backend is the security authority.

Supabase is source of truth for identity.

Supabase RLS is primary authorization layer.

Redux is UI state ONLY.

Prefer secure-by-default AND performance-aware solutions.

Follow OWASP Top 10.

FORBIDDEN:

Trusting frontend validation

Hardcoded secrets

Disabling RLS

Over-engineering in MVP

=========================================================
2️⃣ AUTHENTICATION (SUPABASE)
=========================================================

REQUIRED (ALL MODES):

Use Supabase Auth only.

Delegate password handling fully to Supabase.

Generic error messages.

Rate-limit login/signup/reset.

Use HttpOnly cookies.

JWT VERIFICATION:

MVP: Required for write/private APIs.

PRODUCTION: Required for all private APIs.

HIGH_RISK: Required everywhere.

MFA:

MVP: Optional.

PRODUCTION: Mandatory for admins.

HIGH_RISK: Mandatory for all users.

FORBIDDEN:

Custom password storage

Storing tokens in localStorage or Redux

Revealing account existence

=========================================================
3️⃣ AUTHORIZATION (RLS + BACKEND)
=========================================================

CORE RULE:
Authorization MUST be enforced via Supabase RLS first.

FAST PATH (RLS ONLY ALLOWED):

User accessing own data

Read-only

No cross-user impact

BACKEND CHECKS REQUIRED:

Admin routes

Multi-tenant systems

Cross-user data access

Financial or irreversible actions

FORBIDDEN:

Accepting userId from request body

Trusting frontend role checks

=========================================================
4️⃣ SESSION & TOKEN SECURITY
=========================================================

HttpOnly cookies required.

Secure + SameSite=Lax.

SameSite=Strict only in HIGH_RISK.

Short-lived access tokens.

Logout must revoke Supabase session.

PERFORMANCE:

Cache verified session per request.

Avoid repeated JWT decoding.

=========================================================
5️⃣ FRONTEND SECURITY (NEXT.JS)
=========================================================

Route protection via middleware or server components.

Client guards = UX only.

Sanitize user-generated HTML.

Use React auto-escaping.

CSP:

MVP: Basic CSP.

PRODUCTION+: Strict CSP.

FORBIDDEN:

dangerouslySetInnerHTML without sanitization

Client-only auth enforcement

=========================================================
6️⃣ REDUX RULES
=========================================================

Redux MAY store:

UI state

Theme

Filters

Pagination

Redux MUST clear on logout.

FORBIDDEN:

Tokens

Permissions

Secrets

=========================================================
7️⃣ INPUT VALIDATION & INJECTION PREVENTION
=========================================================

Validate body, params, query on backend.

Allowlist validation required.

Reject unknown fields.

Use parameterized Supabase queries.

PERFORMANCE:

Share schemas (Zod/Yup).

Avoid duplicate validation logic.

FORBIDDEN:

Dynamic SQL

Trusting frontend validation

=========================================================
8️⃣ XSS, CSRF & CORS
=========================================================

CSRF:

MVP: SameSite cookies.

PRODUCTION: CSRF tokens for write APIs.

HIGH_RISK: CSRF tokens everywhere.

CORS:

Explicit allowed origins only.

No wildcard with credentials.

Helmet required in PRODUCTION+.

=========================================================
9️⃣ FILE & STORAGE SECURITY
=========================================================

Validate MIME type & size.

Rename uploaded files.

Use private buckets.

Use signed URLs.

Enforce HTTPS.

PERFORMANCE:

Serve files directly from Supabase when safe.

FORBIDDEN:

Public write buckets

Trusting file extensions

Executing uploaded files

=========================================================
🔟 RATE LIMITING & ABUSE PREVENTION
=========================================================

Rate-limit auth endpoints.

Rate-limit sensitive APIs.

Combine IP + userId.

Do not rate-limit public read endpoints.

CAPTCHA allowed for suspicious behavior.

=========================================================
1️⃣1️⃣ BUSINESS LOGIC SECURITY (CRITICAL)
=========================================================

Business logic MUST be enforced server-side.

IDEMPOTENCY REQUIRED FOR:

Payments

Orders

Refunds

Subscriptions

Webhooks

Irreversible actions

Same idempotency key → same result.

ONE-TIME TOKENS:

Expire

Invalidate after use

Server-enforced limits

SERVER COUNTERS:

Enforce free tier limits

Enforce quotas

Atomic updates only

STATE MACHINES:

Strict allowed transitions

Reject invalid jumps

TIME-BASED PROTECTION:

Cool-down windows

Server-time only

ECONOMIC ACTIONS:

Transactional balance updates

No client-side math

Audit logs required

FORBIDDEN:

UI-only limits

Unlimited retries

Client counters

=========================================================
1️⃣2️⃣ LOGGING & MONITORING
=========================================================

Log:

Authentication events

Authorization failures

State violations

Idempotency reuse

Quota abuse

MODE-BASED:

MVP: Minimal

PRODUCTION: Structured

HIGH_RISK: Full audit

FORBIDDEN:

Logging secrets

Logging tokens

=========================================================
1️⃣3️⃣ DEVSECOPS & DEPENDENCIES
=========================================================

Version-pin dependencies.

Enable secret scanning.

Enable dependency scanning.

CI:

MVP: Warnings allowed.

PRODUCTION+: Known vulnerabilities fail build.

=========================================================
1️⃣4️⃣ AI BEHAVIOR RULES (CURSOR)
=========================================================

If a request is insecure:

Explain the security risk.

Provide the closest secure alternative.

Clearly mark remaining risks.

Cursor MUST:

Prefer RLS over duplicate backend checks when safe.

Avoid unnecessary middleware.

Optimize performance before adding complexity.

Apply security proportional to SECURITY_MODE.

Ask: “Can this be abused logically?”

Cursor MUST NOT:

Refuse unnecessarily.

Over-secure MVP builds.

Add redundant validation.

=========================================================
FINAL PRINCIPLE
=========================================================

Protect:

Identity

Ownership

Intent

Sequence

Limits

Economic value

Security must be:

Proportional

Deterministic

Performant

Maintainable

=========================================================
END OF FINAL RULES
=========================================================