# Webhook API

Base: /v1/webhooks

Webhooks are public but must verify signature.

---

## 1. Payment Webhook

POST /v1/webhooks/payment

Headers:

- provider-signature

Flow:

1. Verify signature
2. Validate payment
3. Update payment status
4. Update order status
5. Deduct inventory

Webhook must:

- Return 200 quickly
- Avoid long processing
- Use idempotency checks

---

## 2. Idempotency Rule

If webhook called multiple times:

- Do not duplicate order update
- Check payment status before updating
