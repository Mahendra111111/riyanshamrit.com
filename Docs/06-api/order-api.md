# Order API

Base: /v1/orders

Requires authentication.

---

## 1. Create Order

POST /v1/orders

Body:
{
"shipping_address": "...",
"payment_method": "razorpay"
}

Action:

- Validates cart
- Creates order (pending)
- Reserves inventory

---

## 2. Get User Orders

GET /v1/orders

Returns list of user's orders.

---

## 3. Get Order By ID

GET /v1/orders/{id}

Must belong to requesting user.

---

## 4. Admin: Get All Orders

GET /v1/admin/orders

Requires:

- role: admin
