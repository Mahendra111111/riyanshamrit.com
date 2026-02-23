import { Router } from "express";
import * as cartController from "../controllers/cart.controller.js";

const router: Router = Router();

router.get("/", cartController.getCart);
router.post("/", cartController.addToCart);
router.patch("/:productId", cartController.updateQuantity);
router.delete("/:productId", cartController.removeFromCart);
router.delete("/", cartController.clearCart);

export default router;
