import { Router } from "express";
import * as userController from "../controllers/user.controller.js";

const router: Router = Router();

// Profile
router.get("/me", userController.getMe);
router.patch("/me", userController.updateMe);

// Addresses
router.get("/me/addresses", userController.getAddresses);
router.post("/me/addresses", userController.createAddress);
router.delete("/me/addresses/:id", userController.deleteAddress);

export default router;
