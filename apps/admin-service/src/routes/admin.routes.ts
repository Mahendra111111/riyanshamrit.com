import { Router } from "express";
import * as adminController from "../controllers/admin.controller.js";

const router: Router = Router();

// Dashboard
router.get("/analytics", adminController.getAnalytics);

// Orders
router.get("/orders", adminController.getOrders);
router.patch("/orders/:id/status", adminController.updateOrderStatus);

// Products
router.post("/products", adminController.createProduct);
router.patch("/products/:id", adminController.updateProduct);
router.delete("/products/:id", adminController.deactivateProduct);

// Users
router.get("/users", adminController.getUsers);
router.patch("/users/:id/role", adminController.updateUserRole);

export default router;
