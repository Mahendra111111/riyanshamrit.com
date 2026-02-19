/**
 * @package @ayurveda/shared-types
 *
 * Shared TypeScript types and interfaces for the Ayurveda platform.
 * Used by: frontend (apps/web), backend API (apps/api), auth service (apps/auth-service).
 *
 * Rules:
 * - No environment-specific logic
 * - No external service calls
 * - No database access
 */

// ─── User Domain ─────────────────────────────────────────────────────────────

export type UserRole = "user" | "admin";

export interface User {
  id: string;
  email: string;
  role: UserRole;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

// ─── JWT Payload ──────────────────────────────────────────────────────────────

/**
 * JWT access token payload (RS256-signed by Auth Service).
 * Verified by backend services using the public key.
 */
export interface JwtPayload {
  sub: string; // user_id
  role: UserRole;
  permissions: string[];
  iat: number;
  exp: number;
}

// ─── Product Domain ───────────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface Product {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string;
  /** Stored as numeric string to avoid floating-point issues */
  price: string;
  /** Nullable discount price */
  discount_price: string | null;
  is_active: boolean;
  images: ProductImage[];
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  is_primary: boolean;
  created_at: string;
}

// ─── Inventory Domain ─────────────────────────────────────────────────────────

export interface Inventory {
  id: string;
  product_id: string;
  /** Total stock in warehouse */
  stock_quantity: number;
  /** Reserved during active orders */
  reserved_quantity: number;
  /** Available = stock_quantity - reserved_quantity */
  available_quantity: number;
  updated_at: string;
}

// ─── Cart Domain ──────────────────────────────────────────────────────────────

export interface CartItem {
  id: string;
  user_id: string;
  product_id: string;
  product: Pick<
    Product,
    "id" | "name" | "slug" | "price" | "discount_price" | "images"
  >;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface Cart {
  items: CartItem[];
  /** Total calculated server-side — never trust client-provided totals */
  total: string;
  item_count: number;
}

// ─── Order Domain ─────────────────────────────────────────────────────────────

export type OrderStatus =
  | "pending"
  | "paid"
  | "shipped"
  | "delivered"
  | "cancelled";
export type PaymentStatus = "pending" | "paid" | "failed";

export interface Order {
  id: string;
  user_id: string;
  status: OrderStatus;
  /** Recalculated server-side — numeric string */
  total_amount: string;
  payment_status: PaymentStatus;
  shipping_address: string;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  /** Snapshot of price at time of purchase */
  price_at_purchase: string;
  created_at: string;
}

// ─── Payment Domain ───────────────────────────────────────────────────────────

export type PaymentProvider = "razorpay" | "stripe";
export type PaymentRecordStatus =
  | "initiated"
  | "successful"
  | "failed"
  | "refunded";

export interface Payment {
  id: string;
  order_id: string;
  payment_provider: PaymentProvider;
  provider_payment_id: string;
  /** Numeric string — never a float */
  amount: string;
  status: PaymentRecordStatus;
  created_at: string;
  updated_at: string;
}

// ─── Review Domain ────────────────────────────────────────────────────────────

export interface Review {
  id: string;
  user_id: string;
  product_id: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  created_at: string;
}

// ─── API Response Types ───────────────────────────────────────────────────────

/**
 * Standard API success response shape.
 * All backend responses must conform to this format.
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

/**
 * Standard API error response shape.
 * No raw stack traces are ever exposed.
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  has_next: boolean;
}

// ─── Admin Domain ─────────────────────────────────────────────────────────────

export interface AdminLog {
  id: string;
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string;
  created_at: string;
}
