import { Router } from "express";
import * as inventoryController from "../controllers/inventory.controller.js";

const router: Router = Router();

router.get("/:productId", inventoryController.getInventory);
router.post("/reserve", inventoryController.reserveInventory);
router.post("/release", inventoryController.releaseInventory);
router.post("/deduct", inventoryController.deductInventory);

export default router;
