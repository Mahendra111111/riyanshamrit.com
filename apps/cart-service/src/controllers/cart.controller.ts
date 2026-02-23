import { Request, Response, NextFunction } from "express";
import {
  createSuccessResponse,
  createErrorResponse,
  logger,
} from "@ayurveda/shared-utils";
import * as cartRepository from "../repositories/cart.repository.js";

export async function getCart(
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

    const items = await cartRepository.getCartFromRedis(userId);
    const enriched = await cartRepository.enrichCartItems(items);
    res.json(createSuccessResponse(enriched));
  } catch (err) {
    logger.error("Error in getCart controller", err);
    next(err);
  }
}

export async function addToCart(
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

    const { productId, quantity } = req.body as {
      productId: string;
      quantity: number;
    };
    if (!productId || !quantity || quantity < 1) {
      res
        .status(400)
        .json(
          createErrorResponse(
            "VALIDATION_ERROR",
            "productId and quantity (≥1) required",
          ),
        );
      return;
    }

    const items = await cartRepository.getCartFromRedis(userId);
    const existing = items.find((i) => i.productId === productId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      items.push({ productId, quantity });
    }

    await cartRepository.saveCartToRedis(userId, items);
    res.json(createSuccessResponse(items, "Cart updated"));
  } catch (err) {
    logger.error("Error in addToCart controller", err);
    next(err);
  }
}

export async function updateQuantity(
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

    const { productId } = req.params;
    const { quantity } = req.body as { quantity: number };
    if (!productId || !quantity || quantity < 1) {
      res
        .status(400)
        .json(
          createErrorResponse(
            "VALIDATION_ERROR",
            "productId and quantity (≥1) required",
          ),
        );
      return;
    }

    const items = await cartRepository.getCartFromRedis(userId);
    const item = items.find((i) => i.productId === productId);
    if (!item) {
      res
        .status(404)
        .json(createErrorResponse("NOT_FOUND", "Item not in cart"));
      return;
    }

    item.quantity = quantity;
    await cartRepository.saveCartToRedis(userId, items);
    res.json(createSuccessResponse(items, "Quantity updated"));
  } catch (err) {
    logger.error("Error in updateQuantity controller", err);
    next(err);
  }
}

export async function removeFromCart(
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

    const { productId } = req.params;
    if (!productId) {
      res
        .status(400)
        .json(createErrorResponse("BAD_REQUEST", "productId required"));
      return;
    }

    const items = await cartRepository.getCartFromRedis(userId);
    const filtered = items.filter((i) => i.productId !== productId);
    await cartRepository.saveCartToRedis(userId, filtered);
    res.json(createSuccessResponse(filtered, "Item removed"));
  } catch (err) {
    logger.error("Error in removeFromCart controller", err);
    next(err);
  }
}

export async function clearCart(
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

    await cartRepository.clearCart(userId);
    res.json(createSuccessResponse([], "Cart cleared"));
  } catch (err) {
    logger.error("Error in clearCart controller", err);
    next(err);
  }
}
