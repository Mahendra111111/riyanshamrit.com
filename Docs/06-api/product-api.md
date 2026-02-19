# Product API

Base: /v1/products

---

## 1. Get All Products

GET /v1/products

Query Params:

- category
- min_price
- max_price
- page
- limit

Public endpoint.

---

## 2. Get Product By Slug

GET /v1/products/{slug}

Public endpoint.

---

## 3. Create Product (Admin)

POST /v1/products

Requires:

- role: admin

---

## 4. Update Product (Admin)

PUT /v1/products/{id}

Requires:

- role: admin

---

## 5. Delete Product (Admin)

DELETE /v1/products/{id}

Requires:

- role: admin
