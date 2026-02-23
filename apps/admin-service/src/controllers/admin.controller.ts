import { Request, Response, NextFunction } from "express";
import {
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
  logger,
} from "@ayurveda/shared-utils";
import * as adminRepository from "../repositories/admin.repository.js";

export async function getAnalytics(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const analytics = await adminRepository.getAnalytics();
    res.json(createSuccessResponse(analytics));
  } catch (err) {
    logger.error("Error in getAnalytics controller", err);
    next(err);
  }
}

export async function getOrders(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query["page"] ?? 1));
    const limit = Math.min(100, Number(req.query["limit"] ?? 20));
    const statusQuery = req.query["status"];
    const status = typeof statusQuery === "string" ? statusQuery : undefined;

    const { data, count } = await adminRepository.getOrders({
      page,
      limit,
      ...(status ? { status } : {}),
    });
    res.json(createPaginatedResponse(data, count, page, limit));
  } catch (err) {
    logger.error("Error in getOrders controller", err);
    next(err);
  }
}

export async function updateOrderStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params["id"];
    const { status } = req.body as { status: string };
    const adminId = req.headers["x-user-id"] as string | undefined;

    if (!id || typeof id !== "string") {
      res
        .status(400)
        .json(createErrorResponse("VALIDATION_ERROR", "Order ID required"));
      return;
    }

    if (!adminId) {
      res
        .status(401)
        .json(createErrorResponse("UNAUTHORIZED", "Admin ID missing"));
      return;
    }

    const allowedStatuses = [
      "pending",
      "confirmed",
      "processing",
      "shipped",
      "delivered",
      "failed",
      "cancelled",
      "refunded",
    ];
    if (!allowedStatuses.includes(status)) {
      res
        .status(400)
        .json(
          createErrorResponse(
            "VALIDATION_ERROR",
            `Invalid status. Must be one of: ${allowedStatuses.join(", ")}`,
          ),
        );
      return;
    }

    const order = await adminRepository.updateOrderStatus(id, status);

    await adminRepository.logAdminAction({
      adminId,
      action: "ORDER_STATUS_UPDATED",
      entityType: "order",
      entityId: id,
      details: { new_status: status },
    });

    res.json(createSuccessResponse(order, "Order status updated"));
  } catch (err) {
    logger.error("Error in updateOrderStatus controller", err);
    next(err);
  }
}

export async function createProduct(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = req.body;
    const adminId = req.headers["x-user-id"] as string | undefined;

    if (!adminId) {
      res
        .status(401)
        .json(createErrorResponse("UNAUTHORIZED", "Admin ID missing"));
      return;
    }

    if (!body.name || !body.slug || !body.price || !body.category_id) {
      res
        .status(400)
        .json(
          createErrorResponse(
            "VALIDATION_ERROR",
            "Missing required product fields",
          ),
        );
      return;
    }

    const product = await adminRepository.createProduct(body);

    await adminRepository.logAdminAction({
      adminId,
      action: "PRODUCT_CREATED",
      entityType: "product",
      entityId: String(product.id),
      details: { name: body.name },
    });

    res.status(201).json(createSuccessResponse(product, "Product created"));
  } catch (err) {
    logger.error("Error in createProduct controller", err);
    next(err);
  }
}

export async function updateProduct(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params["id"];
    const adminId = req.headers["x-user-id"] as string | undefined;

    if (!id || typeof id !== "string") {
      res
        .status(400)
        .json(createErrorResponse("VALIDATION_ERROR", "Product ID required"));
      return;
    }

    if (!adminId) {
      res
        .status(401)
        .json(createErrorResponse("UNAUTHORIZED", "Admin ID missing"));
      return;
    }

    const product = await adminRepository.updateProduct(id, req.body);

    await adminRepository.logAdminAction({
      adminId,
      action: "PRODUCT_UPDATED",
      entityType: "product",
      entityId: id,
      details: { updates: req.body },
    });

    res.json(createSuccessResponse(product, "Product updated"));
  } catch (err) {
    logger.error("Error in updateProduct controller", err);
    next(err);
  }
}

export async function deactivateProduct(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params["id"];
    const adminId = req.headers["x-user-id"] as string | undefined;

    if (!id || typeof id !== "string") {
      res
        .status(400)
        .json(createErrorResponse("VALIDATION_ERROR", "Product ID required"));
      return;
    }

    if (!adminId) {
      res
        .status(401)
        .json(createErrorResponse("UNAUTHORIZED", "Admin ID missing"));
      return;
    }

    await adminRepository.deactivateProduct(id);

    await adminRepository.logAdminAction({
      adminId,
      action: "PRODUCT_DEACTIVATED",
      entityType: "product",
      entityId: id,
    });

    res.json(createSuccessResponse(null, "Product deactivated"));
  } catch (err) {
    logger.error("Error in deactivateProduct controller", err);
    next(err);
  }
}

export async function getUsers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query["page"] ?? 1));
    const limit = Math.min(100, Number(req.query["limit"] ?? 20));

    const { data, count } = await adminRepository.getUsers(page, limit);
    res.json(createPaginatedResponse(data, count, page, limit));
  } catch (err) {
    logger.error("Error in getUsers controller", err);
    next(err);
  }
}

export async function updateUserRole(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params["id"];
    const { role } = req.body as { role: string };
    const adminId = req.headers["x-user-id"] as string | undefined;

    if (!id || typeof id !== "string") {
      res
        .status(400)
        .json(createErrorResponse("VALIDATION_ERROR", "User ID required"));
      return;
    }

    if (!adminId) {
      res
        .status(401)
        .json(createErrorResponse("UNAUTHORIZED", "Admin ID missing"));
      return;
    }

    if (!["user", "admin"].includes(role)) {
      res
        .status(400)
        .json(
          createErrorResponse(
            "VALIDATION_ERROR",
            "Role must be 'user' or 'admin'",
          ),
        );
      return;
    }

    const user = await adminRepository.updateUserRole(id, role);

    await adminRepository.logAdminAction({
      adminId,
      action: "USER_ROLE_UPDATED",
      entityType: "user",
      entityId: id,
      details: { new_role: role },
    });

    res.json(createSuccessResponse(user, "User role updated"));
  } catch (err) {
    logger.error("Error in updateUserRole controller", err);
    next(err);
  }
}
