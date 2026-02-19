import type { Metadata } from "next";
import { productsApi } from "@/lib/api-client";
import type { Product, PaginatedResponse } from "@ayurveda/shared-types";

export const metadata: Metadata = {
  title: "AyurVeda — Pure. Natural. Authentic.",
  description: "Discover authentic Ayurvedic products — oils, herbs, skincare, and wellness.",
};

// Statically generated with ISR revalidation every 60 seconds
export const revalidate = 60;

export default async function HomePage() {
  let featuredProducts: Product[] = [];
  try {
    const res = await productsApi.list({ limit: 6, page: 1 }) as PaginatedResponse<Product>;
    featuredProducts = res.items ?? [];
  } catch {
    // Graceful degradation — show page without products on error
  }

  return (
    <main>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary/10 via-background to-accent/10 py-24 text-center">
        <div className="container mx-auto px-4">
          <h1 className="text-5xl font-bold tracking-tight text-foreground mb-6">
            Pure Ayurvedic Wellness
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Handcrafted products rooted in 5000 years of traditional wisdom.
            Sustainable, authentic, and made with care.
          </p>
          <a
            href="/products"
            className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors"
          >
            Shop Now
          </a>
        </div>
      </section>

      {/* Featured Products */}
      {featuredProducts.length > 0 && (
        <section className="py-16 container mx-auto px-4">
          <h2 className="text-3xl font-semibold mb-8 text-center">Featured Products</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredProducts.map((product) => (
              <a
                key={product.id}
                href={`/products/${product.slug}`}
                className="group block rounded-xl border bg-card p-4 hover:shadow-lg transition-shadow"
              >
                <div className="aspect-square rounded-lg bg-muted mb-4" />
                <h3 className="font-semibold group-hover:text-primary transition-colors">
                  {product.name}
                </h3>
                <p className="text-muted-foreground text-sm mt-1">
                  ₹{product.discount_price ?? product.price}
                </p>
              </a>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
