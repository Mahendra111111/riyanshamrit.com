import { Request, Response, NextFunction } from "express";
import {
  createSuccessResponse,
  createErrorResponse,
  logger,
} from "@ayurveda/shared-utils";
import * as inventoryRepository from "../repositories/inventory.repository.js";

export async function getInventory(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const productId = req.params["productId"];
    if (!productId || typeof productId !== "string") {
      res
        .status(400)
        .json(createErrorResponse("VALIDATION_ERROR", "Product ID required"));
      return;
    }
    const inventory = await inventoryRepository.getInventory(productId);

    if (!inventory) {
      res
        .status(404)
        .json(createErrorResponse("NOT_FOUND", "Inventory record not found"));
      return;
    }

    res.json(createSuccessResponse(inventory));
  } catch (err) {
    logger.error("Error in getInventory controller", err);
    next(err);
  }
}

export async function reserveInventory(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { items } = req.body as {
      items: Array<{ productId: string; quantity: number }>;
    };
    if (!Array.isArray(items) || items.length === 0) {
      res
        .status(400)
        .json(createErrorResponse("VALIDATION_ERROR", "items array required"));
      return;
    }

    const results: Array<{ productId: string; status: string }> = [];
    for (const item of items) {
      const success = await inventoryRepository.reserveInventory(
        item.productId,
        item.quantity,
      );
      results.push({
        productId: item.productId,
        status: success ? "RESERVED" : "INSUFFICIENT_STOCK",
      });
    }

    const failed = results.filter((r) => r.status !== "RESERVED");
    if (failed.length > 0) {
      res
        .status(409)
        .json(
          createErrorResponse(
            "INSUFFICIENT_STOCK",
            `Insufficient stock for ${failed.length} item(s)`,
          ),
        );
      return;
    }

    res.json(createSuccessResponse(results, "Inventory reserved"));
  } catch (err) {
    logger.error("Error in reserveInventory controller", err);
    next(err);
  }
}

export async function releaseInventory(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { items } = req.body as {
      items: Array<{ productId: string; quantity: number }>;
    };
    if (!Array.isArray(items) || items.length === 0) {
      res
        .status(400)
        .json(createErrorResponse("VALIDATION_ERROR", "items array required"));
      return;
    }

    for (const item of items) {
      await inventoryRepository.releaseInventory(item.productId, item.quantity);
    }

    res.json(createSuccessResponse(null, "Inventory released"));
  } catch (err) {
    logger.error("Error in releaseInventory controller", err);
    next(err);
  }
}

export async function deductInventory(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { items } = req.body as {
      items: Array<{ productId: string; quantity: number }>;
    };
    if (!Array.isArray(items) || items.length === 0) {
      res
        .status(400)
        .json(createErrorResponse("VALIDATION_ERROR", "items array required"));
      return;
    }

    for (const item of items) {
      await inventoryRepository.deductInventory(item.productId, item.quantity);
    }

    res.json(createSuccessResponse(null, "Inventory deducted"));
  } catch (err) {
    logger.error("Error in deductInventory controller", err);
    next(err);
  }
}
