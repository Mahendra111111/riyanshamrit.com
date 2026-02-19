import type { Metadata } from "next";
import { productsApi } from "@/lib/api-client";
import type { Product, PaginatedResponse } from "@ayurveda/shared-types";

export const metadata: Metadata = {
  title: "Products",
  description: "Browse our full range of authentic Ayurvedic products.",
};

export const revalidate = 60;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { page?: string; category?: string };
}) {
  const page = parseInt(searchParams.page ?? "1", 10);
  const category = searchParams.category;

  let products: Product[] = [];
  let total = 0;

  try {
    const res = await productsApi.list({
      page,
      limit: 12,
      ...(category !== undefined && { category }),
    }) as PaginatedResponse<Product>;
    products = res.items ?? [];
    total = res.total;
  } catch {
    // Graceful degradation
  }

  return (
    <main className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-8">All Products</h1>

      {products.length === 0 ? (
        <p className="text-muted-foreground text-center py-20">No products available.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => (
            <a
              key={product.id}
              href={`/products/${product.slug}`}
              className="group block rounded-xl border bg-card p-4 hover:shadow-lg transition-shadow"
            >
              <div className="aspect-square rounded-lg bg-muted mb-4" />
              <h2 className="font-semibold text-base group-hover:text-primary transition-colors line-clamp-2">
                {product.name}
              </h2>
              <p className="text-primary font-semibold mt-2">
                ₹{product.discount_price ?? product.price}
                {product.discount_price && (
                  <span className="text-muted-foreground line-through text-sm ml-2">
                    ₹{product.price}
                  </span>
                )}
              </p>
            </a>
          ))}
        </div>
      )}

      <p className="text-sm text-muted-foreground mt-8 text-center">
        Showing {products.length} of {total} products
      </p>
    </main>
  );
}
