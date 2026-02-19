/**
 * Payments Controller — handles payment initiation and Razorpay webhooks.
 *
 * CRITICAL SECURITY:
 * - Webhook handler verifies HMAC-SHA256 signature BEFORE processing any event
 * - Raw request body is passed to signature verifier (NOT parsed JSON)
 * - Payment total comes from DB order record — never from the webhook payload
 */

import type { Request, Response, NextFunction } from "express";
import { CreatePaymentIntentSchema } from "@ayurveda/validation-schemas";
import {
  createSuccessResponse,
  createErrorResponse,
  generateRequestId,
} from "@ayurveda/shared-utils";
import {
  initiatePayment,
  verifyRazorpayWebhookSignature,
  handlePaymentCaptured,
} from "../services/payment.service.js";

/** POST /v1/payments/intent */
export async function createPaymentIntentController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const requestId = generateRequestId();
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res
        .status(401)
        .json(createErrorResponse("UNAUTHORIZED", "Authentication required"));
      return;
    }

    const parsed = CreatePaymentIntentSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json(
          createErrorResponse(
            "VALIDATION_ERROR",
            parsed.error.errors[0]?.message ?? "Invalid input",
          ),
        );
      return;
    }

    const result = await initiatePayment({
      orderId: parsed.data.order_id,
      userId,
      requestId,
    });
    res.status(200).json(createSuccessResponse(result));
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "ORDER_NOT_FOUND") {
        res
          .status(404)
          .json(createErrorResponse("NOT_FOUND", "Order not found"));
        return;
      }
      if (error.message === "ALREADY_PAID") {
        res
          .status(409)
          .json(
            createErrorResponse(
              "ALREADY_PAID",
              "This order has already been paid",
            ),
          );
        return;
      }
    }
    next(error);
  }
}

/** POST /v1/webhooks/payment — Razorpay webhook (no auth, signature-verified) */
export async function paymentWebhookController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const requestId = generateRequestId();
  try {
    const signature = req.headers["x-razorpay-signature"];
    if (!signature || typeof signature !== "string") {
      res
        .status(400)
        .json(
          createErrorResponse(
            "MISSING_SIGNATURE",
            "Webhook signature required",
          ),
        );
      return;
    }

    // Raw body is required for signature verification — must be attached by rawBody middleware
    const rawBody = (req as Request & { rawBody?: string }).rawBody;
    if (!rawBody) {
      res
        .status(400)
        .json(createErrorResponse("INVALID_WEBHOOK", "Raw body required"));
      return;
    }

    // CRITICAL: verify signature before processing
    const isValid = verifyRazorpayWebhookSignature(rawBody, signature);
    if (!isValid) {
      res
        .status(403)
        .json(
          createErrorResponse(
            "INVALID_SIGNATURE",
            "Webhook signature verification failed",
          ),
        );
      return;
    }

    // Parse event after verification
    const event = JSON.parse(rawBody) as {
      event: string;
      payload: { payment: { entity: { order_id: string; id: string } } };
    };

    if (event.event === "payment.captured") {
      await handlePaymentCaptured({
        razorpayOrderId: event.payload.payment.entity.order_id,
        razorpayPaymentId: event.payload.payment.entity.id,
        requestId,
      });
    }

    // Always return 200 to Razorpay to acknowledge receipt
    res.status(200).json({ received: true });
  } catch (error) {
    next(error);
  }
}
