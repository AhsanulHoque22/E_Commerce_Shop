import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

export type CategoryTreeNode = {
  publicId: string;
  slug: string;
  name: string;
  nameBn: string | null;
  children: CategoryTreeNode[];
};

export type ProductFacets = {
  priceMin: number;
  priceMax: number;
  brands: string[];
};

/** Ensures every node has `children` so tree UIs never throw on missing keys. */
export function normalizeCategoryTree(nodes: unknown): CategoryTreeNode[] {
  if (!Array.isArray(nodes)) {
    return [];
  }
  return nodes
    .filter(
      (n): n is Partial<CategoryTreeNode> =>
        n != null && typeof n === "object"
    )
    .map((n) => ({
      publicId: String(n.publicId ?? ""),
      slug: String(n.slug ?? ""),
      name: String(n.name ?? ""),
      nameBn: n.nameBn ?? null,
      children: normalizeCategoryTree(n.children),
    }));
}

function CategoryTree({
  nodes,
  selectedCategory,
  onPick,
  depth = 0,
}: {
  nodes: CategoryTreeNode[];
  selectedCategory: string;
  onPick: (publicId: string) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <ul
      className={
        depth ? "mt-1 space-y-1 border-l border-border pl-1.5" : "space-y-1"
      }
    >
      {nodes.map((n) => {
        const childList = n.children ?? [];
        const hasKids = childList.length > 0;
        const isOpen = expanded[n.publicId] ?? true;
        const selected = selectedCategory === n.publicId;
        return (
          <li key={n.publicId}>
            <div className="flex items-start gap-0.5">
              {hasKids ? (
                <button
                  type="button"
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted hover:bg-bg"
                  aria-expanded={isOpen}
                  aria-label={isOpen ? "Collapse" : "Expand"}
                  onClick={() =>
                    setExpanded((s) => ({ ...s, [n.publicId]: !isOpen }))
                  }
                >
                  {isOpen ? "▾" : "▸"}
                </button>
              ) : (
                <span className="inline-block w-6 shrink-0" aria-hidden />
              )}
              <button
                type="button"
                onClick={() => onPick(n.publicId)}
                className={
                  "min-h-6 flex-1 break-words rounded-md px-0.5 py-0.5 text-left text-sm leading-snug " +
                  (selected
                    ? "bg-bg font-semibold text-accent"
                    : "text-ink hover:bg-bg hover:text-accent")
                }
              >
                {n.name}
              </button>
            </div>
            {hasKids && isOpen ? (
              <CategoryTree
                nodes={childList}
                selectedCategory={selectedCategory}
                onPick={onPick}
                depth={depth + 1}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function ProductsShopSidebar({
  categories,
  facets,
}: {
  categories: CategoryTreeNode[];
  facets: ProductFacets | undefined;
}) {
  const [sp, setSp] = useSearchParams();
  const category = sp.get("category") ?? "";
  const brandInUrl = sp.get("brand") ?? "";
  const minInUrl = sp.get("minPrice") ?? "";
  const maxInUrl = sp.get("maxPrice") ?? "";

  const [draftMin, setDraftMin] = useState(minInUrl);
  const [draftMax, setDraftMax] = useState(maxInUrl);
  const [draftBrand, setDraftBrand] = useState(brandInUrl);

  useEffect(() => {
    setDraftMin(minInUrl);
    setDraftMax(maxInUrl);
    setDraftBrand(brandInUrl);
  }, [minInUrl, maxInUrl, brandInUrl]);

  function patchParams(updater: (n: URLSearchParams) => void) {
    const n = new URLSearchParams(sp);
    updater(n);
    n.delete("page");
    setSp(n, { replace: true });
  }

  function pickCategory(publicId: string | null) {
    patchParams((n) => {
      if (publicId) {
        n.set("category", publicId);
      } else {
        n.delete("category");
      }
    });
  }

  function applyPriceBrand() {
    let minV = draftMin.trim();
    let maxV = draftMax.trim();
    const minN = minV === "" ? NaN : Number(minV);
    const maxN = maxV === "" ? NaN : Number(maxV);
    if (!Number.isNaN(minN) && !Number.isNaN(maxN) && minN > maxN) {
      [minV, maxV] = [maxV, minV];
      setDraftMin(minV);
      setDraftMax(maxV);
    }
    patchParams((n) => {
      if (minV && !Number.isNaN(Number(minV))) {
        n.set("minPrice", minV);
      } else {
        n.delete("minPrice");
      }
      if (maxV && !Number.isNaN(Number(maxV))) {
        n.set("maxPrice", maxV);
      } else {
        n.delete("maxPrice");
      }
      if (draftBrand.trim()) {
        n.set("brand", draftBrand.trim());
      } else {
        n.delete("brand");
      }
    });
  }

  function clearAll() {
    const q = sp.get("q");
    const n = new URLSearchParams();
    if (q) {
      n.set("q", q);
    }
    setDraftMin("");
    setDraftMax("");
    setDraftBrand("");
    setSp(n, { replace: true });
  }

  const hasFilters =
    Boolean(category) ||
    Boolean(brandInUrl) ||
    Boolean(minInUrl) ||
    Boolean(maxInUrl);

  const pm = facets?.priceMin ?? 0;
  const px = facets?.priceMax ?? 0;
  const rangeHint =
    pm > 0 || px > 0 ? `Catalog roughly BDT ${Math.floor(pm)} – ${Math.ceil(px)}` : null;

  return (
    <aside
      className="w-full shrink-0 lg:sticky lg:top-32 lg:z-[1] lg:max-h-[calc(100dvh-8.5rem)] lg:self-start lg:w-64 xl:top-36 xl:max-h-[calc(100dvh-9rem)] xl:w-72"
      aria-label="Product filters"
    >
      <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-card lg:max-h-[calc(100dvh-8.5rem)] xl:max-h-[calc(100dvh-9rem)]">
        <div className="shrink-0 border-b border-border/60 px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-subtle">
              Filters
            </h2>
            {hasFilters ? (
              <button
                type="button"
                onClick={() => clearAll()}
                className="text-xs font-medium text-accent hover:underline"
              >
                Clear all
              </button>
            ) : null}
          </div>
        </div>

        <div className="px-3 py-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-y-contain lg:[scrollbar-gutter:stable]">
          <div>
            <h3 className="text-xs font-semibold text-muted">Categories</h3>
            <p className="mt-1 text-xs text-subtle">
              Includes subcategories when you pick a parent.
            </p>
            <button
              type="button"
              onClick={() => pickCategory(null)}
              className={
                "mt-3 w-full rounded-lg px-1.5 py-1.5 text-left text-sm " +
                (!category
                  ? "bg-bg font-semibold text-accent"
                  : "text-muted hover:bg-bg hover:text-ink")
              }
            >
              All products
            </button>
            {categories.length > 0 ? (
              <div className="mt-2">
                <CategoryTree
                  nodes={categories}
                  selectedCategory={category}
                  onPick={(id) => pickCategory(id)}
                />
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted">No categories yet.</p>
            )}
          </div>

          <div className="mt-6 border-t border-border pt-5">
            <h3 className="text-xs font-semibold text-muted">Brand</h3>
            <select
              className="mt-2 w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm"
              value={draftBrand}
              onChange={(e) => setDraftBrand(e.target.value)}
              aria-label="Filter by brand"
            >
              <option value="">Any brand</option>
              {(facets?.brands ?? []).map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-5">
            <h3 className="text-xs font-semibold text-muted">Price (BDT)</h3>
            {rangeHint ? (
              <p className="mt-1 text-xs text-subtle">{rangeHint}</p>
            ) : null}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-xs text-muted">
                Min
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-2 text-sm text-ink"
                  value={draftMin}
                  onChange={(e) => setDraftMin(e.target.value)}
                  placeholder="0"
                />
              </label>
              <label className="text-xs text-muted">
                Max
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-2 text-sm text-ink"
                  value={draftMax}
                  onChange={(e) => setDraftMax(e.target.value)}
                  placeholder="∞"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-border bg-surface px-3 py-3">
          <button
            type="button"
            onClick={() => applyPriceBrand()}
            className="w-full rounded-xl bg-ink py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Apply price &amp; brand
          </button>
        </div>
      </div>
    </aside>
  );
}
