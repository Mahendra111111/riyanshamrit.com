/**
 * Cart Repository — data access for cart_items table.
 */

import { getDb } from "../utils/supabase.js";
import { logger } from "@ayurveda/shared-utils";
import type { CartItem } from "@ayurveda/shared-types";

export async function getCartItemsByUserId(
  userId: string,
): Promise<CartItem[]> {
  const db = getDb();
  const { data, error } = await db
    .from("cart_items")
    .select("*, product:products(id,name,slug,price,discount_price)")
    .eq("user_id", userId);

  if (error) {
    logger.error("getCartItemsByUserId DB error", error);
    throw new Error("Failed to fetch cart");
  }
  return (data as unknown as CartItem[]) ?? [];
}

export async function upsertCartItem(params: {
  user_id: string;
  product_id: string;
  quantity: number;
}): Promise<CartItem> {
  const db = getDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db.from("cart_items") as any)
    .upsert(params, { onConflict: "user_id,product_id" })
    .select()
    .single();

  if (error) {
    logger.error("upsertCartItem DB error", error);
    throw new Error("Failed to add item to cart");
  }
  return data as unknown as CartItem;
}

export async function updateCartItemQuantity(
  userId: string,
  productId: string,
  quantity: number,
): Promise<CartItem | null> {
  const db = getDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db.from("cart_items") as any)
    .update({ quantity })
    .eq("user_id", userId)
    .eq("product_id", productId)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error("Failed to update cart item");
  }
  return data as unknown as CartItem;
}

export async function deleteCartItem(
  userId: string,
  productId: string,
): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from("cart_items")
    .delete()
    .eq("user_id", userId)
    .eq("product_id", productId);

  if (error) {
    throw new Error("Failed to remove cart item");
  }
}

export async function clearCart(userId: string): Promise<void> {
  const db = getDb();
  const { error } = await db.from("cart_items").delete().eq("user_id", userId);

  if (error) {
    throw new Error("Failed to clear cart");
  }
}
