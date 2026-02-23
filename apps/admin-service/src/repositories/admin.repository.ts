import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env["SUPABASE_URL"] ?? "",
  process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "",
);

export async function getAnalytics(): Promise<any> {
  const [ordersResult, usersResult, revenueResult] = await Promise.all([
    supabase.from("orders").select("status", { count: "exact", head: true }),
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase.from("payments").select("amount").eq("status", "captured"),
  ]);

  const totalRevenue = (revenueResult.data ?? []).reduce(
    (sum: number, p: any) => sum + p.amount,
    0,
  );

  return {
    totalOrders: ordersResult.count ?? 0,
    totalUsers: usersResult.count ?? 0,
    totalRevenue,
  };
}

export async function getOrders(params: {
  page: number;
  limit: number;
  status?: string;
}): Promise<{ data: any[]; count: number }> {
  const { page, limit, status } = params;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("orders")
    .select("*, users(email), order_items(*)", { count: "exact" })
    .range(offset, offset + limit - 1)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
}

export async function updateOrderStatus(
  id: string,
  status: string,
): Promise<any> {
  const { data, error } = await supabase
    .from("orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createProduct(body: any): Promise<any> {
  const { data, error } = await supabase
    .from("products")
    .insert(body)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProduct(id: string, updates: any): Promise<any> {
  const { data, error } = await supabase
    .from("products")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deactivateProduct(id: string): Promise<void> {
  const { error } = await supabase
    .from("products")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export async function getUsers(
  page: number,
  limit: number,
): Promise<{ data: any[]; count: number }> {
  const offset = (page - 1) * limit;
  const { data, error, count } = await supabase
    .from("users")
    .select("id, email, role, is_verified, created_at", { count: "exact" })
    .range(offset, offset + limit - 1)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
}

export async function updateUserRole(id: string, role: string): Promise<any> {
  const { data, error } = await supabase
    .from("users")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, email, role")
    .single();

  if (error) throw error;
  return data;
}

export async function logAdminAction(params: {
  adminId: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: any;
}): Promise<void> {
  const { adminId, action, entityType, entityId, details } = params;
  await supabase.from("admin_logs").insert({
    admin_id: adminId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details,
  });
}
