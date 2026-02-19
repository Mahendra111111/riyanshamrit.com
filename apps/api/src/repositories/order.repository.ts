/**
 * Orders Repository — data access for orders and order_items tables.
 *
 * Key design decisions:
 * - price_at_purchase is snapshot at order time (future price changes don't alter history)
 * - total_amount computed server-side from DB prices (never from frontend)
 * - All amounts are NUMERIC(12,2) in DB and stored as strings in transit
 */

import { getDb } from "../utils/supabase.js";
import { logger } from "@ayurveda/shared-utils";
import type { Order } from "@ayurveda/shared-types";

export interface DbOrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  price_at_purchase: string;
}

export async function createOrder(params: {
  user_id: string;
  items: DbOrderItem[];
  total_amount: string;
  shipping_address: string;
  payment_method: string;
}): Promise<Order> {
  const db = getDb();

  // Step 1: Create the order
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order, error: orderError } = await (db.from("orders") as any)
    .insert({
      user_id: params.user_id,
      total_amount: params.total_amount,
      shipping_address: params.shipping_address,
      status: "pending",
      payment_status: "pending",
    })
    .select()
    .single();

  if (orderError) {
    logger.error("createOrder DB error", orderError);
    throw new Error("Failed to create order");
  }

  // Step 2: Insert order items
  const orderItems = params.items.map((item) => ({
    order_id: (order as { id: string }).id,
    product_id: item.product_id,
    product_name: item.product_name,
    quantity: item.quantity,
    price_at_purchase: item.price_at_purchase,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: itemsError } = await (db.from("order_items") as any).insert(
    orderItems,
  );

  if (itemsError) {
    logger.error("createOrder items DB error", itemsError);
    throw new Error("Failed to create order items");
  }

  return order as unknown as Order;
}

export async function getOrdersByUserId(userId: string): Promise<Order[]> {
  const db = getDb();
  const { data, error } = await db
    .from("orders")
    .select("*, items:order_items(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Failed to fetch orders");
  }
  return (data as unknown as Order[]) ?? [];
}

export async function getOrderById(
  orderId: string,
  userId?: string,
): Promise<Order | null> {
  const db = getDb();
  let query = db
    .from("orders")
    .select("*, items:order_items(*)")
    .eq("id", orderId);

  // If userId provided, enforce ownership (prevents IDOR)
  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query.single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error("Failed to fetch order");
  }
  return data as unknown as Order;
}

export async function updateOrderStatus(
  orderId: string,
  updates: { status?: string; payment_status?: string },
): Promise<void> {
  const db = getDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db.from("orders") as any)
    .update(updates)
    .eq("id", orderId);

  if (error) {
    throw new Error("Failed to update order status");
  }
}
