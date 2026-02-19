/**
 * Notification Service — Redis Streams Consumer
 * Port: 3009 (health/admin only; no external traffic)
 *
 * Listens to ORDER and PAYMENT event streams and sends emails via Resend.
 * Runs as a standalone process — no public HTTP endpoints (only /health).
 */

import express, {
  type Application,
  type Request,
  type Response,
} from "express";
import Redis from "ioredis";
import { Resend } from "resend";
import { EVENT_STREAMS, logger } from "@ayurveda/shared-utils";
import type { DomainEvent } from "@ayurveda/shared-utils";

const app: Application = express();
const PORT = Number(process.env["PORT"] ?? 3009);
const RESEND_FROM = process.env["RESEND_FROM"] ?? "noreply@ayurveda.store";

const redis = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379");
const resend = new Resend(process.env["RESEND_API_KEY"] ?? "");

// Health endpoint for Docker/Kubernetes probes
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "notification-service",
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  logger.info(`Notification Service HTTP running on port ${PORT}`);
});

// ─── Email Templates ───────────────────────────────────────────────────────
function orderCreatedEmail(orderId: string, totalAmount: string) {
  return {
    subject: "Your order has been placed! 🌿",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #16a34a;">Order Confirmed!</h2>
        <p>Your order <strong>#${orderId.slice(0, 8).toUpperCase()}</strong> has been placed successfully.</p>
        <p>Total: <strong>₹${totalAmount}</strong></p>
        <p>We'll notify you once your payment is confirmed and your order is dispatched.</p>
        <p>— Ayurveda Store Team 🌿</p>
      </div>
    `,
  };
}

function paymentCapturedEmail(orderId: string) {
  return {
    subject: "Payment confirmed — your order is being packed! ✅",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #16a34a;">Payment Received!</h2>
        <p>Payment for order <strong>#${orderId.slice(0, 8).toUpperCase()}</strong> has been confirmed.</p>
        <p>Your order is now being prepared for dispatch.</p>
        <p>— Ayurveda Store Team 🌿</p>
      </div>
    `,
  };
}

function paymentFailedEmail(orderId: string) {
  return {
    subject: "Payment failed for your order",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Payment Failed</h2>
        <p>Unfortunately, payment for order <strong>#${orderId.slice(0, 8).toUpperCase()}</strong> could not be processed.</p>
        <p>Please try again or contact support.</p>
        <p>— Ayurveda Store Team 🌿</p>
      </div>
    `,
  };
}

// ─── Redis Streams Consumer ────────────────────────────────────────────────
const CONSUMER_GROUP = "notification-service";
const CONSUMER_NAME = `notification-${process.pid}`;

async function ensureConsumerGroups(): Promise<void> {
  for (const stream of Object.values(EVENT_STREAMS)) {
    try {
      await redis.xgroup("CREATE", stream, CONSUMER_GROUP, "0", "MKSTREAM");
    } catch {
      // Group already exists — ignore BUSYGROUP error
    }
  }
}

async function getUserEmail(
  supabaseUrl: string,
  serviceKey: string,
  userId: string,
): Promise<string | null> {
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

async function processEvent(event: DomainEvent): Promise<void> {
  const supabaseUrl = process.env["SUPABASE_URL"] ?? "";
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";

  if (event.type === "ORDER_CREATED") {
    const email = await getUserEmail(supabaseUrl, serviceKey, event.userId);
    if (!email) return;
    const { subject, html } = orderCreatedEmail(
      event.orderId,
      event.totalAmount,
    );
    await resend.emails.send({ from: RESEND_FROM, to: email, subject, html });
  } else if (event.type === "PAYMENT_CAPTURED") {
    // Get order → user
    const response = await fetch(
      `${supabaseUrl}/rest/v1/orders?id=eq.${event.orderId}&select=user_id`,
      {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      },
    );
    const orders = (await response.json()) as Array<{ user_id: string }>;
    const userId = orders[0]?.user_id;
    if (!userId) return;
    const email = await getUserEmail(supabaseUrl, serviceKey, userId);
    if (!email) return;
    const { subject, html } = paymentCapturedEmail(event.orderId);
    await resend.emails.send({ from: RESEND_FROM, to: email, subject, html });
  } else if (event.type === "PAYMENT_FAILED") {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/orders?id=eq.${event.orderId}&select=user_id`,
      {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      },
    );
    const orders = (await response.json()) as Array<{ user_id: string }>;
    const userId = orders[0]?.user_id;
    if (!userId) return;
    const email = await getUserEmail(supabaseUrl, serviceKey, userId);
    if (!email) return;
    const { subject, html } = paymentFailedEmail(event.orderId);
    await resend.emails.send({ from: RESEND_FROM, to: email, subject, html });
  }
}

type RedisStreamEntry = [string, string[]];

async function consume(): Promise<void> {
  await ensureConsumerGroups();
  logger.info("Notification consumer started");

  while (true) {
    try {
      // Read from both streams with a 2-second block
      const streams = (await redis.xreadgroup(
        "GROUP",
        CONSUMER_GROUP,
        CONSUMER_NAME,
        "COUNT",
        10,
        "BLOCK",
        2000,
        "STREAMS",
        EVENT_STREAMS.ORDER,
        EVENT_STREAMS.PAYMENT,
        ">",
        ">",
      )) as Array<[string, RedisStreamEntry[]]> | null;

      if (!streams) continue;

      for (const [stream, entries] of streams) {
        for (const [id, fields] of entries) {
          // Convert flat field array to object
          const obj: Record<string, string> = {};
          for (let i = 0; i < fields.length; i += 2) {
            if (fields[i] !== undefined && fields[i + 1] !== undefined) {
              obj[fields[i] as string] = fields[i + 1] as string;
            }
          }

          try {
            await processEvent(obj as unknown as DomainEvent);
            // ACK after successful processing
            await redis.xack(stream, CONSUMER_GROUP, id);
          } catch (err) {
            logger.error("Failed to process event", err, {
              requestId: obj["requestId"] ?? "unknown",
            });
            // Leave unACKed so it can be reprocessed or claimed by another consumer
          }
        }
      }
    } catch (err) {
      logger.error("Consumer loop error", err);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

void consume();

export default app;
