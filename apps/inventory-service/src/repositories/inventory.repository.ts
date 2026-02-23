import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env["SUPABASE_URL"] ?? "",
  process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "",
);

export async function getInventory(productId: string): Promise<any | null> {
  const { data, error } = await supabase
    .from("inventory")
    .select("*")
    .eq("product_id", productId)
    .single();

  if (error || !data) return null;
  return {
    ...data,
    available: data.stock_quantity - data.reserved_quantity,
  };
}

export async function reserveInventory(
  productId: string,
  quantity: number,
): Promise<boolean> {
  const { error } = await supabase.rpc("reserve_inventory", {
    p_product_id: productId,
    p_quantity: quantity,
  });
  return !error;
}

export async function releaseInventory(
  productId: string,
  quantity: number,
): Promise<void> {
  await supabase.rpc("release_inventory", {
    p_product_id: productId,
    p_quantity: quantity,
  });
}

export async function deductInventory(
  productId: string,
  quantity: number,
): Promise<void> {
  await supabase.rpc("deduct_inventory", {
    p_product_id: productId,
    p_quantity: quantity,
  });
}
