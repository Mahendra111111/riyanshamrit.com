# Cart API

Base: /v1/cart

Requires authentication.

---

## 1. Get Cart

GET /v1/cart

Returns current user cart.

---

## 2. Add Item

POST /v1/cart

Body:
{
"product_id": "uuid",
"quantity": 2
}

---

## 3. Update Quantity

PATCH /v1/cart/{item_id}

Body:
{
"quantity": 3
}

---

## 4. Remove Item

DELETE /v1/cart/{item_id}

---

Rules:

- Quantity must be > 0
- Product must be active
- Stock validated server-side
