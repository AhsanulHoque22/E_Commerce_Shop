import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  ProductsShopSidebar,
  normalizeCategoryTree,
  type CategoryTreeNode,
  type ProductFacets,
} from "@/components/ProductsShopSidebar";
import { apiFetch } from "@/services/api";
import { ProductCard, type CardProduct } from "@/components/ProductCard";

export function ProductsPage() {
  const [sp] = useSearchParams();
  const search = sp.get("q") ?? "";
  const category = sp.get("category") ?? "";
  const brand = sp.get("brand") ?? "";
  const minPrice = sp.get("minPrice") ?? "";
  const maxPrice = sp.get("maxPrice") ?? "";

  const cats = useQuery({
    queryKey: ["categories", "tree"],
    queryFn: () => apiFetch<CategoryTreeNode[]>("/api/categories"),
    staleTime: 60_000,
  });

  const facets = useQuery({
    queryKey: ["products", "facets"],
    queryFn: () => apiFetch<ProductFacets>("/api/products/facets"),
    staleTime: 120_000,
  });

  const q = useQuery({
    queryKey: ["products", search, category, brand, minPrice, maxPrice],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (search) {
        qs.set("search", search);
      }
      if (category) {
        qs.set("category", category);
      }
      if (brand) {
        qs.set("brand", brand);
      }
      if (minPrice) {
        qs.set("minPrice", minPrice);
      }
      if (maxPrice) {
        qs.set("maxPrice", maxPrice);
      }
      qs.set("limit", "24");
      const url = "/api/products?" + qs.toString();
      return apiFetch<{ items: CardProduct[]; total: number }>(url);
    },
  });

  const filterActive =
    Boolean(search) ||
    Boolean(category) ||
    Boolean(brand) ||
    Boolean(minPrice) ||
    Boolean(maxPrice);

  const empty =
    q.isSuccess && q.data.total === 0 && filterActive;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div>
        <h1 className="font-display text-3xl font-semibold">Shop</h1>
        <p className="mt-2 text-sm text-muted">
          {q.isLoading
            ? "Loading…"
            : q.data
              ? `${q.data.total} result${q.data.total === 1 ? "" : "s"}`
              : ""}
          {search ? (
            <span className="text-ink">
              {" "}
              for &ldquo;{search}&rdquo;
            </span>
          ) : null}
        </p>
      </div>

      <div className="mt-10 flex flex-col gap-10 lg:flex-row lg:items-start">
        <ProductsShopSidebar
          categories={normalizeCategoryTree(cats.data)}
          facets={facets.data}
        />
        <div className="min-w-0 flex-1">
          {empty ? (
            <div className="rounded-2xl border border-border bg-bg px-6 py-12 text-center">
              <p className="text-muted">No products match these filters.</p>
              <Link
                to="/products"
                className="mt-4 inline-block text-sm font-medium text-accent hover:underline"
              >
                Reset filters
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {q.data?.items.map((p) => (
                <ProductCard key={p.publicId} p={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
