import { Request, Response, NextFunction } from "express";
import {
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
  logger,
} from "@ayurveda/shared-utils";
import * as productRepository from "../repositories/product.repository.js";

export async function getProducts(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query["page"] ?? 1));
    const limit = Math.min(50, Math.max(1, Number(req.query["limit"] ?? 12)));
    const category =
      typeof req.query["category"] === "string"
        ? req.query["category"]
        : undefined;
    const minPrice =
      req.query["minPrice"] !== undefined
        ? Number(req.query["minPrice"])
        : undefined;
    const maxPrice =
      req.query["maxPrice"] !== undefined
        ? Number(req.query["maxPrice"])
        : undefined;

    const params: {
      page: number;
      limit: number;
      category?: string;
      minPrice?: number;
      maxPrice?: number;
    } = { page, limit };

    if (category) params.category = category;
    if (minPrice !== undefined) params.minPrice = minPrice;
    if (maxPrice !== undefined) params.maxPrice = maxPrice;

    const { data, count } = await productRepository.getProducts(params);

    res.json(createPaginatedResponse(data, count, page, limit));
  } catch (err) {
    logger.error("Error in getProducts controller", err);
    next(err);
  }
}

export async function getProductBySlug(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const slug = req.params["slug"];
    if (!slug || typeof slug !== "string") {
      res
        .status(400)
        .json(createErrorResponse("BAD_REQUEST", "Slug is required"));
      return;
    }

    const product = await productRepository.getProductBySlug(slug);
    if (!product) {
      res
        .status(404)
        .json(createErrorResponse("NOT_FOUND", "Product not found"));
      return;
    }

    res.json(createSuccessResponse(product));
  } catch (err) {
    logger.error("Error in getProductBySlug controller", err);
    next(err);
  }
}

export async function getCategories(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const categories = await productRepository.getCategories();
    res.json(createSuccessResponse(categories));
  } catch (err) {
    logger.error("Error in getCategories controller", err);
    next(err);
  }
}
