import { Link } from "react-router-dom";

export type CardProduct = {
  publicId: string;
  name: string;
  brand?: string | null;
  shortDescription: string | null;
  price: string;
  stock: number;
  inStock: boolean;
  mainImageUrl: string | null;
  badges: { new: boolean; bestseller: boolean; limitedStock: boolean };
};

export function ProductCard({ p }: { p: CardProduct }) {
  return (
    <Link
      to={`/products/${p.publicId}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-card transition hover:-translate-y-0.5"
    >
      <div className="aspect-[3/4] w-full overflow-hidden bg-bg">
        {p.mainImageUrl ? (
          <img
            src={p.mainImageUrl}
            alt=""
            className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-subtle">
            No image
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        {p.brand ? (
          <p className="text-xs font-medium uppercase tracking-wide text-subtle">
            {p.brand}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {p.badges.new && (
            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">
              New
            </span>
          )}
          {p.badges.bestseller && (
            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">
              Best seller
            </span>
          )}
          {p.badges.limitedStock && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-900">
              Limited stock
            </span>
          )}
        </div>
        <h3 className="mt-2 font-display text-base font-semibold leading-snug line-clamp-2">
          {p.name}
        </h3>
        {p.shortDescription && (
          <p className="mt-1 text-sm text-muted line-clamp-1">{p.shortDescription}</p>
        )}
        <p className="mt-3 text-lg font-semibold">BDT {p.price}</p>
        <p className="mt-1 text-xs text-muted">
          {p.inStock ? `In stock (${p.stock})` : "Out of stock"}
        </p>
        <span className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white">
          View details
        </span>
      </div>
    </Link>
  );
}
