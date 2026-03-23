import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { apiFetch } from "@/services/api";
import {
  normalizeCategoryTree,
  type CategoryTreeNode,
} from "@/components/ProductsShopSidebar";

const MEGA_COLS = 4;

function findCategoryById(
  nodes: CategoryTreeNode[],
  id: string
): CategoryTreeNode | null {
  for (const n of nodes) {
    if (n.publicId === id) {
      return n;
    }
    const inner = findCategoryById(n.children ?? [], id);
    if (inner) {
      return inner;
    }
  }
  return null;
}

/** Spread items across columns round-robin (even fill like reference grids). */
function splitIntoColumns<T>(items: T[], columnCount: number): T[][] {
  if (items.length === 0) {
    return [];
  }
  const cc = Math.max(1, columnCount);
  const n = Math.min(cc, items.length);
  const cols: T[][] = Array.from({ length: n }, () => []);
  items.forEach((item, i) => {
    cols[i % n].push(item);
  });
  return cols;
}

export function CategoryMegaNav() {
  const { pathname } = useLocation();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["categories", "tree"],
    queryFn: () => apiFetch<CategoryTreeNode[]>("/api/categories"),
    staleTime: 60_000,
  });

  if (pathname.startsWith("/admin")) {
    return null;
  }

  const categories = normalizeCategoryTree(q.data);
  const hovered = hoveredId
    ? findCategoryById(categories, hoveredId)
    : null;
  const showPanel = Boolean(hovered);

  const columns = hovered
    ? splitIntoColumns(hovered.children ?? [], MEGA_COLS)
    : [];

  const gridColsClass =
    columns.length <= 1
      ? "grid-cols-1"
      : columns.length === 2
        ? "sm:grid-cols-2"
        : columns.length === 3
          ? "sm:grid-cols-2 lg:grid-cols-3"
          : "sm:grid-cols-2 lg:grid-cols-4";

  return (
    <div
      className="border-t border-white/10 bg-ink text-white"
      onMouseLeave={() => setHoveredId(null)}
    >
      <div className="mx-auto flex max-w-7xl items-stretch px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="flex shrink-0 items-center px-3 py-3 text-white/90 hover:bg-white/10"
          aria-label="Home"
          onMouseEnter={() => setHoveredId(null)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-5 w-5"
            aria-hidden
          >
            <path d="M11.47 3.841a.75.75 0 0 1 1.06 0l8.69 8.69a.75.75 0 1 0 1.06-1.061l-9.19-9.19a1.5 1.5 0 0 0-2.12 0l-9.19 9.19a.75.75 0 1 0 1.06 1.06l8.69-8.689Z" />
            <path d="m12 5.432 8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 0-.75-.75h-3a.75.75 0 0 0-.75.75V21a.75.75 0 0 1-.75.75H5.625a1.875 1.875 0 0 1-1.875-1.875v-6.198a2.29 2.29 0 0 0 .091-.086L12 5.432Z" />
          </svg>
        </Link>
        <nav
          className="flex min-w-0 flex-1 items-stretch gap-0 overflow-x-auto"
          aria-label="Product categories"
        >
          {categories.map((c) => {
            const active = hovered?.publicId === c.publicId;
            return (
              <div key={c.publicId} className="relative flex shrink-0">
                <Link
                  to={`/products?category=${encodeURIComponent(c.publicId)}`}
                  className={
                    "flex items-center whitespace-nowrap px-4 py-3 text-sm font-medium tracking-wide transition-colors " +
                    (active
                      ? "bg-white/20 text-white"
                      : "text-white/90 hover:bg-white/10")
                  }
                  onMouseEnter={() => setHoveredId(c.publicId)}
                >
                  {c.name}
                </Link>
              </div>
            );
          })}
        </nav>
      </div>

      {showPanel && hovered ? (
        <div
          className="-mt-px hidden border-t border-black/10 bg-[#e8e8e8] pt-px text-ink shadow-lg md:block"
          onMouseEnter={() => setHoveredId(hovered.publicId)}
        >
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <Link
              to={`/products?category=${encodeURIComponent(hovered.publicId)}`}
              className="mb-4 inline-block text-sm font-bold text-ink hover:text-accent"
              onClick={() => setHoveredId(null)}
            >
              All {hovered.name}
            </Link>
            {(hovered.children ?? []).length > 0 ? (
              <div className={`grid gap-8 ${gridColsClass}`}>
                {columns.map((col, ci) => (
                  <ul key={ci} className="space-y-2 text-sm">
                    {col.map((ch) => {
                      const sub = ch.children ?? [];
                      return (
                      <li key={ch.publicId || ch.slug}>
                        <Link
                          to={`/products?category=${encodeURIComponent(ch.publicId)}`}
                          className="block rounded-md py-1 text-neutral-800 hover:text-accent"
                          onClick={() => setHoveredId(null)}
                        >
                          {ch.name}
                        </Link>
                        {sub.length > 0 ? (
                          <ul className="mt-1 space-y-1 border-l border-neutral-400/40 pl-3 text-xs text-neutral-600">
                            {sub.map((g) => (
                              <li key={g.publicId || g.slug}>
                                <Link
                                  to={`/products?category=${encodeURIComponent(g.publicId)}`}
                                  className="block py-0.5 hover:text-accent"
                                  onClick={() => setHoveredId(null)}
                                >
                                  {g.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    );
                    })}
                  </ul>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-600">
                <Link
                  className="font-medium text-accent hover:underline"
                  to={`/products?category=${encodeURIComponent(hovered.publicId)}`}
                  onClick={() => setHoveredId(null)}
                >
                  View all in {hovered.name}
                </Link>
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
