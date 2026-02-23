import { createClient } from "@supabase/supabase-js";
import Redis from "ioredis";
import {
  signInternalToken,
  publishEvent,
  EVENT_STREAMS,
  logger,
} from "@ayurveda/shared-utils";

const supabase = createClient(
  process.env["SUPABASE_URL"] ?? "",
  process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "",
);

const redis = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379");
const INVENTORY_SERVICE_URL =
  process.env["INVENTORY_SERVICE_URL"] ?? "http://localhost:3040";

export async function getOrdersByUser(
  userId: string,
  page: number,
  limit: number,
): Promise<{ data: any[]; count: number }> {
  const offset = (page - 1) * limit;
  const { data, error, count } = await supabase
    .from("orders")
    .select("*, order_items(*)", { count: "exact" })
    .eq("user_id", userId)
    .range(offset, offset + limit - 1)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
}

export async function getOrderById(
  id: string,
  userId: string,
): Promise<any | null> {
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data;
}

export async function callInventory(
  path: string,
  body: unknown,
  requestId: string,
): Promise<{ ok: boolean; status: number }> {
  const internalToken = signInternalToken({
    service: "order-service",
    requestId,
  });
  const res = await fetch(`${INVENTORY_SERVICE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-token": internalToken,
      "x-request-id": requestId,
    },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status };
}

export async function createOrder(params: {
  userId: string;
  addressId: string;
  items: Array<{ productId: string; quantity: number }>;
  requestId: string;
}): Promise<any> {
  const { userId, addressId, items, requestId } = params;

  // 1. Fetch current prices
  const productIds = items.map((i) => i.productId);
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name, price, discount_price")
    .in("id", productIds)
    .eq("is_active", true);

  if (productsError || !products || products.length !== items.length) {
    throw new Error("INVALID_PRODUCTS");
  }

  // 2. Reserve inventory
  const reserveResult = await callInventory(
    "/v1/inventory/reserve",
    {
      items: items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
      })),
    },
    requestId,
  );
  if (!reserveResult.ok) {
    throw new Error("INSUFFICIENT_STOCK");
  }

  // 3. Calculate total
  const productMap = new Map(products.map((p: any) => [p["id"], p]));
  let totalAmount = 0;
  const orderItems = items.map((item) => {
    const product = productMap.get(item.productId);
    const price = product.discount_price ?? product.price;
    const lineTotal = price * item.quantity;
    totalAmount += lineTotal;
    return {
      product_id: item.productId,
      product_name: product.name,
      quantity: item.quantity,
      unit_price: price,
      total_price: lineTotal,
    };
  });

  // 4. Insert order
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      user_id: userId,
      address_id: addressId,
      status: "pending",
      total_amount: totalAmount,
    })
    .select()
    .single();

  if (orderError || !order) {
    // Release inventory on failure
    await callInventory("/v1/inventory/release", { items }, requestId);
    throw orderError || new Error("CREATE_FAILED");
  }

  // 5. Insert order items
  await supabase
    .from("order_items")
    .insert(orderItems.map((i) => ({ ...i, order_id: order.id })));

  // 6. Publish event
  await publishEvent(redis, EVENT_STREAMS.ORDER, {
    type: "ORDER_CREATED",
    orderId: order.id,
    userId,
    totalAmount: String(totalAmount),
    requestId,
  });

  return order;
}
