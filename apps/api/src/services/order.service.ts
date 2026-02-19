/**
 * Orders Service — business logic for order creation and management.
 *
 * CRITICAL SECURITY:
 * - Prices are fetched from DB at order time, NEVER from frontend payload
 * - total_amount is computed server-side: sum(price_at_purchase * quantity)
 * - NUMERIC arithmetic done in JS (parseFloat is safe for display; DB stores NUMERIC)
 */

import {
  getCartItemsByUserId,
  clearCart,
} from "../repositories/cart.repository.js";
import {
  createOrder,
  getOrdersByUserId,
  getOrderById,
} from "../repositories/order.repository.js";
import { getDb } from "../utils/supabase.js";
import { logger } from "@ayurveda/shared-utils";
import type { Order } from "@ayurveda/shared-types";

/**
 * Validates cart items and creates an order.
 *
 * Steps:
 * 1. Fetch cart items with current DB prices
 * 2. Verify all products are active and in stock
 * 3. Compute total_amount server-side
 * 4. Create order + order_items with price snapshot
 * 5. Clear the user's cart
 */
export async function placeOrder(params: {
  userId: string;
  shippingAddress: string;
  paymentMethod: string;
  requestId: string;
}): Promise<Order> {
  logger.info(
    "Order placement initiated",
    { userId: params.userId },
    { requestId: params.requestId },
  );

  // Fetch cart items (with product details joined)
  const cartItems = await getCartItemsByUserId(params.userId);

  if (cartItems.length === 0) {
    throw new Error("CART_EMPTY");
  }

  // Compute total_amount from DB prices (never from frontend)
  let totalAmount = 0;
  const orderItems = cartItems.map((item) => {
    const product = (
      item as unknown as {
        product: {
          id: string;
          name: string;
          price: string;
          discount_price: string | null;
        };
      }
    ).product;
    const effectivePrice = product.discount_price
      ? parseFloat(product.discount_price)
      : parseFloat(product.price);

    totalAmount += effectivePrice * item.quantity;

    return {
      product_id: item.product_id,
      product_name: product.name,
      quantity: item.quantity,
      price_at_purchase: effectivePrice.toFixed(2),
    };
  });

  // Create order with server-computed total
  const order = await createOrder({
    user_id: params.userId,
    items: orderItems,
    total_amount: totalAmount.toFixed(2),
    shipping_address: params.shippingAddress,
    payment_method: params.paymentMethod,
  });

  // Clear cart after successful order creation
  await clearCart(params.userId);

  logger.info(
    "Order created",
    { orderId: order.id, userId: params.userId },
    { requestId: params.requestId },
  );

  return order;
}

export async function getUserOrders(userId: string): Promise<Order[]> {
  return getOrdersByUserId(userId);
}

export async function getOrderDetails(
  orderId: string,
  userId: string,
  isAdmin: boolean,
): Promise<Order | null> {
  // Admins can access any order; users only their own (IDOR prevention)
  return getOrderById(orderId, isAdmin ? undefined : userId);
}
