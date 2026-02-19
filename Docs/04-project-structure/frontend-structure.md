# Frontend Structure (Next.js App)

## 1. Overview

The frontend is a Next.js application deployed on Vercel.

It handles:

- Static pages (SSG/ISR)
- Client-side interactivity
- API communication
- UI rendering

Business logic is NOT placed in frontend.

---

# 2. Folder Structure

apps/web/
│
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── products/
│   ├── cart/
│   ├── checkout/
│   ├── profile/
│   └── admin/
│
├── components/
│   ├── ui/                 → ShadCN base components
│   ├── common/             → Shared UI components
│   ├── layout/             → Navbar, Footer
│   └── features/           → Feature-based components
│
├── lib/
│   ├── api-client.ts
│   ├── auth.ts
│   └── constants.ts
│
├── hooks/
│
├── styles/
│
└── public/

---

# 3. Design Principles

- Server Components preferred
- Client Components only when necessary
- No direct database access
- No secret exposure
- All API calls go through api.domain.com

---

# 4. API Communication

Frontend communicates only with:

- auth.domain.com
- api.domain.com

Tokens handled via httpOnly cookies.

---

# 5. State Management

- React hooks
- Minimal context usage
- No Redux
- Cart state synced via backend
