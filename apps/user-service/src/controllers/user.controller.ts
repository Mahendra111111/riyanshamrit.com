import { Request, Response, NextFunction } from "express";
import {
  createSuccessResponse,
  createErrorResponse,
  logger,
} from "@ayurveda/shared-utils";
import * as userRepository from "../repositories/user.repository.js";

export async function getMe(
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

    const user = await userRepository.getUserById(userId);
    if (!user) {
      res.status(404).json(createErrorResponse("NOT_FOUND", "User not found"));
      return;
    }

    res.json(createSuccessResponse(user));
  } catch (err) {
    logger.error("Error in getMe controller", err);
    next(err);
  }
}

export async function updateMe(
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

    const { full_name, phone } = req.body as {
      full_name?: string;
      phone?: string;
    };
    const updates: any = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (phone !== undefined) updates.phone = phone;

    const user = await userRepository.updateUser(userId, updates);
    res.json(createSuccessResponse(user, "Profile updated"));
  } catch (err) {
    logger.error("Error in updateMe controller", err);
    next(err);
  }
}

export async function getAddresses(
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

    const addresses = await userRepository.getAddresses(userId);
    res.json(createSuccessResponse(addresses));
  } catch (err) {
    logger.error("Error in getAddresses controller", err);
    next(err);
  }
}

export async function createAddress(
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

    const { line1, line2, city, state, pincode, country, is_default } =
      req.body;
    if (!line1 || !city || !state || !pincode || !country) {
      res
        .status(400)
        .json(
          createErrorResponse(
            "VALIDATION_ERROR",
            "Missing required address fields",
          ),
        );
      return;
    }

    const address = await userRepository.createAddress(userId, {
      line1,
      line2,
      city,
      state,
      pincode,
      country,
      is_default: is_default ?? false,
    });

    res.status(201).json(createSuccessResponse(address, "Address created"));
  } catch (err) {
    logger.error("Error in createAddress controller", err);
    next(err);
  }
}

export async function deleteAddress(
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
        .json(createErrorResponse("VALIDATION_ERROR", "Address ID required"));
      return;
    }
    await userRepository.deleteAddress(id, userId);
    res.json(createSuccessResponse(null, "Address deleted"));
  } catch (err) {
    logger.error("Error in deleteAddress controller", err);
    next(err);
  }
}
