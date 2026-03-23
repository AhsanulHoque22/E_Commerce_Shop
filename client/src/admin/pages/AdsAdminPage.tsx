import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch, apiFetchForm } from "@/services/api";

type Ad = {
  publicId: string;
  title: string;
  imageUrl: string;
  linkUrl: string | null;
  linkProductPublicId: string | null;
  linkCategoryPublicId: string | null;
  placement: string;
  sortOrder: number;
  isActive: boolean;
};

export function AdminAdsPage() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["admin", "ads"],
    queryFn: () => apiFetch<Ad[]>("/api/admin/ads"),
  });

  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkProd, setLinkProd] = useState("");
  const [linkCat, setLinkCat] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose an image file");
      const fd = new FormData();
      fd.append("file", file);
      fd.append("metadata", JSON.stringify({ placement: "home_hero" }));
      const up = await apiFetchForm<{ url: string; publicId: string }>(
        "/api/upload/ad-banner",
        fd
      );
      await apiFetch("/api/admin/ads", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim() || "Banner",
          imageUrl: up.url,
          imagePublicId: up.publicId,
          linkUrl: linkUrl.trim() || undefined,
          linkProductPublicId: linkProd.trim() || undefined,
          linkCategoryPublicId: linkCat.trim() || undefined,
          placement: "home_hero",
        }),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "ads"] });
      setCreating(false);
      setTitle("");
      setLinkUrl("");
      setLinkProd("");
      setLinkCat("");
      setFile(null);
      setErr(null);
    },
    onError: (e: Error) => setErr(e.message),
  });

  const patchMut = useMutation({
    mutationFn: (p: { publicId: string; body: Partial<Ad> }) =>
      apiFetch("/api/admin/ads/" + p.publicId, {
        method: "PATCH",
        body: JSON.stringify(p.body),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin", "ads"] }),
  });

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold">Homepage banners</h1>
        <button
          type="button"
          className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white"
          onClick={() => setCreating(true)}
        >
          New banner
        </button>
      </div>

      <div className="mt-8 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border bg-bg text-xs uppercase text-subtle">
            <tr>
              <th className="px-4 py-3">Preview</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Active</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.map((a) => (
              <tr key={a.publicId} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <img
                    src={a.imageUrl}
                    alt=""
                    className="h-14 w-28 rounded-lg object-cover"
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{a.title}</div>
                  <div className="text-xs text-muted">
                    {a.linkProductPublicId && <>Product: {a.linkProductPublicId} </>}
                    {a.linkCategoryPublicId && <>Cat: {a.linkCategoryPublicId}</>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    className="w-20 rounded border border-border px-2 py-1 text-xs"
                    defaultValue={a.sortOrder}
                    onBlur={(e) => {
                      const n = parseInt(e.target.value, 10);
                      if (!Number.isNaN(n) && n !== a.sortOrder) {
                        patchMut.mutate({
                          publicId: a.publicId,
                          body: { sortOrder: n },
                        });
                      }
                    }}
                  />
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className={
                      "rounded-full px-3 py-1 text-xs font-medium " +
                      (a.isActive ? "bg-emerald-100 text-emerald-900" : "bg-zinc-200 text-zinc-700")
                    }
                    onClick={() =>
                      patchMut.mutate({
                        publicId: a.publicId,
                        body: { isActive: !a.isActive },
                      })
                    }
                  >
                    {a.isActive ? "On" : "Off"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-card">
            <h2 className="font-display text-lg font-semibold">New banner</h2>
            <label className="mt-4 block text-sm">
              Title
              <input
                className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className="mt-3 block text-sm">
              Image file *
              <input
                type="file"
                accept="image/*"
                className="mt-1 w-full text-sm"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <label className="mt-3 block text-sm">
              External link URL (optional)
              <input
                className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-xs"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
            </label>
            <label className="mt-3 block text-sm">
              Link product public ID
              <input
                className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-mono text-xs"
                value={linkProd}
                onChange={(e) => setLinkProd(e.target.value)}
              />
            </label>
            <label className="mt-3 block text-sm">
              Link category public ID
              <input
                className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-mono text-xs"
                value={linkCat}
                onChange={(e) => setLinkCat(e.target.value)}
              />
            </label>
            {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-sm"
                onClick={() => setCreating(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={createMut.isPending}
                className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => createMut.mutate()}
              >
                Upload & create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
