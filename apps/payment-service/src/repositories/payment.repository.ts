import { createClient } from "@supabase/supabase-js";
import Redis from "ioredis";
import Razorpay from "razorpay";
import {
  signInternalToken,
  publishEvent,
  EVENT_STREAMS,
  logger,
} from "@ayurveda/shared-utils";

const supabase = createClient(
  process.env["SUPABASE_URL"] ?? "",
  process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "",
);

const redis = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379");
const razorpay = new Razorpay({
  key_id: process.env["RAZORPAY_KEY_ID"] ?? "",
  key_secret: process.env["RAZORPAY_KEY_SECRET"] ?? "",
});

const INVENTORY_SERVICE_URL =
  process.env["INVENTORY_SERVICE_URL"] ?? "http://localhost:3040";

export async function getOrderForPayment(
  orderId: string,
  userId: string,
): Promise<any | null> {
  const { data, error } = await supabase
    .from("orders")
    .select("id, total_amount, status")
    .eq("id", orderId)
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;
  return data;
}

export async function createRazorpayOrder(
  amountInPaise: number,
  orderId: string,
  userId: string,
  requestId: string,
): Promise<any> {
  return razorpay.orders.create({
    amount: amountInPaise,
    currency: "INR",
    receipt: orderId,
    notes: { userId, requestId },
  });
}

export async function updateOrderRazorpayId(
  orderId: string,
  razorpayOrderId: string,
): Promise<void> {
  await supabase
    .from("orders")
    .update({ razorpay_order_id: razorpayOrderId })
    .eq("id", orderId);
}

export async function checkIdempotency(paymentId: string): Promise<boolean> {
  const key = `payment:webhook:${paymentId}`;
  const result = await redis.set(key, "1", "EX", 86400, "NX");
  return result === "OK";
}

export async function callInventory(
  path: string,
  body: unknown,
  requestId: string,
): Promise<void> {
  const internalToken = signInternalToken({
    service: "payment-service",
    requestId,
  });
  await fetch(`${INVENTORY_SERVICE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-token": internalToken,
      "x-request-id": requestId,
    },
    body: JSON.stringify(body),
  });
}

export async function processPaymentCaptured(
  payment: { id: string; order_id: string; amount: number },
  requestId: string,
): Promise<void> {
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_items(product_id, quantity)")
    .eq("razorpay_order_id", payment.order_id)
    .single();

  if (!order) return;

  // 1. Update order status
  await supabase
    .from("orders")
    .update({ status: "confirmed", razorpay_payment_id: payment.id })
    .eq("id", order.id);

  // 2. Insert payment record
  await supabase.from("payments").insert({
    order_id: order.id,
    razorpay_payment_id: payment.id,
    amount: payment.amount / 100,
    currency: "INR",
    status: "captured",
  });

  // 3. Deduct inventory
  const items = (order.order_items as any[]).map((i) => ({
    productId: i.product_id,
    quantity: i.quantity,
  }));
  await callInventory("/v1/inventory/deduct", { items }, requestId);

  // 4. Publish event
  await publishEvent(redis, EVENT_STREAMS.PAYMENT, {
    type: "PAYMENT_CAPTURED",
    orderId: order.id,
    paymentId: payment.id,
    requestId,
  });
}

export async function processPaymentFailed(
  payment: { order_id: string },
  requestId: string,
): Promise<void> {
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_items(product_id, quantity)")
    .eq("razorpay_order_id", payment.order_id)
    .single();

  if (!order) return;

  // 1. Update order status
  await supabase.from("orders").update({ status: "failed" }).eq("id", order.id);

  // 2. Release inventory
  const items = (order.order_items as any[]).map((i) => ({
    productId: i.product_id,
    quantity: i.quantity,
  }));
  await callInventory("/v1/inventory/release", { items }, requestId);

  // 3. Publish event
  await publishEvent(redis, EVENT_STREAMS.PAYMENT, {
    type: "PAYMENT_FAILED",
    orderId: order.id,
    requestId,
  });
}
