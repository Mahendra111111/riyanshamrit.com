import { Router } from "express";
import * as productController from "../controllers/product.controller.js";

const router: Router = Router();

router.get("/", productController.getProducts);
router.get("/categories", productController.getCategories);
router.get("/:slug", productController.getProductBySlug);

export default router;
