import { useCallback, useMemo, useState } from "react";

type Props = {
  images: string[];
  productName: string;
};

export function ProductImageGallery({ images, productName }: Props) {
  const urls = useMemo(() => images.filter(Boolean), [images]);
  const [active, setActive] = useState(0);
  const main = urls[active] ?? urls[0];
  const [origin, setOrigin] = useState("50% 50%");
  const [zoom, setZoom] = useState(false);

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    setOrigin(`${Math.min(100, Math.max(0, x))}% ${Math.min(100, Math.max(0, y))}%`);
  }, []);

  if (urls.length === 0) {
    return (
      <div className="aspect-square rounded-3xl bg-gradient-to-br from-border/80 to-bg ring-1 ring-border" />
    );
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      {urls.length > 1 ? (
        <div className="flex flex-row gap-2 overflow-x-auto pb-1 lg:max-h-[min(520px,70vh)] lg:w-[4.5rem] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:pb-0">
          {urls.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl ring-2 transition sm:h-20 sm:w-20 lg:h-[4.5rem] lg:w-[4.5rem] ${
                i === active
                  ? "ring-amber-400 ring-offset-2 ring-offset-surface"
                  : "ring-transparent opacity-80 hover:opacity-100"
              }`}
            >
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        <div
          className="relative aspect-square cursor-zoom-in overflow-hidden rounded-3xl bg-bg ring-1 ring-border"
          onMouseEnter={() => setZoom(true)}
          onMouseLeave={() => {
            setZoom(false);
            setOrigin("50% 50%");
          }}
          onMouseMove={onMove}
        >
          <img
            src={main}
            alt={productName}
            className={`h-full w-full object-cover transition-[transform] duration-150 ease-out will-change-transform ${
              zoom ? "scale-[2]" : "scale-100"
            }`}
            style={{ transformOrigin: origin }}
            draggable={false}
          />
          <p className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/50 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-white backdrop-blur-sm sm:text-xs">
            Hover to zoom
          </p>
        </div>
      </div>
    </div>
  );
}
