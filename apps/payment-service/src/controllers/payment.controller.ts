import { Request, Response, NextFunction } from "express";
import * as crypto from "crypto";
import {
  createSuccessResponse,
  createErrorResponse,
  generateRequestId,
  logger,
} from "@ayurveda/shared-utils";
import * as paymentRepository from "../repositories/payment.repository.js";

const RAZORPAY_WEBHOOK_SECRET = process.env["RAZORPAY_WEBHOOK_SECRET"] ?? "";

export async function createPaymentIntent(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const requestId =
    (req.headers["x-request-id"] as string | undefined) ?? generateRequestId();
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

    const order = await paymentRepository.getOrderForPayment(orderId, userId);
    if (!order) {
      res.status(404).json(createErrorResponse("NOT_FOUND", "Order not found"));
      return;
    }

    if (order.status !== "pending") {
      res
        .status(409)
        .json(
          createErrorResponse("INVALID_STATE", "Order is not in pending state"),
        );
      return;
    }

    const amountInPaise = Math.round(order.total_amount * 100);
    const rzpOrder = await paymentRepository.createRazorpayOrder(
      amountInPaise,
      orderId,
      userId,
      requestId,
    );

    await paymentRepository.updateOrderRazorpayId(orderId, rzpOrder.id);

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
    logger.error("Error in createPaymentIntent", err);
    next(err);
  }
}

export async function handleWebhook(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const requestId = generateRequestId();
  try {
    const rawBody = req.body as Buffer;
    const signature = req.headers["x-razorpay-signature"] as string | undefined;

    if (!signature) {
      res.status(400).json({ error: "Missing signature" });
      return;
    }

    // Verification
    const expectedSig = crypto
      .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

    if (
      !crypto.timingSafeEqual(
        Buffer.from(signature, "hex"),
        Buffer.from(expectedSig, "hex"),
      )
    ) {
      logger.error("Webhook signature mismatch", undefined, { requestId });
      res.status(400).json({ error: "Invalid signature" });
      return;
    }

    const payload = JSON.parse(rawBody.toString("utf-8"));
    const payment = payload.payload.payment.entity;

    const isUnique = await paymentRepository.checkIdempotency(payment.id);
    if (!isUnique) {
      res.status(200).json({ status: "already_processed" });
      return;
    }

    if (payload.event === "payment.captured") {
      await paymentRepository.processPaymentCaptured(payment, requestId);
    } else if (payload.event === "payment.failed") {
      await paymentRepository.processPaymentFailed(payment, requestId);
    }

    res.status(200).json({ status: "processed" });
  } catch (err) {
    logger.error("Webhook processing failed", err, { requestId });
    next(err);
  }
}
