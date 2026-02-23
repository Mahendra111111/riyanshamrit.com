import express, { Router } from "express";
import * as paymentController from "../controllers/payment.controller.js";

const router: Router = Router();

// /v1/payments/intent
router.post("/intent", paymentController.createPaymentIntent);

export default router;

// Webhook route needs specific middleware treatment in index.ts
export const webhookRouter: Router = Router();
webhookRouter.post(
  "/payment",
  express.raw({ type: "application/json" }),
  paymentController.handleWebhook,
);
