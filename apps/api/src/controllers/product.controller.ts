/**
 * Products Controller — REST handlers for product endpoints.
 * All business logic is in the service/repository layer.
 */

import type { Request, Response, NextFunction } from "express";
import {
  CreateProductSchema,
  UpdateProductSchema,
  ProductQuerySchema,
} from "@ayurveda/validation-schemas";
import {
  createSuccessResponse,
  createErrorResponse,
  generateRequestId,
  createPaginatedResponse,
} from "@ayurveda/shared-utils";
import {
  getProducts,
  getProductBySlug,
  createProduct,
  updateProduct,
} from "../repositories/product.repository.js";

/** GET /v1/products */
export async function listProductsController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = ProductQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res
        .status(400)
        .json(
          createErrorResponse(
            "VALIDATION_ERROR",
            parsed.error.errors[0]?.message ?? "Invalid query",
          ),
        );
      return;
    }

    const { category, min_price, max_price, page, limit } = parsed.data;
    const result = await getProducts({
      ...(category !== undefined && { category }),
      ...(min_price !== undefined && { minPrice: min_price }),
      ...(max_price !== undefined && { maxPrice: max_price }),
      page,
      limit,
    });

    res
      .status(200)
      .json(createPaginatedResponse(result.data, result.total, page, limit));
  } catch (error) {
    next(error);
  }
}

/** GET /v1/products/:slug */
export async function getProductController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const slug = req.params["slug"] as string;
    if (!slug) {
      res
        .status(400)
        .json(
          createErrorResponse("VALIDATION_ERROR", "Product slug is required"),
        );
      return;
    }
    const product = await getProductBySlug(slug);
    if (!product) {
      res
        .status(404)
        .json(createErrorResponse("NOT_FOUND", "Product not found"));
      return;
    }
    res.status(200).json(createSuccessResponse(product));
  } catch (error) {
    next(error);
  }
}

/** POST /v1/admin/products — Admin only */
export async function createProductController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = CreateProductSchema.safeParse(req.body);
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const product = await createProduct(parsed.data as any);
    res.status(201).json(createSuccessResponse(product, "Product created"));
  } catch (error) {
    if (error instanceof Error && error.message === "SLUG_ALREADY_EXISTS") {
      res
        .status(409)
        .json(
          createErrorResponse(
            "SLUG_ALREADY_EXISTS",
            "A product with this slug already exists",
          ),
        );
      return;
    }
    next(error);
  }
}

/** PATCH /v1/admin/products/:id — Admin only */
export async function updateProductController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params["id"] as string;
    if (!id) {
      res
        .status(400)
        .json(
          createErrorResponse("VALIDATION_ERROR", "Product ID is required"),
        );
      return;
    }

    const parsed = UpdateProductSchema.safeParse(req.body);
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const product = await updateProduct(id, parsed.data as any);
    if (!product) {
      res
        .status(404)
        .json(createErrorResponse("NOT_FOUND", "Product not found"));
      return;
    }

    res.status(200).json(createSuccessResponse(product, "Product updated"));
  } catch (error) {
    next(error);
  }
}
