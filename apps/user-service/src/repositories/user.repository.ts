import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env["SUPABASE_URL"] ?? "",
  process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "",
);

export async function getUserById(id: string): Promise<any | null> {
  const { data, error } = await supabase
    .from("users")
    .select("id, email, role, is_verified, created_at, updated_at")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data;
}

export async function updateUser(id: string, updates: any): Promise<any> {
  const { data, error } = await supabase
    .from("users")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, email, role, is_verified, created_at, updated_at")
    .single();

  if (error) throw error;
  return data;
}

export async function getAddresses(userId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from("addresses")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createAddress(
  userId: string,
  address: any,
): Promise<any> {
  const { data, error } = await supabase
    .from("addresses")
    .insert({ ...address, user_id: userId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteAddress(id: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("addresses")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;
}
