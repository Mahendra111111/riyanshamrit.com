import { Router } from "express";
import * as orderController from "../controllers/order.controller.js";

const router: Router = Router();

router.get("/", orderController.getOrders);
router.post("/", orderController.createOrder);
router.get("/:id", orderController.getOrderById);

export default router;
