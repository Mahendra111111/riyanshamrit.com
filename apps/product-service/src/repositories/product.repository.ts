import { createClient } from "@supabase/supabase-js";
import { Product } from "@ayurveda/shared-types";

const supabase = createClient(
  process.env["SUPABASE_URL"] ?? "",
  process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "",
);

export async function getProducts(params: {
  page: number;
  limit: number;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
}): Promise<{ data: any[]; count: number }> {
  const { page, limit, category, minPrice, maxPrice } = params;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("products")
    .select(
      "id, name, slug, price, discount_price, category_id, categories(name, slug), product_images(image_url, is_primary)",
      { count: "exact" },
    )
    .eq("is_active", true)
    .range(offset, offset + limit - 1)
    .order("created_at", { ascending: false });

  if (category) query = query.eq("categories.slug", category);
  if (minPrice !== undefined) query = query.gte("price", minPrice);
  if (maxPrice !== undefined) query = query.lte("price", maxPrice);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from("products")
    .select("*, categories(id, name, slug), product_images(*)")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as unknown as Product;
}

export async function getCategories(): Promise<any[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug")
    .order("name");

  if (error) throw error;
  return data ?? [];
}
