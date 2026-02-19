"use client";

import { useState, useEffect } from "react";
import { cartApi } from "@/lib/api-client";
import type { CartItem } from "@ayurveda/shared-types";

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    cartApi.get()
      .then((data) => setItems(data as CartItem[]))
      .catch(() => setError("Failed to load cart. Please refresh."))
      .finally(() => setLoading(false));
  }, []);

  const total = items.reduce((sum, item) => {
    const product = (item as unknown as { product: { price: string; discount_price: string | null } }).product;
    const price = parseFloat(product?.discount_price ?? product?.price ?? "0");
    return sum + price * item.quantity;
  }, 0);

  async function removeItem(productId: string) {
    try {
      await cartApi.remove(productId);
      setItems((prev) => prev.filter((i) => i.product_id !== productId));
    } catch {
      setError("Failed to remove item");
    }
  }

  if (loading) return <main className="container mx-auto px-4 py-12"><p className="text-muted-foreground">Loading cart…</p></main>;
  if (error) return <main className="container mx-auto px-4 py-12"><p id="cart-error" className="text-destructive">{error}</p></main>;
  if (items.length === 0) {
    return (
      <main className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-3xl font-bold mb-4">Your Cart is Empty</h1>
        <a href="/products" className="text-primary hover:underline">Continue Shopping</a>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">Your Cart</h1>
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => {
            const product = (item as unknown as { product: { name: string; price: string; discount_price: string | null } }).product;
            return (
              <div key={item.id} className="flex items-center gap-4 rounded-xl border bg-card p-4">
                <div className="w-20 h-20 rounded-lg bg-muted flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold">{product?.name ?? "Product"}</p>
                  <p className="text-primary font-medium">₹{product?.discount_price ?? product?.price}</p>
                  <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                </div>
                <button
                  id={`remove-${item.product_id}`}
                  onClick={() => removeItem(item.product_id)}
                  className="text-sm text-destructive hover:underline"
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border bg-card p-6 h-fit">
          <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">₹{total.toFixed(2)}</span>
          </div>
          <div className="border-t my-4" />
          <div className="flex justify-between font-bold text-lg mb-6">
            <span>Total</span>
            <span>₹{total.toFixed(2)}</span>
          </div>
          <a
            id="checkout-button"
            href="/checkout"
            className="block w-full rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground text-center hover:bg-primary/90 transition-colors"
          >
            Proceed to Checkout
          </a>
        </div>
      </div>
    </main>
  );
}
