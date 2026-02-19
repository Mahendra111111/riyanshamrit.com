/**
 * API routes — all route definitions.
 */

import { Router } from "express";
import { verifyJwt } from "../middleware/verifyJwt.js";
import { requirePermission, requireRole } from "../middleware/requireRole.js";

import {
  listProductsController,
  getProductController,
  createProductController,
  updateProductController,
} from "../controllers/product.controller.js";

import {
  getCartController,
  addCartItemController,
  updateCartItemController,
  removeCartItemController,
} from "../controllers/cart.controller.js";

import {
  createOrderController,
  getOrdersController,
  getOrderController,
} from "../controllers/order.controller.js";

import {
  createPaymentIntentController,
  paymentWebhookController,
} from "../controllers/payment.controller.js";

const router = Router();

// ─── Products ─────────────────────────────────────────────────────────────────

// Public product listing/detail
router.get("/products", listProductsController);
router.get("/products/:slug", getProductController);

// Admin-only product management
router.post(
  "/admin/products",
  verifyJwt,
  requireRole("admin"),
  createProductController,
);
router.patch(
  "/admin/products/:id",
  verifyJwt,
  requireRole("admin"),
  updateProductController,
);

// ─── Cart (Authentication required) ──────────────────────────────────────────

router.get("/cart", verifyJwt, getCartController);
router.post("/cart", verifyJwt, addCartItemController);
router.patch("/cart/:productId", verifyJwt, updateCartItemController);
router.delete("/cart/:productId", verifyJwt, removeCartItemController);

// ─── Orders ───────────────────────────────────────────────────────────────────

router.post(
  "/orders",
  verifyJwt,
  requirePermission("place_order"),
  createOrderController,
);
router.get("/orders", verifyJwt, getOrdersController);
router.get("/orders/:id", verifyJwt, getOrderController);

// Admin: view all orders
router.get(
  "/admin/orders",
  verifyJwt,
  requireRole("admin"),
  getOrdersController,
);

// ─── Payments ─────────────────────────────────────────────────────────────────

router.post("/payments/intent", verifyJwt, createPaymentIntentController);

// Webhook is public but signature-verified inside controller
router.post("/webhooks/payment", paymentWebhookController);

export default router;
