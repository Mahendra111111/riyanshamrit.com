# Payment API

Base: /v1/payments

---

## 1. Create Payment Intent

POST /v1/payments/intent

Body:
{
"order_id": "uuid"
}

Returns:

- Payment provider payload

---

## 2. Verify Payment

POST /v1/payments/verify

Body:
{
"order_id": "uuid",
"provider_payment_id": "string"
}

Server-side verification required.

Frontend payment confirmation is not trusted.
