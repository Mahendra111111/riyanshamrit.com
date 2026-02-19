/**
 * @package @ayurveda/validation-schemas
 *
 * Zod schemas for input validation across all backend services.
 * Used by: apps/api, apps/auth-service.
 *
 * Rules:
 * - Schemas are the single source of truth for request shapes
 * - Allowlist validation: reject unknown fields
 * - Re-export inferred types for controller usage
 */

import { z } from "zod";

// ─── Auth Schemas ─────────────────────────────────────────────────────────────

export const RegisterSchema = z
  .object({
    email: z.string().email("Invalid email address").max(255, "Email too long"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password too long")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain uppercase, lowercase, and a number",
      ),
  })
  .strict(); // Reject unknown fields

export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z
  .object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
  })
  .strict();

export type LoginInput = z.infer<typeof LoginSchema>;

// ─── Product Schemas ──────────────────────────────────────────────────────────

export const CreateProductSchema = z
  .object({
    category_id: z.string().uuid("Invalid category ID"),
    name: z.string().min(1).max(255),
    slug: z
      .string()
      .min(1)
      .max(255)
      .regex(
        /^[a-z0-9-]+$/,
        "Slug must be lowercase alphanumeric with hyphens",
      ),
    description: z.string().min(1).max(5000),
    /** Price as string to preserve numeric precision */
    price: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, "Price must be a valid decimal"),
    discount_price: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, "Discount price must be a valid decimal")
      .optional()
      .nullable(),
    is_active: z.boolean().default(true),
  })
  .strict();

export type CreateProductInput = z.infer<typeof CreateProductSchema>;

export const UpdateProductSchema = CreateProductSchema.partial().strict();
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;

export const ProductQuerySchema = z
  .object({
    category: z.string().optional(),
    min_price: z.coerce.number().nonnegative().optional(),
    max_price: z.coerce.number().nonnegative().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export type ProductQueryInput = z.infer<typeof ProductQuerySchema>;

// ─── Cart Schemas ─────────────────────────────────────────────────────────────

export const AddCartItemSchema = z
  .object({
    product_id: z.string().uuid("Invalid product ID"),
    quantity: z
      .number()
      .int()
      .min(1, "Quantity must be at least 1")
      .max(100, "Quantity too large"),
  })
  .strict();

export type AddCartItemInput = z.infer<typeof AddCartItemSchema>;

export const UpdateCartItemSchema = z
  .object({
    quantity: z
      .number()
      .int()
      .min(1, "Quantity must be at least 1")
      .max(100, "Quantity too large"),
  })
  .strict();

export type UpdateCartItemInput = z.infer<typeof UpdateCartItemSchema>;

// ─── Order Schemas ────────────────────────────────────────────────────────────

export const CreateOrderSchema = z
  .object({
    shipping_address: z
      .string()
      .min(10, "Shipping address too short")
      .max(1000),
    payment_method: z.enum(["razorpay", "stripe"]),
  })
  .strict();

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

// ─── Payment Schemas ──────────────────────────────────────────────────────────

export const CreatePaymentIntentSchema = z
  .object({
    order_id: z.string().uuid("Invalid order ID"),
  })
  .strict();

export type CreatePaymentIntentInput = z.infer<
  typeof CreatePaymentIntentSchema
>;

export const VerifyPaymentSchema = z
  .object({
    order_id: z.string().uuid("Invalid order ID"),
    provider_payment_id: z.string().min(1, "Payment ID is required"),
    /** Razorpay signature for server-side HMAC verification */
    provider_signature: z.string().min(1, "Payment signature is required"),
  })
  .strict();

export type VerifyPaymentInput = z.infer<typeof VerifyPaymentSchema>;
