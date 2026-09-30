import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { apiFetch } from "@/services/api";
import { useSession } from "@/hooks/useSession";

type CartLine = {
  productPublicId: string;
  productVariantPublicId?: string | null;
  variantOptions?: Record<string, string> | null;
  name: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  stock: number;
  mainImageUrl: string | null;
  inactive: boolean;
};

type FavLine = {
  productPublicId: string;
  name: string;
  brand: string | null;
  price: string;
  mainImageUrl: string | null;
  inStock: boolean;
};

export function CartPage() {
  const { user } = useSession();
  const qc = useQueryClient();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get("tab") === "saved" ? "saved" : "cart";

  const cart = useQuery({
    queryKey: ["cart"],
    queryFn: () =>
      apiFetch<{ items: CartLine[]; subtotal: string }>("/api/cart"),
    enabled: Boolean(user),
  });

  const favorites = useQuery({
    queryKey: ["favorites"],
    queryFn: () => apiFetch<{ items: FavLine[] }>("/api/favorites"),
    enabled: Boolean(user?.role === "CUSTOMER"),
  });

  const updateMut = useMutation({
    mutationFn: (payload: {
      productPublicId: string;
      quantity: number;
      productVariantPublicId?: string;
    }) =>
      apiFetch("/api/cart/items", {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["cart"] });
    },
  });

  const removeMut = useMutation({
    mutationFn: ({
      productPublicId,
      productVariantPublicId,
    }: {
      productPublicId: string;
      productVariantPublicId?: string;
    }) =>
      apiFetch(
        `/api/cart/items/${productPublicId}${
          productVariantPublicId
            ? `?productVariantPublicId=${encodeURIComponent(productVariantPublicId)}`
            : ""
        }`,
        { method: "DELETE" }
      ),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["cart"] });
    },
  });

  const removeFavMut = useMutation({
    mutationFn: (productPublicId: string) =>
      apiFetch(`/api/favorites/${productPublicId}`, { method: "DELETE" }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["favorites"] });
    },
  });

  const addCartFromFav = useMutation({
    mutationFn: (productPublicId: string) =>
      apiFetch("/api/cart/items", {
        method: "POST",
        body: JSON.stringify({ productPublicId, quantity: 1 }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["cart"] });
    },
  });

  if (!user) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-semibold">Your cart</h1>
        <p className="mt-2 text-muted">Log in to view your cart.</p>
      </div>
    );
  }

  if (user.role === "ADMIN") {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-semibold">Cart & saved</h1>
      <div className="mt-6 flex gap-2 rounded-2xl border border-border bg-bg p-1 sm:inline-flex">
        <button
          type="button"
          onClick={() => setSp({})}
          className={`min-h-10 flex-1 rounded-xl px-4 text-sm font-semibold transition sm:flex-none ${
            tab === "cart" ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          Cart
          {cart.data?.items.length ? (
            <span className="ml-1.5 rounded-full bg-ink/10 px-2 py-0.5 text-xs tabular-nums">
              {cart.data.items.length}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={() => setSp({ tab: "saved" })}
          className={`min-h-10 flex-1 rounded-xl px-4 text-sm font-semibold transition sm:flex-none ${
            tab === "saved" ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          Saved
          {favorites.data?.items.length ? (
            <span className="ml-1.5 rounded-full bg-rose-400/15 px-2 py-0.5 text-xs tabular-nums text-rose-300">
              {favorites.data.items.length}
            </span>
          ) : null}
        </button>
      </div>

      {tab === "saved" ? (
        <div className="mt-8 space-y-4">
          {favorites.isLoading && (
            <div className="h-40 animate-pulse rounded-2xl bg-border" />
          )}
          {favorites.data?.items.map((line) => (
            <div
              key={line.productPublicId}
              className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card"
            >
              <Link
                to={`/products/${line.productPublicId}`}
                className="flex min-w-0 flex-1 gap-4"
              >
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-bg">
                  {line.mainImageUrl && (
                    <img
                      src={line.mainImageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-medium">{line.name}</p>
                  {line.brand ? (
                    <p className="text-xs uppercase text-subtle">{line.brand}</p>
                  ) : null}
                  <p className="mt-1 text-sm text-muted">BDT {line.price}</p>
                  {!line.inStock && (
                    <p className="mt-1 text-xs text-amber-400">Currently unavailable</p>
                  )}
                </div>
              </Link>
              <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto sm:justify-end">
                <button
                  type="button"
                  disabled={!line.inStock || addCartFromFav.isPending}
                  onClick={() => addCartFromFav.mutate(line.productPublicId)}
                  className="min-h-10 rounded-xl bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-600 disabled:opacity-50"
                >
                  Add to cart
                </button>
                <button
                  type="button"
                  onClick={() => removeFavMut.mutate(line.productPublicId)}
                  className="min-h-10 rounded-xl border border-border px-4 text-sm font-medium text-muted hover:bg-bg"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          {favorites.data && favorites.data.items.length === 0 && (
            <p className="text-muted">No saved items yet. Heart a product to see it here.</p>
          )}
        </div>
      ) : (
      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {cart.isLoading && <div className="h-40 animate-pulse rounded-2xl bg-border" />}
          {cart.data?.items.map((line) => {
            const lineKey = `${line.productPublicId}:${line.productVariantPublicId ?? ""}`;
            return (
              <div
                key={lineKey}
                className="flex gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card"
              >
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-bg">
                  {line.mainImageUrl && (
                    <img src={line.mainImageUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{line.name}</p>
                  {line.variantOptions ? (
                    <p className="text-xs text-subtle">
                      {Object.values(line.variantOptions).join(" · ")}
                    </p>
                  ) : null}
                  <p className="text-sm text-muted">BDT {line.unitPrice} each</p>
                  <div className="mt-3 flex items-center gap-3">
                    <label className="text-sm text-muted" htmlFor={`q-${lineKey}`}>
                      Qty
                    </label>
                    <input
                      id={`q-${lineKey}`}
                      type="number"
                      min={1}
                      max={99}
                      className="w-20 rounded-lg border border-border bg-surface px-2 py-2"
                      defaultValue={line.quantity}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isFinite(v)) {
                          return;
                        }
                        updateMut.mutate({
                          productPublicId: line.productPublicId,
                          quantity: v,
                          productVariantPublicId: line.productVariantPublicId ?? undefined,
                        });
                      }}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        removeMut.mutate({
                          productPublicId: line.productPublicId,
                          productVariantPublicId: line.productVariantPublicId ?? undefined,
                        })
                      }
                      className="text-sm font-medium text-muted hover:text-red-400"
                    >
                      Remove
                    </button>
                  </div>
                  {line.inactive && (
                    <p className="mt-2 text-xs text-amber-400">Product unavailable</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-semibold">BDT {line.lineTotal}</p>
                </div>
              </div>
            );
          })}
          {cart.data && cart.data.items.length === 0 && (
            <p className="text-muted">Your cart is empty.</p>
          )}
        </div>
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-card h-fit">
          <p className="text-sm text-muted">Subtotal</p>
          <p className="mt-1 text-2xl font-semibold">BDT {cart.data?.subtotal ?? "0.00"}</p>
          <Link
            to="/checkout"
            className="mt-6 flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white hover:bg-accent-600"
          >
            Checkout
          </Link>
          <p className="mt-4 text-xs text-subtle">
            You'll pay 100% now for ready-to-ship items, or a 10% advance for
            preorders — the rest on delivery or once approved.
          </p>
        </div>
      </div>
      )}
    </div>
  );
}
