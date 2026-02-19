/**
 * Auth routes — all routes for the authentication service.
 * Rate limiting applied per-endpoint per documentation.
 */

import { Router, type IRouter } from "express";
import {
  registerController,
  loginController,
  refreshController,
  logoutController,
  getMeController,
  getPublicKeyController,
} from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import {
  loginRateLimiter,
  registerRateLimiter,
  refreshRateLimiter,
} from "../middleware/rateLimiter.js";

const router: IRouter = Router();

// Public routes
router.post("/register", registerRateLimiter, registerController);
router.post("/login", loginRateLimiter, loginController);
router.post("/refresh", refreshRateLimiter, refreshController);

// Protected routes (require valid access_token cookie)
router.post("/logout", authenticate, logoutController);
router.get("/me", authenticate, getMeController);

export default router;
