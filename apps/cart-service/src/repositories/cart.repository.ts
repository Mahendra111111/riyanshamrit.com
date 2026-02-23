import Redis from "ioredis";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@ayurveda/shared-utils";

const redis = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379");
const supabase = createClient(
  process.env["SUPABASE_URL"] ?? "",
  process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "",
);

const CART_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface CartItem {
  productId: string;
  quantity: number;
}

function cartKey(userId: string): string {
  return `cart:${userId}`;
}

export async function getCartFromRedis(userId: string): Promise<CartItem[]> {
  const raw = await redis.get(cartKey(userId));
  if (!raw) return [];
  return JSON.parse(raw) as CartItem[];
}

export async function saveCartToRedis(
  userId: string,
  items: CartItem[],
): Promise<void> {
  await redis.setex(cartKey(userId), CART_TTL_SECONDS, JSON.stringify(items));
}

export async function clearCart(userId: string): Promise<void> {
  await redis.del(cartKey(userId));
  // Also clear from DB for persistence
  await supabase.from("cart_items").delete().eq("user_id", userId);
}

export async function enrichCartItems(items: CartItem[]): Promise<any[]> {
  if (items.length === 0) return [];

  const productIds = items.map((i) => i.productId);
  const { data: products, error } = await supabase
    .from("products")
    .select(
      "id, name, slug, price, discount_price, product_images(image_url, is_primary)",
    )
    .in("id", productIds);

  if (error) {
    logger.error("Failed to fetch products for cart enrichment", error);
    // Continue with limited data if products fetch fails
  }

  return items.map((item) => {
    const product = products?.find((p) => p.id === item.productId);
    return {
      ...item,
      product: product ?? null,
    };
  });
}
