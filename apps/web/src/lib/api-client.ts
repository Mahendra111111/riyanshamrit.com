/**
 * API client for the frontend.
 *
 * SECURITY:
 * - All API calls go through the backend API (never Supabase directly from frontend)
 * - Credentials: "include" ensures httpOnly cookies are sent
 * - No tokens stored in localStorage or Redux
 */

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3002";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}/v1${path}`, {
    ...options,
    credentials: "include", // Send httpOnly cookies
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const json = (await res.json()) as {
    status: string;
    data?: T;
    error?: { code: string; message: string };
  };

  if (!res.ok || json.status === "error") {
    throw new ApiError(
      res.status,
      json.error?.code ?? "UNKNOWN_ERROR",
      json.error?.message ?? "An error occurred",
    );
  }

  return json.data as T;
}

// ─── Products API ─────────────────────────────────────────────────────────────

export const productsApi = {
  list: (params?: { category?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.category) query.set("category", params.category);
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    return request(`/products?${query.toString()}`);
  },
  getBySlug: (slug: string) => request(`/products/${slug}`),
};

// ─── Cart API ─────────────────────────────────────────────────────────────────

export const cartApi = {
  get: () => request("/cart"),
  add: (productId: string, quantity: number) =>
    request("/cart", {
      method: "POST",
      body: JSON.stringify({ product_id: productId, quantity }),
    }),
  update: (productId: string, quantity: number) =>
    request(`/cart/${productId}`, {
      method: "PATCH",
      body: JSON.stringify({ quantity }),
    }),
  remove: (productId: string) =>
    request(`/cart/${productId}`, { method: "DELETE" }),
};

// ─── Orders API ───────────────────────────────────────────────────────────────

export const ordersApi = {
  create: (shippingAddress: string, paymentMethod: string) =>
    request("/orders", {
      method: "POST",
      body: JSON.stringify({
        shipping_address: shippingAddress,
        payment_method: paymentMethod,
      }),
    }),
  list: () => request("/orders"),
  get: (id: string) => request(`/orders/${id}`),
};

// ─── Payments API ─────────────────────────────────────────────────────────────

export const paymentsApi = {
  createIntent: (orderId: string) =>
    request("/payments/intent", {
      method: "POST",
      body: JSON.stringify({ order_id: orderId }),
    }),
};
