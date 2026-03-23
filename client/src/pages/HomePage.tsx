import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiFetch } from "@/services/api";
import { ProductCard, type CardProduct } from "@/components/ProductCard";
import { BrandOptionsSection } from "@/components/BrandOptionsSection";
import {
  HomeHeroBanners,
  type HomeHeroAd,
} from "@/components/HomeHeroBanners";

export function HomePage() {
  const heroAds = useQuery({
    queryKey: ["ads", "home_hero"],
    queryFn: () =>
      apiFetch<HomeHeroAd[]>("/api/ads?placement=home_hero"),
    staleTime: 60_000,
  });

  const featured = useQuery({
    queryKey: ["products", "featured"],
    queryFn: async () => {
      const data = await apiFetch<{ items: CardProduct[] }>(
        "/api/products?featured=true&limit=8"
      );
      return data;
    },
  });

  const hot = useQuery({
    queryKey: ["products", "hot"],
    queryFn: async () => {
      const data = await apiFetch<{ items: CardProduct[] }>(
        "/api/products?hot=true&limit=8"
      );
      return data;
    },
  });

  return (
    <div>
      {heroAds.data && heroAds.data.length > 0 ? (
        <HomeHeroBanners ads={heroAds.data} />
      ) : null}
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h1 className="font-display text-4xl font-semibold sm:text-5xl">
            Trusted gadgets, clean checkout.
          </h1>
          <p className="mt-4 text-muted">Premium minimal tech store.</p>
          <Link
            to="/products"
            className="mt-8 inline-flex min-h-11 items-center rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white"
          >
            Shop
          </Link>
        </div>
      </section>
      <BrandOptionsSection />
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="font-display text-2xl font-semibold">Featured</h2>
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {featured.data?.items.map((p) => (
            <ProductCard key={p.publicId} p={p} />
          ))}
        </div>
      </section>
      {hot.data && hot.data.items.length > 0 ? (
        <section className="border-t border-border bg-bg/40 mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="font-display text-2xl font-semibold">Hot products</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Picked from what shoppers are saving to favorites and adding to carts across the store.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {hot.data.items.map((p) => (
              <ProductCard key={p.publicId} p={p} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
