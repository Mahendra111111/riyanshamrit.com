import { Request, Response, NextFunction } from "express";
import {
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
  generateRequestId,
  logger,
} from "@ayurveda/shared-utils";
import * as orderRepository from "../repositories/order.repository.js";

export async function getOrders(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.headers["x-user-id"] as string | undefined;
    if (!userId) {
      res.status(401).json(createErrorResponse("UNAUTHORIZED", "No user ID"));
      return;
    }

    const page = Math.max(1, Number(req.query["page"] ?? 1));
    const limit = Math.min(50, Number(req.query["limit"] ?? 10));

    const { data, count } = await orderRepository.getOrdersByUser(
      userId,
      page,
      limit,
    );
    res.json(createPaginatedResponse(data, count, page, limit));
  } catch (err) {
    logger.error("Error in getOrders controller", err);
    next(err);
  }
}

export async function getOrderById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.headers["x-user-id"] as string | undefined;
    if (!userId) {
      res.status(401).json(createErrorResponse("UNAUTHORIZED", "No user ID"));
      return;
    }

    const id = req.params["id"];
    if (!id || typeof id !== "string") {
      res
        .status(400)
        .json(createErrorResponse("VALIDATION_ERROR", "Order ID required"));
      return;
    }
    const order = await orderRepository.getOrderById(id, userId);

    if (!order) {
      res.status(404).json(createErrorResponse("NOT_FOUND", "Order not found"));
      return;
    }

    res.json(createSuccessResponse(order));
  } catch (err) {
    logger.error("Error in getOrderById controller", err);
    next(err);
  }
}

export async function createOrder(
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

    const { items, addressId } = req.body as {
      items: Array<{ productId: string; quantity: number }>;
      addressId: string;
    };

    if (!items || !Array.isArray(items) || items.length === 0 || !addressId) {
      res
        .status(400)
        .json(
          createErrorResponse(
            "VALIDATION_ERROR",
            "items and addressId required",
          ),
        );
      return;
    }

    const order = await orderRepository.createOrder({
      userId,
      addressId,
      items,
      requestId,
    });

    res.status(201).json(createSuccessResponse(order, "Order created"));
  } catch (err: any) {
    if (err.message === "INVALID_PRODUCTS") {
      res
        .status(400)
        .json(
          createErrorResponse(
            "INVALID_PRODUCTS",
            "One or more products are unavailable",
          ),
        );
    } else if (err.message === "INSUFFICIENT_STOCK") {
      res
        .status(409)
        .json(
          createErrorResponse(
            "INSUFFICIENT_STOCK",
            "One or more items are out of stock",
          ),
        );
    } else {
      logger.error("Error in createOrder controller", err);
      next(err);
    }
  }
}
