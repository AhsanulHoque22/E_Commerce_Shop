import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMemo, useState, type ReactNode } from "react";
import { apiFetch } from "@/services/api";
import { useSession } from "@/hooks/useSession";
import { useAuthUi } from "@/store/authUi";
import { ProductImageGallery } from "@/components/ProductImageGallery";

type CategoryAttrDef = {
  key: string;
  name: string;
  type: "text" | "number" | "boolean" | "select";
  required: boolean;
  options?: string[];
};

type CategoryCrumb = {
  publicId: string;
  name: string;
  slug: string;
  parent: { publicId: string; name: string; slug: string } | null;
  attributeDefinitions?: CategoryAttrDef[];
};

type Detail = {
  publicId: string;
  name: string;
  brand?: string | null;
  shortDesc?: string | null;
  description: string;
  price: string;
  comparePrice?: string | null;
  stock: number;
  inStock: boolean;
  readyToShip: boolean;
  mainImageUrl: string | null;
  galleryUrls: string[];
  specs: Record<string, unknown> | null;
  attributes: Record<string, string | number | boolean> | null;
  badges: { new: boolean; bestseller: boolean; limitedStock: boolean };
  category: CategoryCrumb;
  reviewSummary: { count: number; average: number | null };
  isFavorited?: boolean;
  canSubmitReview?: boolean;
};

type ReviewRow = {
  publicId: string;
  rating: number;
  comment: string;
  createdAt: string;
  authorName: string;
};

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-display text-xl font-semibold sm:text-2xl">
      <span className="relative inline-block">
        {children}
        <span
          className="absolute -bottom-1 left-[55%] h-1 w-[40%] rounded-full bg-amber-400"
          aria-hidden
        />
      </span>
    </h2>
  );
}

function Stars({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange?: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-1" role={onChange ? "radiogroup" : undefined}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          className={`text-xl transition ${
            onChange ? "cursor-pointer hover:scale-110" : ""
          } ${n <= value ? "text-amber-400" : "text-border"}`}
          onClick={() => onChange?.(n)}
          aria-label={`${n} stars`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

const DESC_PREVIEW = 380;

export function ProductDetailPage() {
  const { publicId } = useParams();
  const { user, loading: sessionLoading } = useSession();
  const openLogin = useAuthUi((s) => s.openLogin);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [qty, setQty] = useState(1);
  const [descOpen, setDescOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const q = useQuery({
    queryKey: ["product", publicId],
    queryFn: () => apiFetch<Detail>(`/api/products/${publicId}`),
    enabled: Boolean(publicId),
  });

  const reviewsQ = useQuery({
    queryKey: ["product", publicId, "reviews"],
    queryFn: () =>
      apiFetch<{ items: ReviewRow[] }>(`/api/products/${publicId}/reviews`),
    enabled: Boolean(publicId),
  });

  const addMut = useMutation({
    mutationFn: (quantity: number) =>
      apiFetch("/api/cart/items", {
        method: "POST",
        body: JSON.stringify({ productPublicId: publicId, quantity }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["cart"] });
    },
  });

  const favMut = useMutation({
    mutationFn: async (shouldAdd: boolean) => {
      const pid = publicId ?? "";
      if (!pid) {
        throw new Error("Missing product");
      }
      if (shouldAdd) {
        await apiFetch("/api/favorites", {
          method: "POST",
          body: JSON.stringify({ productPublicId: pid }),
        });
      } else {
        await apiFetch(
          `/api/favorites/${encodeURIComponent(pid)}`,
          { method: "DELETE" }
        );
      }
    },
    onMutate: async (shouldAdd) => {
      await qc.cancelQueries({ queryKey: ["product", publicId] });
      const prev = qc.getQueryData<Detail>(["product", publicId]);
      if (prev) {
        qc.setQueryData<Detail>(["product", publicId], {
          ...prev,
          isFavorited: shouldAdd,
        });
      }
      return { prev };
    },
    onError: (_err, _shouldAdd, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(["product", publicId], ctx.prev);
      }
    },
    onSettled: async () => {
      await qc.invalidateQueries({ queryKey: ["favorites"] });
      await qc.invalidateQueries({ queryKey: ["product", publicId] });
    },
  });

  const reviewMut = useMutation({
    mutationFn: () =>
      apiFetch(`/api/products/${publicId}/reviews`, {
        method: "POST",
        body: JSON.stringify({ rating, comment: comment.trim() }),
      }),
    onSuccess: async () => {
      setComment("");
      await qc.invalidateQueries({ queryKey: ["product", publicId] });
      await qc.invalidateQueries({ queryKey: ["product", publicId, "reviews"] });
    },
  });

  const p = q.data;

  const allImages = useMemo(() => {
    if (!p) {
      return [];
    }
    const g = Array.isArray(p.galleryUrls) ? p.galleryUrls : [];
    if (p.mainImageUrl) {
      const rest = g.filter((u) => u !== p.mainImageUrl);
      return [p.mainImageUrl, ...rest];
    }
    return g;
  }, [p]);

  const descriptionText =
    p && typeof p.description === "string" ? p.description : "";
  const descNeedToggle = descriptionText.length > DESC_PREVIEW;
  const descShown = !p
    ? ""
    : descOpen || !descNeedToggle
      ? descriptionText
      : `${descriptionText.slice(0, DESC_PREVIEW)}…`;

  const reviewSummary = p?.reviewSummary ?? {
    count: 0,
    average: null as number | null,
  };
  const badges = p?.badges ?? {
    new: false,
    bestseller: false,
    limitedStock: false,
  };
  const category = p?.category;
  const reviewItems = reviewsQ.data?.items ?? [];

  if (!publicId) {
    return null;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {q.isLoading && (
        <div className="h-[min(60vh,520px)] animate-pulse rounded-3xl bg-border" />
      )}
      {q.isError && (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-red-900">
          <p className="font-display text-lg font-semibold">Couldn’t load product</p>
          <p className="mt-2 text-sm opacity-90">
            {(q.error as Error).message ||
              "Check that the API is running and the database is up to date."}
          </p>
          <p className="mt-3 text-xs text-red-800/80">
            If you recently pulled code, run{" "}
            <code className="rounded bg-red-100 px-1">npx prisma db push</code> in
            the server folder, then restart the API.
          </p>
          <Link
            to="/products"
            className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-ink px-5 py-2 text-sm font-semibold text-white"
          >
            Back to shop
          </Link>
        </div>
      )}
      {p && (
        <>
          <nav
            className="mb-8 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted"
            aria-label="Breadcrumb"
          >
            <Link to="/" className="hover:text-ink">
              Home
            </Link>
            <span aria-hidden>/</span>
            {category ? (
              <>
                {category.parent ? (
                  <>
                    <Link
                      to={`/products?category=${encodeURIComponent(category.parent.publicId)}`}
                      className="hover:text-ink"
                    >
                      {category.parent.name}
                    </Link>
                    <span aria-hidden>/</span>
                  </>
                ) : null}
                <Link
                  to={`/products?category=${encodeURIComponent(category.publicId)}`}
                  className="hover:text-ink"
                >
                  {category.name}
                </Link>
                <span aria-hidden>/</span>
              </>
            ) : (
              <>
                <Link to="/products" className="hover:text-ink">
                  Shop
                </Link>
                <span aria-hidden>/</span>
              </>
            )}
            <span className="line-clamp-2 font-medium text-ink">{p.name}</span>
          </nav>

          <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
            <ProductImageGallery images={allImages} productName={p.name} />

            <div className="flex flex-col">
              <div className="flex flex-wrap gap-2">
                {badges.new && (
                  <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-800">
                    New
                  </span>
                )}
                {badges.bestseller && (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                    Best seller
                  </span>
                )}
                {badges.limitedStock && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                    Limited stock
                  </span>
                )}
              </div>

              <h1 className="mt-3 font-display text-2xl font-semibold leading-tight sm:text-3xl lg:text-4xl">
                {p.name}
              </h1>
              {p.brand ? (
                <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-subtle">
                  {p.brand}
                </p>
              ) : null}
              {p.shortDesc ? (
                <p className="mt-3 text-muted">{p.shortDesc}</p>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-medium ${
                    p.inStock
                      ? "bg-emerald-50 text-emerald-800"
                      : "bg-red-50 text-red-800"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-current" />
                  {p.inStock ? "In stock" : "Out of stock"}
                </span>
                {reviewSummary.count > 0 && (
                  <span className="text-sm text-muted">
                    ★ {reviewSummary.average?.toFixed(1)} · {reviewSummary.count}{" "}
                    review
                    {reviewSummary.count === 1 ? "" : "s"}
                  </span>
                )}
              </div>

              <div className="mt-6 flex flex-wrap items-baseline gap-3">
                <p className="bg-gradient-to-r from-ink to-ink/80 bg-clip-text text-4xl font-bold text-transparent sm:text-5xl">
                  BDT {p.price}
                </p>
                {p.comparePrice ? (
                  <p className="text-lg text-muted line-through">BDT {p.comparePrice}</p>
                ) : null}
              </div>

              {user?.role === "ADMIN" ? (
                <Link
                  to="/admin/products"
                  className="mt-8 inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-border bg-bg px-8 py-3 text-sm font-semibold text-ink hover:bg-surface sm:w-auto"
                >
                  Manage in Admin
                </Link>
              ) : (
                <>
                  <div className="mt-8 flex max-w-xs items-center gap-3">
                    <span className="text-sm font-medium text-muted">Qty</span>
                    <div className="flex items-center rounded-2xl border border-border bg-surface shadow-sm">
                      <button
                        type="button"
                        className="min-h-11 min-w-11 rounded-l-2xl text-lg font-medium hover:bg-bg"
                        onClick={() => setQty((n) => Math.max(1, n - 1))}
                      >
                        −
                      </button>
                      <span className="min-w-[2.5rem] text-center text-sm font-semibold tabular-nums">
                        {qty}
                      </span>
                      <button
                        type="button"
                        className="min-h-11 min-w-11 rounded-r-2xl text-lg font-medium hover:bg-bg"
                        onClick={() => setQty((n) => Math.min(99, n + 1))}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <button
                      type="button"
                      disabled={!p.inStock || addMut.isPending}
                      onClick={() => {
                        if (!user) {
                          openLogin({ productPublicId: p.publicId, quantity: qty });
                          return;
                        }
                        addMut.mutate(qty);
                      }}
                      className="min-h-12 flex-1 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 px-6 py-3 text-sm font-bold text-ink shadow-lg shadow-amber-500/25 transition hover:brightness-105 disabled:opacity-50"
                    >
                      Add to cart
                    </button>
                    <button
                      type="button"
                      disabled={!p.inStock || addMut.isPending}
                      onClick={async () => {
                        if (!user) {
                          openLogin({ productPublicId: p.publicId, quantity: qty });
                          return;
                        }
                        await addMut.mutateAsync(qty);
                        navigate("/checkout");
                      }}
                      className="min-h-12 flex-1 rounded-2xl border-2 border-amber-400 bg-surface px-6 py-3 text-sm font-bold text-ink transition hover:bg-amber-50 disabled:opacity-50"
                    >
                      Buy now
                    </button>
                  </div>

                  <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                    <button
                      type="button"
                      className={`inline-flex items-center gap-2 text-sm font-semibold transition ${
                        p.isFavorited ? "text-rose-600" : "text-muted hover:text-ink"
                      }`}
                      onClick={() => {
                        if (sessionLoading) {
                          return;
                        }
                        if (!user) {
                          openLogin();
                          return;
                        }
                        if (user.role !== "CUSTOMER") {
                          return;
                        }
                        const nextAdd = !p.isFavorited;
                        favMut.mutate(nextAdd);
                      }}
                      disabled={favMut.isPending || sessionLoading}
                    >
                      <span className="text-lg" aria-hidden>
                        {p.isFavorited ? "♥" : "♡"}
                      </span>
                      {sessionLoading
                        ? "Loading…"
                        : p.isFavorited
                          ? "Saved to favorites"
                          : "Add to favorites"}
                    </button>
                    {favMut.isError ? (
                      <p className="text-sm text-red-600" role="alert">
                        {(favMut.error as Error).message}
                      </p>
                    ) : null}
                    <Link
                      to="/cart?tab=saved"
                      className="text-sm font-medium text-accent hover:underline"
                    >
                      View saved items
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="mt-16 space-y-12">
            <section className="rounded-3xl border border-border bg-surface/80 p-6 shadow-card backdrop-blur-sm sm:p-8">
              <SectionTitle>Details</SectionTitle>
              <div className="prose prose-neutral mt-6 max-w-none">
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted sm:text-base">
                  {descShown}
                </p>
                {descNeedToggle ? (
                  <button
                    type="button"
                    className="mt-4 text-sm font-bold text-ink hover:text-accent"
                    onClick={() => setDescOpen((o) => !o)}
                  >
                    {descOpen ? "Show less" : "Read more"}
                  </button>
                ) : null}
              </div>

              {p.category.attributeDefinitions &&
                p.category.attributeDefinitions.length > 0 &&
                p.attributes &&
                Object.keys(p.attributes).length > 0 && (
                  <div className="mt-8">
                    <h3 className="font-display text-lg font-semibold">Attributes</h3>
                    <dl className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border">
                      {p.category.attributeDefinitions.map((def) => {
                        const v = p.attributes![def.key];
                        if (v === undefined || v === null) {
                          return null;
                        }
                        return (
                          <div
                            key={def.key}
                            className="grid grid-cols-1 gap-1 px-4 py-3 text-sm sm:grid-cols-3 sm:gap-4"
                          >
                            <dt className="font-medium text-muted">{def.name}</dt>
                            <dd className="sm:col-span-2 sm:font-medium">
                              {typeof v === "boolean" ? (v ? "Yes" : "No") : String(v)}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  </div>
                )}

              {p.specs &&
                typeof p.specs === "object" &&
                !Array.isArray(p.specs) &&
                Object.keys(p.specs).length > 0 && (
                <div className="mt-8">
                  <h3 className="font-display text-lg font-semibold">Specifications</h3>
                  <dl className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border">
                    {Object.entries(p.specs as Record<string, unknown>).map(([k, v]) => (
                      <div
                        key={k}
                        className="grid grid-cols-1 gap-1 px-4 py-3 text-sm sm:grid-cols-3 sm:gap-4"
                      >
                        <dt className="font-medium text-muted">{k}</dt>
                        <dd className="sm:col-span-2 sm:font-medium">
                          {Array.isArray(v) ? v.join(", ") : String(v)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-border bg-surface/80 p-6 shadow-card backdrop-blur-sm sm:p-8">
              <SectionTitle>Reviews</SectionTitle>

              {reviewItems.length === 0 ? (
                <p className="mt-6 rounded-2xl border border-dashed border-border bg-bg px-4 py-6 text-center text-sm text-muted">
                  No reviews yet. Be the first to share your experience.
                </p>
              ) : (
                <ul className="mt-6 space-y-4">
                  {reviewItems.map((r) => (
                    <li
                      key={r.publicId}
                      className="rounded-2xl border border-border bg-bg/50 px-4 py-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">{r.authorName}</span>
                        <Stars value={r.rating} />
                      </div>
                      <p className="mt-2 text-sm text-muted">{r.comment}</p>
                      <p className="mt-2 text-xs text-subtle">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              {user?.role === "CUSTOMER" && p.canSubmitReview ? (
                <div className="mt-8 rounded-2xl border border-border bg-gradient-to-br from-bg to-surface p-5">
                  <h3 className="font-display text-lg font-semibold">Write a review</h3>
                  <div className="mt-4">
                    <p className="text-sm font-medium text-muted">Rating</p>
                    <div className="mt-2">
                      <Stars value={rating} onChange={setRating} />
                    </div>
                  </div>
                  <label className="mt-4 block text-sm font-medium text-muted">
                    Comment
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={4}
                      className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                      placeholder="What did you think?"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={reviewMut.isPending || comment.trim().length < 2}
                    onClick={() => reviewMut.mutate()}
                    className="mt-4 min-h-11 rounded-xl bg-ink px-6 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Submit review
                  </button>
                  {reviewMut.isError ? (
                    <p className="mt-2 text-sm text-red-600">
                      {(reviewMut.error as Error).message}
                    </p>
                  ) : null}
                </div>
              ) : user && user.role === "CUSTOMER" && p.canSubmitReview === false ? (
                <p className="mt-6 text-sm text-muted">You already reviewed this product.</p>
              ) : !user ? (
                <p className="mt-6 text-sm text-muted">
                  <button
                    type="button"
                    className="font-semibold text-accent hover:underline"
                    onClick={() => openLogin()}
                  >
                    Log in
                  </button>{" "}
                  to write a review.
                </p>
              ) : null}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
