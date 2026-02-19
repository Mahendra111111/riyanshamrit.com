/**
 * Cart Controller and Routes — /v1/cart endpoints.
 */

import type { Request, Response, NextFunction } from "express";
import {
  AddCartItemSchema,
  UpdateCartItemSchema,
} from "@ayurveda/validation-schemas";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@ayurveda/shared-utils";
import {
  getCartItemsByUserId,
  upsertCartItem,
  updateCartItemQuantity,
  deleteCartItem,
} from "../repositories/cart.repository.js";

/** GET /v1/cart */
export async function getCartController(
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
    const items = await getCartItemsByUserId(userId);
    res.status(200).json(createSuccessResponse(items));
  } catch (error) {
    next(error);
  }
}

/** POST /v1/cart */
export async function addCartItemController(
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
    const parsed = AddCartItemSchema.safeParse(req.body);
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
    const item = await upsertCartItem({ user_id: userId, ...parsed.data });
    res.status(201).json(createSuccessResponse(item, "Item added to cart"));
  } catch (error) {
    next(error);
  }
}

/** PATCH /v1/cart/:productId */
export async function updateCartItemController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.sub;
    const productId = req.params["productId"];
    if (!userId) {
      res
        .status(401)
        .json(createErrorResponse("UNAUTHORIZED", "Authentication required"));
      return;
    }
    if (!productId) {
      res
        .status(400)
        .json(createErrorResponse("VALIDATION_ERROR", "Product ID required"));
      return;
    }
    const parsed = UpdateCartItemSchema.safeParse(req.body);
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
    const item = await updateCartItemQuantity(
      userId,
      productId,
      parsed.data.quantity,
    );
    if (!item) {
      res
        .status(404)
        .json(createErrorResponse("NOT_FOUND", "Cart item not found"));
      return;
    }
    res.status(200).json(createSuccessResponse(item, "Cart updated"));
  } catch (error) {
    next(error);
  }
}

/** DELETE /v1/cart/:productId */
export async function removeCartItemController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.sub;
    const productId = req.params["productId"];
    if (!userId) {
      res
        .status(401)
        .json(createErrorResponse("UNAUTHORIZED", "Authentication required"));
      return;
    }
    if (!productId) {
      res
        .status(400)
        .json(createErrorResponse("VALIDATION_ERROR", "Product ID required"));
      return;
    }
    await deleteCartItem(userId, productId);
    res.status(200).json(createSuccessResponse(null, "Item removed from cart"));
  } catch (error) {
    next(error);
  }
}
