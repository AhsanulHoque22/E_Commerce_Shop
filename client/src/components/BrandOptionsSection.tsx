import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "@/services/api";

type ShowcaseBrand = {
  brandKey: string;
  displayName: string;
  logoUrl: string;
  filterBrand: string;
};

const AUTO_MS = 5000;
const FALLBACK_STEP = 164;

function useBrandCarousel(itemCount: number) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [paused, setPaused] = useState(false);

  const measureStep = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) {
      return FALLBACK_STEP;
    }
    const card = el.querySelector<HTMLElement>("[data-brand-card]");
    if (!card) {
      return FALLBACK_STEP;
    }
    const style = getComputedStyle(el);
    const gap =
      parseFloat(style.columnGap || style.gap || "0") || 0;
    return card.offsetWidth + gap;
  }, []);

  const scrollByDir = useCallback(
    (dir: 1 | -1) => {
      const el = scrollerRef.current;
      if (!el) {
        return;
      }
      const step = measureStep();
      el.scrollBy({ left: dir * step, behavior: "smooth" });
    },
    [measureStep]
  );

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) {
      return;
    }
    const update = () => {
      setOverflow(el.scrollWidth > el.clientWidth + 4);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [itemCount]);

  useEffect(() => {
    if (!overflow || itemCount <= 1 || paused) {
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const el = scrollerRef.current;
    if (!el) {
      return;
    }
    const tick = () => {
      const current = scrollerRef.current;
      if (!current) {
        return;
      }
      const step = measureStep();
      const atEnd =
        current.scrollLeft + current.clientWidth >= current.scrollWidth - 6;
      if (atEnd) {
        current.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        current.scrollBy({ left: step, behavior: "smooth" });
      }
    };
    const id = window.setInterval(tick, AUTO_MS);
    return () => window.clearInterval(id);
  }, [overflow, itemCount, paused, measureStep]);

  return {
    scrollerRef,
    overflow,
    scrollByDir,
    setPaused,
  };
}

export function BrandOptionsSection() {
  const q = useQuery({
    queryKey: ["products", "brands", "showcase"],
    queryFn: () =>
      apiFetch<{ items: ShowcaseBrand[] }>("/api/products/brands"),
    staleTime: 60_000,
  });

  const items = q.data?.items ?? [];
  const { scrollerRef, overflow, scrollByDir, setPaused } = useBrandCarousel(
    items.length
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="border-b border-border bg-[#e8f4f6]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="font-display text-2xl font-semibold text-ink">
          Brand Options
        </h2>
        <p className="mt-1 text-sm text-muted">
          Shop by the brands we carry in store.
        </p>

        <div
          className="relative mt-8"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {overflow ? (
            <>
              <button
                type="button"
                aria-label="Previous brands"
                className="absolute left-0 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border/80 bg-white/95 text-ink shadow-md backdrop-blur-sm transition hover:bg-white hover:shadow-lg sm:left-1"
                onClick={() => scrollByDir(-1)}
              >
                <span className="sr-only">Previous</span>
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <button
                type="button"
                aria-label="Next brands"
                className="absolute right-0 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border/80 bg-white/95 text-ink shadow-md backdrop-blur-sm transition hover:bg-white hover:shadow-lg sm:right-1"
                onClick={() => scrollByDir(1)}
              >
                <span className="sr-only">Next</span>
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </>
          ) : null}

          <div
            ref={scrollerRef}
            className={`flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-5 [&::-webkit-scrollbar]:hidden ${
              overflow
                ? "scroll-pl-3 scroll-pr-3 px-11 sm:scroll-pl-4 sm:scroll-pr-4 sm:px-12"
                : "pl-1 pr-1 sm:pl-2 sm:pr-2"
            }`}
            role="region"
            aria-label="Brand logos, scroll horizontally or use previous and next buttons"
          >
            {items.map((b) => (
              <Link
                key={b.brandKey}
                data-brand-card
                to={"/products?brand=" + encodeURIComponent(b.filterBrand)}
                className="group shrink-0 snap-center snap-always"
              >
                <div className="flex h-[100px] w-[148px] flex-col items-center justify-center rounded-xl border border-border/60 bg-white px-4 py-5 shadow-sm transition-shadow group-hover:shadow-md sm:h-[108px] sm:w-[160px]">
                  <img
                    src={b.logoUrl}
                    alt={b.displayName}
                    className="max-h-11 w-full max-w-[120px] object-contain object-center opacity-90 grayscale transition-all group-hover:grayscale-0 sm:max-h-12"
                  />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
