# Project Overview

## 1. What Is This Project?

This project is a **full-scale, production-ready Ayurveda e-commerce platform**
designed to sell health and wellness products directly to customers (D2C model).

The platform supports:
- Public browsing of products
- Secure user authentication
- Cart and checkout
- Online payments
- Order management
- User profile and address management
- Admin operations (products, orders, content)

The system is built with **scalability, security, performance, and long-term maintainability** as first-class concerns.

This is not a demo or template project — it is intended for real users, real payments, and real business operations.

---

## 2. Who Is This Product For?

### Primary Users
- Customers browsing and purchasing Ayurveda products
- Logged-in users managing orders, addresses, and profiles

### Secondary Users
- Admins managing products, inventory, orders, and content
- Developers maintaining and extending the platform
- AI tools assisting with development under strict rules

---

## 3. Core Product Goals

The platform is built to achieve the following goals:

1. **Security First**
   - No trust in frontend for critical logic
   - Server-side validation for all payments and orders
   - Strong authentication and authorization

2. **Performance & SEO**
   - Fast page loads
   - SEO-friendly product and category pages
   - Optimized images and caching

3. **Scalability**
   - Designed to grow from a monolith to microservices
   - Clear separation of responsibilities
   - Event-ready architecture

4. **Maintainability**
   - Clean code standards
   - Strong documentation
   - Predictable folder and module structure

5. **AI-Friendly Development**
   - Explicit rules for what AI can and cannot change
   - Detailed documentation to reduce ambiguity
   - Safe use of AI without breaking architecture or security

---

## 4. High-Level System Overview

At a high level, the system consists of:

- **Frontend**
  - Built using Next.js (React)
  - Supports static generation, server-side rendering, and client components
  - Uses ShadCN UI for consistent and accessible UI components

- **Backend**
  - Node.js with Express.js (modular architecture)
  - Acts as the single source of truth for business logic
  - Communicates with Supabase using secure service roles

- **Database**
  - Supabase (PostgreSQL)
  - Strong relational data model
  - Transaction-based operations for orders and payments

- **Infrastructure**
  - Dockerized services
  - CI/CD via GitHub Actions
  - Monitoring and uptime checks via Zoho
  - PR reviews via CodeRabbit

---

## 5. Core User Flows (High-Level)

### Browsing Flow
1. User lands on Home page
2. User browses categories and products
3. User views product details

### Purchase Flow
1. User adds products to cart
2. User proceeds to checkout
3. Address and payment are selected
4. Backend validates cart and creates order
5. Payment gateway confirms payment via webhook
6. Order status is updated and confirmed

### Account Flow
1. User signs up or logs in
2. Email verification is completed
3. User manages profile, addresses, and orders

---

## 6. Architectural Philosophy

This project follows these architectural principles:

- **Explicit is better than implicit**
- **Backend owns business logic**
- **Frontend focuses on user experience**
- **Each module has a single responsibility**
- **Security and correctness over speed of development**

Microservices are **designed upfront** but may be deployed initially as a modular monolith to reduce operational complexity.

---

## 7. What This Document Is NOT

This document does NOT:
- Define detailed API contracts
- Describe database schemas
- Specify UI design details
- Explain page-level behavior

Those details are covered in their respective documents inside the `docs/` folder.

---

## 8. How To Use This Documentation

- This file should be read **before** any other document
- All future documentation assumes the context defined here
- Any major change to product direction must update this file
- AI tools must treat this document as **root context**

---

## 9. Non-Negotiable Rules

- No direct database access from frontend
- No business logic in UI components
- No price or payment logic on client side
- No undocumented architectural changes

Violating these rules is considered a critical defect.

---

## 10. Living Document

This is a **living document**.
As the product evolves:
- Goals may expand
- Architecture may adapt
- Features may grow

However, changes must be **intentional, documented, and reviewed**.