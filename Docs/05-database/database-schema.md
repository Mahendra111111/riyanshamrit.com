# Database Schema

## 1. Database Philosophy

The system uses PostgreSQL (Supabase) as the primary data store.

Design principles:

- Relational integrity enforced
- Foreign keys required
- ACID transactions for financial operations
- Proper indexing for performance
- No denormalized chaos
- Clear ownership per domain

All database access occurs only through backend services.

Frontend never accesses the database directly.

---

# 2. Core Domain Tables

The database is divided into logical domains:

1. Users
2. Authentication
3. Products
4. Inventory
5. Cart
6. Orders
7. Payments
8. Reviews
9. Admin

---

# 3. Users Domain

## 3.1 users

Stores basic user data.

Columns:

id (uuid, primary key)
email (unique, indexed)
password_hash
role (user | admin)
is_verified (boolean)
created_at
updated_at

Indexes:

- unique(email)
- index(role)

---

# 4. Authentication Domain

## 4.1 refresh_sessions

Stores rotating refresh tokens.

Columns:

id (uuid, primary key)
user_id (foreign key → users.id)
token_hash
expires_at
is_revoked (boolean)
created_at

Indexes:

- index(user_id)
- index(expires_at)

Only hashed refresh tokens stored.

---

# 5. Product Domain

## 5.1 categories

id (uuid, primary key)
name
slug (unique)
created_at

---

## 5.2 products

id (uuid, primary key)
category_id (foreign key → categories.id)
name
slug (unique)
description
price (numeric)
discount_price (nullable)
is_active (boolean)
created_at
updated_at

Indexes:

- index(category_id)
- index(is_active)
- index(price)

---

## 5.3 product_images

id (uuid, primary key)
product_id (foreign key → products.id)
image_url
is_primary (boolean)
created_at

---

# 6. Inventory Domain

## 6.1 inventory

id (uuid, primary key)
product_id (foreign key → products.id)
stock_quantity (integer)
reserved_quantity (integer)
updated_at

Rules:

- stock_quantity ≥ 0
- reserved_quantity ≥ 0

Available stock = stock_quantity - reserved_quantity

---

# 7. Cart Domain

## 7.1 cart_items

id (uuid, primary key)
user_id (foreign key → users.id)
product_id (foreign key → products.id)
quantity (integer)
created_at
updated_at

Unique constraint:

- (user_id, product_id)

Note:
Guest carts may be handled in Redis instead of DB.

---

# 8. Orders Domain

## 8.1 orders

id (uuid, primary key)
user_id (foreign key → users.id)
status (pending | paid | shipped | delivered | cancelled)
total_amount (numeric)
payment_status (pending | paid | failed)
created_at
updated_at

Indexes:

- index(user_id)
- index(status)

---

## 8.2 order_items

id (uuid, primary key)
order_id (foreign key → orders.id)
product_id (foreign key → products.id)
quantity
price_at_purchase (numeric)
created_at

Important:
Price stored at purchase time to prevent future price changes affecting history.

---

# 9. Payments Domain

## 9.1 payments

id (uuid, primary key)
order_id (foreign key → orders.id)
payment_provider (razorpay | stripe)
provider_payment_id
amount (numeric)
status (initiated | successful | failed | refunded)
created_at
updated_at

Indexes:

- index(order_id)
- index(provider_payment_id)

Payment verification must be server-side only.

---

# 10. Reviews Domain

## 10.1 reviews

id (uuid, primary key)
user_id (foreign key → users.id)
product_id (foreign key → products.id)
rating (1–5)
comment
created_at

Unique constraint:

- (user_id, product_id)

---

# 11. Admin Domain

Admin role stored in users table.

Admin actions must be logged separately.

## 11.1 admin_logs

id (uuid, primary key)
admin_id (foreign key → users.id)
action
target_type
target_id
created_at

Used for auditing.

---

# 12. Transactions & Integrity Rules

Order creation must be atomic:

BEGIN TRANSACTION

1. Create order
2. Create order_items
3. Reserve inventory
   COMMIT

Payment confirmation:

BEGIN TRANSACTION

1. Update payment status
2. Update order status
3. Deduct inventory
   COMMIT

No partial writes allowed.

---

# 13. Data Constraints

- All foreign keys enforced
- Cascading deletes controlled
- Soft deletes preferred for orders
- NOT NULL constraints where applicable
- Price fields use numeric (not float)

---

# 14. Indexing Strategy

Indexes required on:

- email
- product slug
- category_id
- user_id in orders
- payment provider ID
- created_at for analytics queries

Avoid over-indexing.

---

# 15. Security Rules

- No direct public database exposure
- Service role key stored in backend only
- Parameterized queries only
- Input validation before DB writes

---

# 16. Future Expansion

Planned additions:

- Coupons table
- Subscription products
- Wishlist table
- Shipment tracking
- Multi-warehouse inventory
- Device-based session management

Current schema supports extension without breaking changes.

---
