import type { DomainEvent } from "@ayurveda/shared-utils";
import * as emailService from "../services/email.service.js";

const supabaseUrl = process.env["SUPABASE_URL"] ?? "";
const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";

async function getUserEmail(userId: string): Promise<string | null> {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/users?id=eq.${userId}&select=email`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    },
  );
  if (!response.ok) return null;
  const data = (await response.json()) as Array<{ email: string }>;
  return data[0]?.email ?? null;
}

async function getUserIdFromOrder(orderId: string): Promise<string | null> {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/orders?id=eq.${orderId}&select=user_id`,
    {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    },
  );
  if (!response.ok) return null;
  const orders = (await response.json()) as Array<{ user_id: string }>;
  return orders[0]?.user_id ?? null;
}

export async function handleEvent(event: DomainEvent): Promise<void> {
  if (event.type === "ORDER_CREATED") {
    const email = await getUserEmail(event.userId);
    if (!email) return;
    await emailService.sendOrderCreatedEmail(
      email,
      event.orderId,
      event.totalAmount,
    );
  } else if (event.type === "PAYMENT_CAPTURED") {
    const userId = await getUserIdFromOrder(event.orderId);
    if (!userId) return;
    const email = await getUserEmail(userId);
    if (!email) return;
    await emailService.sendPaymentCapturedEmail(email, event.orderId);
  } else if (event.type === "PAYMENT_FAILED") {
    const userId = await getUserIdFromOrder(event.orderId);
    if (!userId) return;
    const email = await getUserEmail(userId);
    if (!email) return;
    await emailService.sendPaymentFailedEmail(email, event.orderId);
  }
}
