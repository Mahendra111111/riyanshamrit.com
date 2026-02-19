/**
 * Orders Controller — REST handlers for order endpoints.
 *
 * SECURITY CRITICAL:
 * - User ID is always taken from JWT payload (req.user.sub), NEVER from request body
 * - Admin role check enforced in routes via requireRole middleware
 */

import type { Request, Response, NextFunction } from "express";
import { CreateOrderSchema } from "@ayurveda/validation-schemas";
import {
  createSuccessResponse,
  createErrorResponse,
  generateRequestId,
} from "@ayurveda/shared-utils";
import {
  placeOrder,
  getUserOrders,
  getOrderDetails,
} from "../services/order.service.js";

/** POST /v1/orders */
export async function createOrderController(
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

    const parsed = CreateOrderSchema.safeParse(req.body);
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

    const order = await placeOrder({
      userId,
      shippingAddress: parsed.data.shipping_address,
      paymentMethod: parsed.data.payment_method,
      requestId,
    });
    res
      .status(201)
      .json(createSuccessResponse(order, "Order placed successfully"));
  } catch (error) {
    if (error instanceof Error && error.message === "CART_EMPTY") {
      res.status(400).json(createErrorResponse("CART_EMPTY", "Cart is empty"));
      return;
    }
    next(error);
  }
}

/** GET /v1/orders */
export async function getOrdersController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res
        .status(401)
        .json(createErrorResponse("UNAUTHORIZED", "Authentication required"));
      return;
    }
    const orders = await getUserOrders(userId);
    res.status(200).json(createSuccessResponse(orders));
  } catch (error) {
    next(error);
  }
}

/** GET /v1/orders/:id */
export async function getOrderController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.sub;
    const isAdmin = req.user?.role === "admin";
    const orderId = req.params["id"];
    if (!userId) {
      res
        .status(401)
        .json(createErrorResponse("UNAUTHORIZED", "Authentication required"));
      return;
    }
    if (!orderId) {
      res
        .status(400)
        .json(createErrorResponse("VALIDATION_ERROR", "Order ID required"));
      return;
    }
    const order = await getOrderDetails(orderId, userId, isAdmin);
    if (!order) {
      res.status(404).json(createErrorResponse("NOT_FOUND", "Order not found"));
      return;
    }
    res.status(200).json(createSuccessResponse(order));
  } catch (error) {
    next(error);
  }
}
