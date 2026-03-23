import { type FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

type Props = {
  variant: "header" | "page";
};

export function ProductSearchForm({ variant }: Props) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [sp, setSp] = useSearchParams();
  const onProducts = pathname === "/products";
  const urlQ = onProducts ? (sp.get("q") ?? "") : "";

  const [value, setValue] = useState(urlQ);

  useEffect(() => {
    if (onProducts) {
      setValue(sp.get("q") ?? "");
    }
  }, [onProducts, sp]);

  function applyQuery(trimmed: string) {
    const next = onProducts
      ? new URLSearchParams(sp)
      : new URLSearchParams();
    if (trimmed) {
      next.set("q", trimmed);
    } else {
      next.delete("q");
    }
    const search = next.toString();
    if (onProducts) {
      setSp(next, { replace: true });
    } else {
      navigate(search ? `/products?${search}` : "/products");
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    applyQuery(value.trim());
  }

  const inputCls =
    variant === "header"
      ? "min-h-9 min-w-0 flex-1 rounded-lg border border-border bg-bg px-2 py-2 text-sm text-ink placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent sm:px-3"
      : "min-h-11 w-full rounded-xl border border-border bg-bg px-4 py-2 text-sm text-ink placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent";

  const btnCls =
    variant === "header"
      ? "shrink-0 rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
      : "shrink-0 rounded-xl bg-ink px-5 py-2 text-sm font-semibold text-white hover:opacity-90";

  return (
    <form
      onSubmit={handleSubmit}
      className={
        variant === "header"
          ? "flex w-full min-w-0 items-center gap-1.5 sm:gap-2"
          : "flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:items-center"
      }
      role="search"
      aria-label="Search products"
    >
      <input
        type="search"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search products…"
        autoComplete="off"
        className={inputCls}
        aria-label="Search products"
      />
      <div className="flex shrink-0 gap-2">
        <button type="submit" className={btnCls}>
          Search
        </button>
        {(onProducts ? urlQ : value.trim()) ? (
          <button
            type="button"
            className={
              variant === "header"
                ? "rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted hover:bg-bg"
                : "rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted hover:bg-bg"
            }
            onClick={() => {
              setValue("");
              applyQuery("");
            }}
          >
            Clear
          </button>
        ) : null}
      </div>
    </form>
  );
}
