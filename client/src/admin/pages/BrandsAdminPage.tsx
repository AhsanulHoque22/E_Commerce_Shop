import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch, apiFetchForm } from "@/services/api";

type BrandRow = {
  brandKey: string;
  productBrandLabel: string;
  productCount: number;
  displayName: string;
  logoUrl: string | null;
  logoPublicId: string | null;
  isActive: boolean;
  sortOrder: number;
};

export function AdminBrandsPage() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["admin", "brands"],
    queryFn: () => apiFetch<BrandRow[]>("/api/admin/brands"),
  });

  const [editing, setEditing] = useState<BrandRow | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPublicId, setLogoPublicId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function openEdit(row: BrandRow) {
    setEditing(row);
    setDisplayName(row.displayName);
    setIsActive(row.isActive);
    setSortOrder(row.sortOrder);
    setLogoUrl(row.logoUrl);
    setLogoPublicId(row.logoPublicId);
    setFile(null);
    setErr(null);
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      setErr(null);
      let nextUrl = logoUrl;
      let nextPid = logoPublicId;
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append(
          "metadata",
          JSON.stringify({ brandKey: editing.brandKey })
        );
        const up = await apiFetchForm<{ url: string; publicId: string }>(
          "/api/upload/brand-logo",
          fd
        );
        nextUrl = up.url;
        nextPid = up.publicId;
      }
      await apiFetch(
        "/api/admin/brands/" + encodeURIComponent(editing.brandKey),
        {
          method: "PUT",
          body: JSON.stringify({
            displayName: displayName.trim() || editing.productBrandLabel,
            isActive,
            sortOrder,
            logoUrl: nextUrl,
            logoPublicId: nextPid,
          }),
        }
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "brands"] });
      void qc.invalidateQueries({ queryKey: ["products", "brands", "showcase"] });
      setEditing(null);
      setFile(null);
    },
    onError: (e: Error) => setErr(e.message),
  });

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Brands</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Brands listed here have at least one in-stock product (not discontinued). Upload a
        logo and keep a brand <strong>continued</strong> to show it under &quot;Brand
        Options&quot; on the home page. Discontinued brands stay hidden there even with a
        logo.
      </p>

      <div className="mt-8 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border bg-bg text-xs uppercase text-subtle">
            <tr>
              <th className="px-4 py-3">Logo</th>
              <th className="px-4 py-3">Brand</th>
              <th className="px-4 py-3">In-stock SKUs</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {list.data?.map((b) => (
              <tr key={b.brandKey} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  {b.logoUrl ? (
                    <img
                      src={b.logoUrl}
                      alt=""
                      className="h-10 w-24 rounded-lg border border-border bg-white object-contain p-1"
                    />
                  ) : (
                    <span className="text-xs text-muted">No logo</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{b.displayName}</div>
                  <div className="text-xs text-muted">
                    Filter: {b.productBrandLabel}
                  </div>
                </td>
                <td className="px-4 py-3 tabular-nums">{b.productCount}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      b.isActive
                        ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900"
                        : "rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700"
                    }
                  >
                    {b.isActive ? "Continuing" : "Discontinued"}
                  </span>
                </td>
                <td className="px-4 py-3 tabular-nums">{b.sortOrder}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-bg"
                    onClick={() => openEdit(b)}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {list.data?.length === 0 && !list.isLoading ? (
        <p className="mt-6 text-sm text-muted">
          No brands with in-stock products yet. Add a brand on products first.
        </p>
      ) : null}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-card">
            <h2 className="font-display text-lg font-semibold">Edit brand</h2>
            <p className="mt-1 text-xs text-muted">{editing.brandKey}</p>

            <label className="mt-4 block text-sm">
              Display name
              <input
                className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </label>

            <label className="mt-4 block text-sm">
              Sort order (lower first on home page)
              <input
                type="number"
                min={0}
                max={9999}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
              />
            </label>

            <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Continue brand on storefront (show in Brand Options when logo is set)
            </label>

            <label className="mt-4 block text-sm">
              Logo image
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="mt-1 w-full text-xs"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {logoUrl && !file ? (
              <div className="mt-2">
                <img
                  src={logoUrl}
                  alt=""
                  className="h-16 rounded-lg border border-border object-contain"
                />
                <button
                  type="button"
                  className="mt-2 text-xs text-red-600 hover:underline"
                  onClick={() => {
                    setLogoUrl(null);
                    setLogoPublicId(null);
                  }}
                >
                  Remove logo
                </button>
              </div>
            ) : null}

            {err ? <p className="mt-3 text-sm text-red-600">{err}</p> : null}

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saveMut.isPending}
                className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => void saveMut.mutateAsync()}
              >
                {saveMut.isPending ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="rounded-xl px-4 py-2 text-sm"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
