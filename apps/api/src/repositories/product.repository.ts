/**
 * Products Repository — data access layer.
 * Reads/writes only products and categories tables.
 */

import { getDb } from "../utils/supabase.js";
import { logger } from "@ayurveda/shared-utils";
import type { Product } from "@ayurveda/shared-types";

export async function getProducts(params: {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  page: number;
  limit: number;
}): Promise<{ data: Product[]; total: number }> {
  const db = getDb();
  const offset = (params.page - 1) * params.limit;

  let query = db
    .from("products")
    .select("*, category:categories(id,name,slug)", { count: "exact" })
    .eq("is_active", true)
    .range(offset, offset + params.limit - 1);

  if (params.category) {
    query = query.eq("categories.slug", params.category);
  }
  if (params.minPrice !== undefined) {
    query = query.gte("price", params.minPrice);
  }
  if (params.maxPrice !== undefined) {
    query = query.lte("price", params.maxPrice);
  }

  const { data, error, count } = await query;

  if (error) {
    logger.error("getProducts DB error", error);
    throw new Error("Failed to fetch products");
  }

  return { data: (data as unknown as Product[]) ?? [], total: count ?? 0 };
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const db = getDb();
  const { data, error } = await db
    .from("products")
    .select("*, category:categories(id,name,slug), images:product_images(*)")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error("Failed to fetch product");
  }
  return data as unknown as Product;
}

export async function createProduct(params: {
  category_id: string;
  name: string;
  slug: string;
  description: string;
  price: string;
  discount_price?: string | null;
  is_active: boolean;
}): Promise<Product> {
  const db = getDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db.from("products") as any)
    .insert(params)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") throw new Error("SLUG_ALREADY_EXISTS");
    logger.error("createProduct DB error", error);
    throw new Error("Failed to create product");
  }
  return data as unknown as Product;
}

export async function updateProduct(
  id: string,
  updates: Partial<{
    name: string;
    description: string;
    price: string;
    discount_price: string | null;
    is_active: boolean;
  }>,
): Promise<Product | null> {
  const db = getDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db.from("products") as any)
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error("Failed to update product");
  }
  return data as unknown as Product;
}
