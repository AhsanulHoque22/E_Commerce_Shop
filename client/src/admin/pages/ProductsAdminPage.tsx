import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { apiFetch } from "@/services/api";
import { ProductStatusBadge } from "@/admin/statusBadges";

type Cat = {
  publicId: string;
  name: string;
  children?: Cat[];
};

type ProductRow = {
  publicId: string;
  sku: string;
  name: string;
  price: string;
  stock: number;
  status: string;
  lowStock: boolean;
  category: { publicId: string; name: string };
};

type ListRes = {
  items: ProductRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  lowStockThreshold: number;
};

const STATUSES = ["", "ACTIVE", "OUT_OF_STOCK", "DISCONTINUED"] as const;

export function AdminProductsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [stock, setStock] = useState<"any" | "in_stock" | "out">("any");
  const [modal, setModal] = useState<"create" | "edit" | "stock" | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [stockDelta, setStockDelta] = useState("");

  const cats = useQuery({
    queryKey: ["categories"],
    queryFn: () => apiFetch<Cat[]>("/api/categories"),
  });

  const flatCats = useMemo(() => {
    const out: { id: string; label: string }[] = [];
    function walk(nodes: Cat[], prefix: string) {
      for (const c of nodes) {
        const label = prefix ? `${prefix} › ${c.name}` : c.name;
        out.push({ id: c.publicId, label });
        if (c.children?.length) {
          walk(c.children, label);
        }
      }
    }
    walk(cats.data ?? [], "");
    return out;
  }, [cats.data]);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(search.trim()), 350);
    return () => window.clearTimeout(id);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debounced]);

  const list = useQuery({
    queryKey: ["admin", "products", page, debounced, category, status, stock],
    queryFn: async () => {
      const qs = new URLSearchParams({
        page: String(page),
        limit: "12",
        stock,
      });
      if (debounced) qs.set("search", debounced);
      if (category) qs.set("category", category);
      if (status) qs.set("status", status);
      return apiFetch<ListRes>("/api/admin/products?" + qs.toString());
    },
  });

  const discontinue = useMutation({
    mutationFn: (publicId: string) =>
      apiFetch<{ ok: boolean }>("/api/admin/products/" + publicId, {
        method: "DELETE",
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin", "products"] }),
  });

  const stockMut = useMutation({
    mutationFn: ({ publicId, delta }: { publicId: string; delta: number }) =>
      apiFetch<unknown>("/api/admin/products/" + publicId + "/stock", {
        method: "POST",
        body: JSON.stringify({ delta }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
      setModal(null);
      setStockDelta("");
    },
  });

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Products</h1>
          {list.data && (
            <p className="mt-1 text-sm text-muted">
              Low-stock threshold: {list.data.lowStockThreshold} units
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setModal("create")}
          className="rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white"
        >
          New product
        </button>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <input
          className="min-w-[200px] flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm"
          placeholder="Search name / SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="rounded-xl border border-border bg-surface px-3 py-2 text-sm"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All categories</option>
          {flatCats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          className="rounded-xl border border-border bg-surface px-3 py-2 text-sm"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          {STATUSES.map((s) => (
            <option key={s || "all"} value={s}>
              {s ? s.replace(/_/g, " ") : "All statuses"}
            </option>
          ))}
        </select>
        <select
          className="rounded-xl border border-border bg-surface px-3 py-2 text-sm"
          value={stock}
          onChange={(e) => {
            setStock(e.target.value as typeof stock);
            setPage(1);
          }}
        >
          <option value="any">Any stock</option>
          <option value="in_stock">In stock</option>
          <option value="out">Zero stock</option>
        </select>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border bg-bg text-xs uppercase text-subtle">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.items.map((p) => (
              <tr key={p.publicId} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <span className="font-medium">{p.name}</span>
                  {p.lowStock && p.status === "ACTIVE" && (
                    <span className="ml-2 text-xs text-amber-700">Low</span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted">{p.sku}</td>
                <td className="px-4 py-3 text-muted">{p.category.name}</td>
                <td className="px-4 py-3">{p.price}</td>
                <td className="px-4 py-3 font-medium">{p.stock}</td>
                <td className="px-4 py-3">
                  <ProductStatusBadge status={p.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    className="mr-2 text-accent hover:underline"
                    onClick={() => {
                      setEditId(p.publicId);
                      setModal("edit");
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="mr-2 text-accent hover:underline"
                    onClick={() => {
                      setEditId(p.publicId);
                      setModal("stock");
                    }}
                  >
                    Stock
                  </button>
                  {p.status !== "DISCONTINUED" && (
                    <button
                      type="button"
                      className="text-red-600 hover:underline"
                      onClick={() => {
                        if (
                          window.confirm(
                            "Mark this product as discontinued? It will be hidden from the storefront."
                          )
                        ) {
                          discontinue.mutate(p.publicId);
                        }
                      }}
                    >
                      Discontinue
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {list.data && list.data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            className="rounded-lg border border-border px-3 py-1 text-sm disabled:opacity-40"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <span className="text-sm text-muted">
            Page {page} / {list.data.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= list.data.totalPages}
            className="rounded-lg border border-border px-3 py-1 text-sm disabled:opacity-40"
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}

      {modal === "stock" && editId && (
        <StockModal
          publicId={editId}
          delta={stockDelta}
          setDelta={setStockDelta}
          loading={stockMut.isPending}
          error={stockMut.error instanceof Error ? stockMut.error.message : null}
          onClose={() => {
            setModal(null);
            setEditId(null);
          }}
          onSubmit={() => {
            const n = parseInt(stockDelta, 10);
            if (Number.isNaN(n) || n === 0) return;
            stockMut.mutate({ publicId: editId, delta: n });
          }}
        />
      )}

      {(modal === "create" || modal === "edit") && (
        <ProductFormModal
          key={(modal === "create" ? "c" : "e") + (editId ?? "")}
          mode={modal}
          publicId={editId}
          categories={flatCats}
          onClose={() => {
            setModal(null);
            setEditId(null);
          }}
          onSaved={() => {
            void qc.invalidateQueries({ queryKey: ["admin", "products"] });
            setModal(null);
            setEditId(null);
          }}
        />
      )}
    </div>
  );
}

function StockModal(props: {
  publicId: string;
  delta: string;
  setDelta: (v: string) => void;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-card">
        <h2 className="font-display text-lg font-semibold">Adjust stock</h2>
        <p className="mt-1 text-sm text-muted font-mono">{props.publicId}</p>
        <label className="mt-4 block text-sm">
          Delta (use negative to decrease)
          <input
            className="mt-1 w-full rounded-xl border border-border px-3 py-2"
            value={props.delta}
            onChange={(e) => props.setDelta(e.target.value)}
            placeholder="-5 or 10"
          />
        </label>
        {props.error && <p className="mt-2 text-sm text-red-600">{props.error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="rounded-lg px-3 py-2 text-sm" onClick={props.onClose}>
            Cancel
          </button>
          <button
            type="button"
            disabled={props.loading}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            onClick={props.onSubmit}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

type CategoryAttrDef = {
  key: string;
  name: string;
  type: "text" | "number" | "boolean" | "select";
  required: boolean;
  options?: string[];
};

type CategoryDetailRes = {
  publicId: string;
  attributeDefinitions: CategoryAttrDef[];
};

type Detail = {
  publicId: string;
  sku: string;
  name: string;
  nameBn: string | null;
  brand: string | null;
  description: string;
  shortDesc: string | null;
  price: string;
  comparePrice: string | null;
  stock: number;
  readyToShip: boolean;
  status: string;
  featured: boolean;
  category: {
    publicId: string;
    name: string;
    attributeDefinitions?: CategoryAttrDef[];
  };
  attributes: Record<string, string | number | boolean> | null;
  mainImageUrl: string | null;
  mainImagePublicId: string | null;
  galleryUrls: unknown;
};

function FormSection(props: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(props.defaultOpen ?? true);
  return (
    <div className="rounded-xl border border-border bg-bg/30">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-ink"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {props.title}
        <span className="text-muted tabular-nums">{open ? "−" : "+"}</span>
      </button>
      {open ? <div className="space-y-3 border-t border-border px-4 py-3">{props.children}</div> : null}
    </div>
  );
}

function buildAttributesPayload(
  defs: CategoryAttrDef[],
  attrValues: Record<string, string>
): Record<string, string | number | boolean> | undefined {
  if (defs.length === 0) {
    return undefined;
  }
  const o: Record<string, string | number | boolean> = {};
  for (const d of defs) {
    const raw = (attrValues[d.key] ?? "").trim();
    if (d.type === "boolean") {
      const v = attrValues[d.key];
      if (!d.required && (v === "" || v === undefined)) {
        continue;
      }
      o[d.key] = v === "true" || v === "1";
      continue;
    }
    if (raw === "" && !d.required) {
      continue;
    }
    if (d.required && raw === "") {
      throw new Error(`Required: ${d.name}`);
    }
    if (d.type === "number") {
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        throw new Error(`Invalid number for ${d.name}`);
      }
      o[d.key] = n;
      continue;
    }
    o[d.key] = raw;
  }
  return Object.keys(o).length > 0 ? o : {};
}

function ProductFormModal(props: {
  mode: "create" | "edit";
  publicId: string | null;
  categories: { id: string; label: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const detail = useQuery({
    queryKey: ["admin", "product", props.publicId],
    queryFn: () => apiFetch<Detail>("/api/admin/products/" + props.publicId),
    enabled: props.mode === "edit" && Boolean(props.publicId),
  });

  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [shortDesc, setShortDesc] = useState("");
  const [brand, setBrand] = useState("");
  const [price, setPrice] = useState("");
  const [comparePrice, setComparePrice] = useState("");
  const [stock, setStock] = useState("0");
  const [ready, setReady] = useState(true);
  const [cat, setCat] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [featured, setFeatured] = useState(false);
  const [mainUrl, setMainUrl] = useState("");
  const [mainPid, setMainPid] = useState("");
  const [attrValues, setAttrValues] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const catSchema = useQuery({
    queryKey: ["category", "public", cat],
    queryFn: () => apiFetch<CategoryDetailRes>("/api/categories/" + cat),
    enabled: Boolean(cat),
  });

  const defs = catSchema.data?.attributeDefinitions ?? [];
  const defsKey = useMemo(
    () => defs.map((d) => `${d.key}:${d.type}:${d.required}`).join("|"),
    [defs]
  );

  useEffect(() => {
    if (props.mode !== "create") {
      return;
    }
    setSku("");
    setName("");
    setDescription("");
    setShortDesc("");
    setBrand("");
    setPrice("");
    setComparePrice("");
    setStock("0");
    setReady(true);
    setCat("");
    setStatus("ACTIVE");
    setFeatured(false);
    setMainUrl("");
    setMainPid("");
    setAttrValues({});
  }, [props.mode]);

  useEffect(() => {
    if (!detail.data) {
      return;
    }
    setSku(detail.data.sku);
    setName(detail.data.name);
    setDescription(detail.data.description);
    setShortDesc(detail.data.shortDesc ?? "");
    setBrand(detail.data.brand ?? "");
    setPrice(detail.data.price);
    setComparePrice(detail.data.comparePrice ?? "");
    setStock(String(detail.data.stock));
    setReady(detail.data.readyToShip);
    setCat(detail.data.category.publicId);
    setStatus(detail.data.status);
    setFeatured(detail.data.featured);
    setMainUrl(detail.data.mainImageUrl ?? "");
    setMainPid(detail.data.mainImagePublicId ?? "");
  }, [detail.data]);

  useEffect(() => {
    if (!cat || !catSchema.isSuccess) {
      if (!cat) {
        setAttrValues({});
      }
      return;
    }
    if (defs.length === 0) {
      setAttrValues({});
      return;
    }
    const editingSameCategory =
      props.mode === "edit" &&
      detail.data &&
      detail.data.category.publicId === cat &&
      detail.data.attributes;
    if (editingSameCategory && detail.data.attributes) {
      const next: Record<string, string> = {};
      for (const d of defs) {
        const v = detail.data.attributes[d.key];
        if (v === undefined || v === null) {
          next[d.key] = "";
        } else if (typeof v === "boolean") {
          next[d.key] = v ? "true" : "false";
        } else {
          next[d.key] = String(v);
        }
      }
      setAttrValues(next);
      return;
    }
    setAttrValues(Object.fromEntries(defs.map((d) => [d.key, ""])));
  }, [cat, defsKey, catSchema.isSuccess, props.mode, detail.data?.publicId, detail.data?.category.publicId, detail.data?.attributes, defs.length]);

  const setAttr = (key: string, value: string) => {
    setAttrValues((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async () => {
    setErr(null);
    setPending(true);
    try {
      const priceN = parseFloat(price);
      const stockN = parseInt(stock, 10);
      if (!name.trim() || !description.trim() || Number.isNaN(priceN) || priceN <= 0) {
        throw new Error("Check name, description, and price");
      }
      let attributesPayload: Record<string, string | number | boolean> | undefined;
      try {
        attributesPayload = buildAttributesPayload(defs, attrValues);
      } catch (ae) {
        throw new Error(ae instanceof Error ? ae.message : "Invalid attributes");
      }
      if (props.mode === "create") {
        if (!sku.trim() || !cat) {
          throw new Error("SKU and category required");
        }
        await apiFetch("/api/admin/products", {
          method: "POST",
          body: JSON.stringify({
            sku: sku.trim(),
            name: name.trim(),
            description: description.trim(),
            shortDesc: shortDesc.trim() || undefined,
            brand: brand.trim() || undefined,
            price: priceN,
            comparePrice: comparePrice ? parseFloat(comparePrice) : undefined,
            stock: Number.isNaN(stockN) ? 0 : Math.max(0, stockN),
            readyToShip: ready,
            categoryPublicId: cat,
            status,
            featured,
            mainImageUrl: mainUrl.trim() || undefined,
            mainImagePublicId: mainPid.trim() || undefined,
            ...(attributesPayload !== undefined ? { attributes: attributesPayload } : {}),
          }),
        });
      } else if (props.publicId) {
        await apiFetch("/api/admin/products/" + props.publicId, {
          method: "PUT",
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim(),
            shortDesc: shortDesc.trim() || undefined,
            brand: brand.trim() || null,
            price: priceN,
            comparePrice: comparePrice ? parseFloat(comparePrice) : undefined,
            stock: Number.isNaN(stockN) ? 0 : Math.max(0, stockN),
            readyToShip: ready,
            categoryPublicId: cat || undefined,
            status,
            featured,
            mainImageUrl: mainUrl.trim() || null,
            mainImagePublicId: mainPid.trim() || null,
            ...(attributesPayload !== undefined ? { attributes: attributesPayload } : {}),
          }),
        });
      }
      props.onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setPending(false);
    }
  };

  const inputClass = "mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/40 sm:flex sm:items-center sm:justify-center sm:p-4">
      <div className="flex max-h-[100dvh] w-full flex-1 flex-col overflow-hidden rounded-none border-0 border-border bg-surface shadow-card sm:max-h-[min(100dvh-2rem,56rem)] sm:max-w-2xl sm:flex-none sm:rounded-2xl sm:border">
        <div className="shrink-0 border-b border-border px-5 py-4">
          <h2 className="font-display text-lg font-semibold">
            {props.mode === "create" ? "New product" : "Edit product"}
          </h2>
          {props.mode === "edit" && detail.isLoading && (
            <p className="mt-1 text-sm text-muted">Loading…</p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-4">
          <div className="space-y-4 text-sm">
            <FormSection title="Basic info" defaultOpen>
              {props.mode === "create" && (
                <label className="block">
                  SKU *
                  <input className={`${inputClass} font-mono text-xs`} value={sku} onChange={(e) => setSku(e.target.value)} />
                </label>
              )}
              <label className="block">
                Name *
                <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="block">
                Description *
                <textarea
                  className={`${inputClass} min-h-[100px]`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <label className="block">
                Short description
                <input className={inputClass} value={shortDesc} onChange={(e) => setShortDesc(e.target.value)} />
              </label>
              <label className="block">
                Brand
                <input
                  className={inputClass}
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="e.g. Aurora"
                />
              </label>
              <label className="block">
                Category *
                <select className={inputClass} value={cat} onChange={(e) => setCat(e.target.value)}>
                  <option value="">Select…</option>
                  {props.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            </FormSection>

            <FormSection title="Pricing & stock" defaultOpen>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  Price *
                  <input className={inputClass} value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />
                </label>
                <label className="block">
                  Compare price
                  <input className={inputClass} value={comparePrice} onChange={(e) => setComparePrice(e.target.value)} inputMode="decimal" />
                </label>
                <label className="block">
                  Stock
                  <input className={inputClass} value={stock} onChange={(e) => setStock(e.target.value)} inputMode="numeric" />
                </label>
                <label className="block">
                  Status
                  <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="OUT_OF_STOCK">OUT OF STOCK</option>
                    <option value="DISCONTINUED">DISCONTINUED</option>
                  </select>
                </label>
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={ready} onChange={(e) => setReady(e.target.checked)} />
                Ready to ship
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
                Featured
              </label>
            </FormSection>

            <FormSection title="Category attributes" defaultOpen={defs.length > 0}>
              {!cat ? (
                <p className="text-muted">Select a category to load attribute fields.</p>
              ) : catSchema.isLoading ? (
                <p className="text-muted">Loading category schema…</p>
              ) : catSchema.isError ? (
                <p className="text-red-600">Could not load category schema.</p>
              ) : defs.length === 0 ? (
                <p className="text-muted">This category has no custom attributes.</p>
              ) : (
                <div className="space-y-3">
                  {defs.map((d) => (
                    <div key={d.key}>
                      <label className="block text-sm font-medium text-ink">
                        {d.name}
                        {d.required ? <span className="text-red-600"> *</span> : null}
                        <span className="ml-2 font-mono text-xs font-normal text-muted">({d.key})</span>
                      </label>
                      {d.type === "text" && (
                        <input
                          className={inputClass}
                          value={attrValues[d.key] ?? ""}
                          onChange={(e) => setAttr(d.key, e.target.value)}
                        />
                      )}
                      {d.type === "number" && (
                        <input
                          className={inputClass}
                          type="text"
                          inputMode="decimal"
                          value={attrValues[d.key] ?? ""}
                          onChange={(e) => setAttr(d.key, e.target.value)}
                        />
                      )}
                      {d.type === "boolean" && (
                        <select
                          className={inputClass}
                          value={attrValues[d.key] ?? "false"}
                          onChange={(e) => setAttr(d.key, e.target.value)}
                        >
                          <option value="false">No</option>
                          <option value="true">Yes</option>
                        </select>
                      )}
                      {d.type === "select" && d.options && (
                        <select
                          className={inputClass}
                          value={attrValues[d.key] ?? ""}
                          onChange={(e) => setAttr(d.key, e.target.value)}
                        >
                          <option value="">{d.required ? "Select…" : "(optional)"}</option>
                          {d.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </FormSection>

            <FormSection title="Images" defaultOpen={false}>
              <label className="block">
                Main image URL (Cloudinary)
                <input className={`${inputClass} text-xs`} value={mainUrl} onChange={(e) => setMainUrl(e.target.value)} />
              </label>
              <label className="block">
                Main image public ID
                <input className={`${inputClass} text-xs`} value={mainPid} onChange={(e) => setMainPid(e.target.value)} />
              </label>
            </FormSection>
          </div>
        </div>

        <div className="shrink-0 border-t border-border bg-surface px-5 py-4">
          {err ? <p className="mb-3 text-sm text-red-600">{err}</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" className="rounded-lg px-3 py-2 text-sm" onClick={props.onClose}>
              Cancel
            </button>
            <button
              type="button"
              disabled={
                pending ||
                (props.mode === "edit" && detail.isLoading) ||
                (Boolean(cat) && catSchema.isLoading)
              }
              className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              onClick={() => void submit()}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
