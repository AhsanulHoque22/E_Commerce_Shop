import { Link } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";

export type HomeHeroAd = {
  publicId: string;
  title: string;
  imageUrl: string;
  linkUrl: string | null;
  linkProductPublicId: string | null;
  linkCategoryPublicId: string | null;
};

function adTarget(
  ad: HomeHeroAd
):
  | { kind: "external"; href: string }
  | { kind: "internal"; to: string }
  | null {
  if (ad.linkProductPublicId) {
    return { kind: "internal", to: `/products/${ad.linkProductPublicId}` };
  }
  if (ad.linkCategoryPublicId) {
    const q = new URLSearchParams({ category: ad.linkCategoryPublicId });
    return { kind: "internal", to: `/products?${q.toString()}` };
  }
  const raw = ad.linkUrl?.trim();
  if (raw && /^https?:\/\//i.test(raw)) {
    return { kind: "external", href: raw };
  }
  return null;
}

function SlideContent({ ad }: { ad: HomeHeroAd }) {
  const target = adTarget(ad);
  const img = (
    <img
      src={ad.imageUrl}
      alt={ad.title}
      className="h-full w-full object-cover object-center"
      loading={target ? "eager" : "lazy"}
      decoding="async"
    />
  );

  if (target?.kind === "external") {
    return (
      <a
        href={target.href}
        target="_blank"
        rel="noopener noreferrer"
        className="block h-full w-full outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/80"
      >
        {img}
      </a>
    );
  }
  if (target?.kind === "internal") {
    return (
      <Link
        to={target.to}
        className="block h-full w-full outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/80"
      >
        {img}
      </Link>
    );
  }
  return <div className="h-full w-full">{img}</div>;
}

const AUTO_MS = 6500;

function ChevronLeft() {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 19l-7-7 7-7"
      />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}

export function HomeHeroBanners({ ads }: { ads: HomeHeroAd[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = ads.length;

  const go = useCallback(
    (dir: -1 | 1) => {
      setIndex((i) => (i + dir + n) % n);
    },
    [n]
  );

  useEffect(() => {
    setIndex((i) => (n ? Math.min(i, n - 1) : 0));
  }, [n]);

  useEffect(() => {
    if (n <= 1 || paused) {
      return;
    }
    const t = window.setInterval(() => {
      if (document.hidden) {
        return;
      }
      setIndex((i) => (i + 1) % n);
    }, AUTO_MS);
    return () => window.clearInterval(t);
  }, [n, paused]);

  if (n === 0) {
    return null;
  }

  const slideFrac = 100 / n;

  return (
    <section
      tabIndex={0}
      className="relative w-full border-b border-border outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
      aria-label="Promotional banners"
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onKeyDown={(e) => {
        if (n <= 1) {
          return;
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          go(-1);
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          go(1);
        }
      }}
    >
      <div className="h-1 w-full bg-amber-400" aria-hidden />
      <div className="relative h-[min(38vw,400px)] min-h-[150px] w-full overflow-hidden bg-neutral-900 sm:min-h-[180px]">
        <div
          className="flex h-full transition-transform duration-500 ease-out motion-reduce:transition-none"
          style={{
            width: `${n * 100}%`,
            transform: `translateX(-${index * slideFrac}%)`,
          }}
        >
          {ads.map((ad) => (
            <div
              key={ad.publicId}
              className="h-full flex-shrink-0"
              style={{ width: `${slideFrac}%` }}
              aria-hidden={ads[index]?.publicId !== ad.publicId}
            >
              <SlideContent ad={ad} />
            </div>
          ))}
        </div>

        {n > 1 ? (
          <>
            <button
              type="button"
              className="absolute left-1 top-1/2 z-10 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center text-white transition-opacity hover:opacity-85 active:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-0 sm:left-3 [&_svg]:drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
              aria-label="Previous slide"
              onClick={(e) => {
                e.stopPropagation();
                go(-1);
              }}
            >
              <ChevronLeft />
            </button>
            <button
              type="button"
              className="absolute right-1 top-1/2 z-10 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center text-white transition-opacity hover:opacity-85 active:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-0 sm:right-3 [&_svg]:drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
              aria-label="Next slide"
              onClick={(e) => {
                e.stopPropagation();
                go(1);
              }}
            >
              <ChevronRight />
            </button>
            <div
              className="absolute bottom-3 left-0 right-0 z-10 flex justify-center gap-2 sm:bottom-4"
              role="tablist"
              aria-label="Slide indicators"
            >
              {ads.map((ad, i) => (
                <button
                  key={ad.publicId}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Go to slide ${i + 1}`}
                  className={
                    i === index
                      ? "h-2.5 w-2.5 rounded-full bg-ink ring-2 ring-white/90 sm:h-3 sm:w-3"
                      : "h-2.5 w-2.5 rounded-full bg-white/75 ring-1 ring-black/20 transition hover:bg-white sm:h-3 sm:w-3"
                  }
                  onClick={() => setIndex(i)}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
