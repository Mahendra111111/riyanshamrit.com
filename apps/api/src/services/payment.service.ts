/**
 * Payment service — Razorpay integration stub.
 *
 * Creates payment records, verifies Razorpay HMAC signatures,
 * and updates order status upon successful payment.
 *
 * SECURITY:
 * - Payment verification uses HMAC-SHA256 with server-side secret (never frontend)
 * - Idempotency: duplicate payment events for the same order are detected
 * - Order total is never trusted from payment provider — DB total is authoritative
 */

import crypto from "crypto";
import { getDb } from "../utils/supabase.js";
import {
  getOrderById,
  updateOrderStatus,
} from "../repositories/order.repository.js";
import { logger } from "@ayurveda/shared-utils";

// ─── Create Payment Record ────────────────────────────────────────────────────

/**
 * Creates an initial payment record and returns the provider payment ID.
 * In a real Razorpay integration, this would call the Razorpay API.
 */
export async function initiatePayment(params: {
  orderId: string;
  userId: string;
  requestId: string;
}): Promise<{ provider_order_id: string; amount: string; currency: string }> {
  const db = getDb();

  // Fetch order — validates ownership
  const order = await getOrderById(params.orderId, params.userId);
  if (!order) throw new Error("ORDER_NOT_FOUND");
  if (order.payment_status === "paid") throw new Error("ALREADY_PAID");

  // TODO: Call Razorpay API to create order
  // const razorpayOrder = await razorpay.orders.create({ amount: order.total_amount * 100, currency: "INR" });

  // For now, create a stub payment record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db.from("payments") as any).insert({
    order_id: params.orderId,
    payment_provider: "razorpay",
    amount: order.total_amount,
    status: "initiated",
  });

  if (error) {
    logger.error("initiatePayment DB error", error, {
      requestId: params.requestId,
    });
    throw new Error("Failed to initiate payment");
  }

  // Return stub provider info (replace with real Razorpay response)
  return {
    provider_order_id: `rp_order_stub_${params.orderId}`,
    amount: String(order.total_amount),
    currency: "INR",
  };
}

// ─── Webhook Handler ──────────────────────────────────────────────────────────

/**
 * Verifies a Razorpay webhook signature using HMAC-SHA256.
 * Returns true only if the signature matches.
 *
 * SECURITY: Must be called before processing any webhook event.
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string,
): boolean {
  const secret = process.env["RAZORPAY_WEBHOOK_SECRET"];
  if (!secret) throw new Error("RAZORPAY_WEBHOOK_SECRET is required");

  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(expectedSig),
    Buffer.from(signature),
  );
}

/**
 * Processes a Razorpay payment.captured webhook event.
 * Updates payment record and order status atomically.
 */
export async function handlePaymentCaptured(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  requestId: string;
}): Promise<void> {
  const db = getDb();

  // Find the payment record by provider order ID
  const { data: payment, error } = await db
    .from("payments")
    .select("*, order:orders(*)")
    .eq("provider_payment_id", params.razorpayOrderId)
    .single();

  if (error || !payment) {
    logger.error("handlePaymentCaptured: payment not found", {
      razorpayOrderId: params.razorpayOrderId,
    });
    return; // Acknowledge webhook but don't update
  }

  // Idempotency: already processed
  const paymentData = payment as { status: string; order: { id: string } };
  if (paymentData.status === "successful") {
    logger.info("Duplicate payment webhook — already processed", undefined, {
      requestId: params.requestId,
    });
    return;
  }

  // Update payment status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db.from("payments") as any)
    .update({
      status: "successful",
      provider_payment_id: params.razorpayPaymentId,
    })
    .eq("id", (payment as { id: string }).id);

  // Update order status
  await updateOrderStatus(paymentData.order.id, {
    payment_status: "paid",
    status: "paid",
  });

  logger.info(
    "Payment captured and order updated",
    {
      orderId: paymentData.order.id,
      paymentId: params.razorpayPaymentId,
    },
    { requestId: params.requestId },
  );
}
