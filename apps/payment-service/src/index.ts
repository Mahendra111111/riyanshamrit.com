/**
 * Payment Service — Razorpay Integration + HMAC Webhook Verification
 * Port: 3008
 *
 * Security:
 * - Idempotency via Redis (razorpay_payment_id as key)
 * - HMAC-SHA256 webhook signature verification (Razorpay format)
 * - Server-side amount validation against order record
 * - Internal token for inventory deduction/release
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import Redis from "ioredis";
import Razorpay from "razorpay";
import * as crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import {
  generateRequestId,
  createSuccessResponse,
  createErrorResponse,
  verifyInternalToken,
  signInternalToken,
  publishEvent,
  EVENT_STREAMS,
  logger,
} from "@ayurveda/shared-utils";

const app = express();
const PORT = Number(process.env["PORT"] ?? 3008);
const CORS_ORIGIN = process.env["CORS_ORIGIN"] ?? "http://localhost:3000";
const INVENTORY_SERVICE_URL =
  process.env["INVENTORY_SERVICE_URL"] ?? "http://localhost:3005";
const RAZORPAY_WEBHOOK_SECRET = process.env["RAZORPAY_WEBHOOK_SECRET"] ?? "";

const redis = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379");
const supabase = createClient(
  process.env["SUPABASE_URL"] ?? "",
  process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "",
);
const razorpay = new Razorpay({
  key_id: process.env["RAZORPAY_KEY_ID"] ?? "",
  key_secret: process.env["RAZORPAY_KEY_SECRET"] ?? "",
});

app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(cookieParser());

// Raw body for webhook verification BEFORE json middleware
app.use("/v1/webhooks/payment", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "10kb" }));

// ─── Internal Auth ─────────────────────────────────────────────────────────
function requireGateway(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers["x-internal-token"] as string | undefined;
  if (!token) {
    res
      .status(401)
      .json(createErrorResponse("UNAUTHORIZED", "Missing internal token"));
    return;
  }
  try {
    verifyInternalToken(token);
    next();
  } catch {
    res
      .status(401)
      .json(createErrorResponse("UNAUTHORIZED", "Invalid internal token"));
  }
}

app.use((req: Request, _res: Response, next: NextFunction) => {
  const requestId =
    (req.headers["x-request-id"] as string | undefined) ?? generateRequestId();
  const userId = req.headers["x-user-id"] as string | undefined;
  logger.info(`${req.method} ${req.path}`, undefined, { requestId, userId });
  next();
});

// ─── Helper: call inventory service ───────────────────────────────────────
async function callInventory(
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

// ─── POST /v1/payments/initiate — create Razorpay order ─────────────────
app.post(
  "/v1/payments/initiate",
  requireGateway,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const requestId =
      (req.headers["x-request-id"] as string | undefined) ??
      generateRequestId();
    try {
      const userId = req.headers["x-user-id"] as string | undefined;
      if (!userId) {
        res.status(401).json(createErrorResponse("UNAUTHORIZED", "No user ID"));
        return;
      }

      const { orderId } = req.body as { orderId: string };
      if (!orderId) {
        res
          .status(400)
          .json(createErrorResponse("VALIDATION_ERROR", "orderId required"));
        return;
      }

      // Validate order belongs to user and amount is authoritative
      const { data: order, error } = await supabase
        .from("orders")
        .select("id, total_amount, status")
        .eq("id", orderId)
        .eq("user_id", userId) // IDOR protection
        .single();

      if (error || !order) {
        res
          .status(404)
          .json(createErrorResponse("NOT_FOUND", "Order not found"));
        return;
      }
      if ((order["status"] as string) !== "pending") {
        res
          .status(409)
          .json(
            createErrorResponse(
              "INVALID_STATE",
              "Order is not in pending state",
            ),
          );
        return;
      }

      // Create Razorpay order — amount in paise (100x INR)
      const amountInPaise = Math.round((order["total_amount"] as number) * 100);
      const rzpOrder = await razorpay.orders.create({
        amount: amountInPaise,
        currency: "INR",
        receipt: orderId,
        notes: { userId, requestId },
      });

      // Store razorpay_order_id on the order record
      await supabase
        .from("orders")
        .update({ razorpay_order_id: rzpOrder.id })
        .eq("id", orderId);

      res.json(
        createSuccessResponse(
          {
            razorpayOrderId: rzpOrder.id,
            amount: amountInPaise,
            currency: "INR",
          },
          "Payment order created",
        ),
      );
    } catch (err) {
      next(err);
      logger.error("Razorpay init failed", err, { requestId });
    }
  },
);

// ─── POST /v1/webhooks/payment — Razorpay webhook (HMAC verified) ─────────
app.post(
  "/v1/webhooks/payment",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const requestId = generateRequestId();
    try {
      const rawBody = req.body as Buffer;
      const signature = req.headers["x-razorpay-signature"] as
        | string
        | undefined;
      if (!signature) {
        res.status(400).json({ error: "Missing signature" });
        return;
      }

      // HMAC-SHA256 verification
      const expectedSig = crypto
        .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
        .update(rawBody)
        .digest("hex");

      const sigBuffer = Buffer.from(signature, "hex");
      const expectedBuffer = Buffer.from(expectedSig, "hex");
      if (
        sigBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
      ) {
        logger.error("Webhook signature mismatch", undefined, { requestId });
        res.status(400).json({ error: "Invalid signature" });
        return;
      }

      // Parse payload after verification
      const payload = JSON.parse(rawBody.toString("utf-8")) as {
        event: string;
        payload: {
          payment: { entity: { id: string; order_id: string; amount: number } };
        };
      };

      const payment = payload.payload.payment.entity;
      const idempotencyKey = `payment:webhook:${payment.id}`;

      // Idempotency guard — process each payment event only once
      const alreadyProcessed = await redis.set(
        idempotencyKey,
        "1",
        "EX",
        86400,
        "NX",
      );
      if (!alreadyProcessed) {
        res.status(200).json({ status: "already_processed" });
        return;
      }

      if (payload.event === "payment.captured") {
        // Update order status
        const { data: order } = await supabase
          .from("orders")
          .select("id, order_items(product_id, quantity)")
          .eq("razorpay_order_id", payment.order_id)
          .single();

        if (order) {
          await supabase
            .from("orders")
            .update({ status: "confirmed", razorpay_payment_id: payment.id })
            .eq("id", order["id"] as string);

          // Insert payment record
          await supabase.from("payments").insert({
            order_id: order["id"] as string,
            razorpay_payment_id: payment.id,
            amount: payment.amount / 100,
            currency: "INR",
            status: "captured",
          });

          // Deduct inventory from reservation
          const items = (
            order["order_items"] as Array<{
              product_id: string;
              quantity: number;
            }>
          ).map((i) => ({
            productId: i.product_id,
            quantity: i.quantity,
          }));
          await callInventory("/v1/inventory/deduct", { items }, requestId);

          // Emit event for notification-service
          await publishEvent(redis, EVENT_STREAMS.PAYMENT, {
            type: "PAYMENT_CAPTURED",
            orderId: order["id"] as string,
            paymentId: payment.id,
            requestId,
          });
        }
      } else if (payload.event === "payment.failed") {
        const { data: order } = await supabase
          .from("orders")
          .select("id, order_items(product_id, quantity)")
          .eq("razorpay_order_id", payment.order_id)
          .single();

        if (order) {
          await supabase
            .from("orders")
            .update({ status: "failed" })
            .eq("id", order["id"] as string);

          // Release inventory reservation
          const items = (
            order["order_items"] as Array<{
              product_id: string;
              quantity: number;
            }>
          ).map((i) => ({
            productId: i.product_id,
            quantity: i.quantity,
          }));
          await callInventory("/v1/inventory/release", { items }, requestId);

          await publishEvent(redis, EVENT_STREAMS.PAYMENT, {
            type: "PAYMENT_FAILED",
            orderId: order["id"] as string,
            requestId,
          });
        }
      }

      res.status(200).json({ status: "processed" });
    } catch (err) {
      next(err);
      logger.error("Webhook processing failed", err, { requestId });
    }
  },
);

// ─── Health Check ──────────────────────────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "payment-service",
    timestamp: new Date().toISOString(),
  });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error("Unhandled error", err);
  res
    .status(500)
    .json(
      createErrorResponse("INTERNAL_ERROR", "An unexpected error occurred"),
    );
});

app.listen(PORT, () => {
  logger.info(`Payment Service running on port ${PORT}`);
});

export default app;
