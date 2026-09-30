import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiFetch } from "@/services/api";

type Coupon = {
  publicId: string;
  code: string;
  description: string | null;
  discountType: "percent" | "fixed";
  discountValue: string;
  minSubtotal: string | null;
  maxDiscount: string | null;
  usageLimit: number | null;
  usageCount: number;
  perUserLimit: number | null;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

function toDateInput(v: string | null): string {
  return v ? v.slice(0, 10) : "";
}

export function AdminCouponsPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<Coupon | null>(null);

  const list = useQuery({
    queryKey: ["admin", "coupons"],
    queryFn: () => apiFetch<Coupon[]>("/api/admin/coupons"),
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["admin", "coupons"] });

  const toggleMut = useMutation({
    mutationFn: (publicId: string) =>
      apiFetch<Coupon>("/api/admin/coupons/" + publicId + "/toggle-active", { method: "POST" }),
    onSuccess: invalidate,
  });

  const deleteMut = useMutation({
    mutationFn: (publicId: string) =>
      apiFetch<{ deleted: boolean }>("/api/admin/coupons/" + publicId, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-3xl font-semibold">Coupons</h1>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setModal("create");
          }}
          className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white"
        >
          New coupon
        </button>
      </div>

      {deleteMut.isError && (
        <p className="mt-4 text-sm text-red-600">
          {deleteMut.error instanceof Error ? deleteMut.error.message : "Delete failed"}
        </p>
      )}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-border bg-bg text-xs uppercase text-subtle">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Discount</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3">Usage</th>
              <th className="px-4 py-3">Window</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.map((c) => (
              <tr key={c.publicId} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <span className="font-mono font-medium">{c.code}</span>
                  {c.description && <p className="mt-0.5 text-xs text-muted">{c.description}</p>}
                </td>
                <td className="px-4 py-3">
                  {c.discountType === "percent" ? `${c.discountValue}%` : `BDT ${c.discountValue}`}
                  {c.maxDiscount && <span className="ml-1 text-xs text-muted">(max {c.maxDiscount})</span>}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    disabled={toggleMut.isPending}
                    onClick={() => toggleMut.mutate(c.publicId)}
                    className={
                      "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium disabled:opacity-50 " +
                      (c.isActive ? "bg-emerald-400/10 text-emerald-300" : "bg-bg text-muted")
                    }
                  >
                    {c.isActive ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="px-4 py-3 text-muted">
                  {c.usageCount}
                  {c.usageLimit != null ? ` / ${c.usageLimit}` : ""}
                  {c.perUserLimit != null && (
                    <span className="ml-1 text-xs">(max {c.perUserLimit}/user)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted">
                  {toDateInput(c.startsAt) || "—"} → {toDateInput(c.endsAt) || "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    className="mr-2 text-accent hover:underline"
                    onClick={() => {
                      setEditing(c);
                      setModal("edit");
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="text-red-600 hover:underline"
                    onClick={() => {
                      if (window.confirm(`Delete coupon ${c.code}?`)) {
                        deleteMut.mutate(c.publicId);
                      }
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {list.data?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
                  No coupons yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <CouponFormModal
          key={editing?.publicId ?? "new"}
          mode={modal}
          coupon={editing}
          onClose={() => setModal(null)}
          onSaved={() => {
            invalidate();
            setModal(null);
          }}
        />
      )}
    </div>
  );
}

function CouponFormModal(props: {
  mode: "create" | "edit";
  coupon: Coupon | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const c = props.coupon;
  const [code, setCode] = useState(c?.code ?? "");
  const [description, setDescription] = useState(c?.description ?? "");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">(c?.discountType ?? "percent");
  const [discountValue, setDiscountValue] = useState(c?.discountValue ?? "");
  const [minSubtotal, setMinSubtotal] = useState(c?.minSubtotal ?? "");
  const [maxDiscount, setMaxDiscount] = useState(c?.maxDiscount ?? "");
  const [usageLimit, setUsageLimit] = useState(c?.usageLimit != null ? String(c.usageLimit) : "");
  const [perUserLimit, setPerUserLimit] = useState(c?.perUserLimit != null ? String(c.perUserLimit) : "");
  const [isActive, setIsActive] = useState(c?.isActive ?? true);
  const [startsAt, setStartsAt] = useState(toDateInput(c?.startsAt ?? null));
  const [endsAt, setEndsAt] = useState(toDateInput(c?.endsAt ?? null));
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    // Re-sync when switching which row is being edited (key already forces
    // remount on change, this just covers the initial mount).
  }, []);

  const inputClass = "mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm";

  const submit = async () => {
    setErr(null);
    const dv = parseFloat(discountValue);
    if (!code.trim() || Number.isNaN(dv) || dv <= 0) {
      setErr("Check code and discount value");
      return;
    }
    const body = {
      code: code.trim(),
      description: description.trim() || undefined,
      discountType,
      discountValue: dv,
      minSubtotal: minSubtotal ? parseFloat(minSubtotal) : undefined,
      maxDiscount: maxDiscount ? parseFloat(maxDiscount) : undefined,
      usageLimit: usageLimit ? parseInt(usageLimit, 10) : undefined,
      perUserLimit: perUserLimit ? parseInt(perUserLimit, 10) : undefined,
      isActive,
      startsAt: startsAt || undefined,
      endsAt: endsAt || undefined,
    };
    setPending(true);
    try {
      if (props.mode === "create") {
        await apiFetch("/api/admin/coupons", { method: "POST", body: JSON.stringify(body) });
      } else if (c) {
        await apiFetch("/api/admin/coupons/" + c.publicId, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      }
      props.onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="my-8 w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-card">
        <h2 className="font-display text-lg font-semibold">
          {props.mode === "create" ? "New coupon" : "Edit coupon"}
        </h2>

        <div className="mt-4 space-y-3 text-sm">
          <label className="block">
            Code *
            <input className={`${inputClass} font-mono`} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          </label>
          <label className="block">
            Description
            <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <div>
            <span className="block">Discount type</span>
            <div className="mt-1 flex gap-4">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="discountType"
                  checked={discountType === "percent"}
                  onChange={() => setDiscountType("percent")}
                />
                Percent
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="discountType"
                  checked={discountType === "fixed"}
                  onChange={() => setDiscountType("fixed")}
                />
                Fixed amount
              </label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              {discountType === "percent" ? "Percent off *" : "Amount off *"}
              <input className={inputClass} value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} inputMode="decimal" />
            </label>
            <label className="block">
              Max discount
              <input className={inputClass} value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} inputMode="decimal" placeholder="optional" />
            </label>
            <label className="block">
              Min subtotal
              <input className={inputClass} value={minSubtotal} onChange={(e) => setMinSubtotal(e.target.value)} inputMode="decimal" placeholder="optional" />
            </label>
            <label className="block">
              Usage limit (total)
              <input className={inputClass} value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} inputMode="numeric" placeholder="optional" />
            </label>
            <label className="block">
              Per-user limit
              <input className={inputClass} value={perUserLimit} onChange={(e) => setPerUserLimit(e.target.value)} inputMode="numeric" placeholder="optional" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              Starts
              <input type="date" className={inputClass} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </label>
            <label className="block">
              Ends
              <input type="date" className={inputClass} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </label>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active
          </label>
        </div>

        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="rounded-lg px-3 py-2 text-sm" onClick={props.onClose}>
            Cancel
          </button>
          <button
            type="button"
            disabled={pending}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            onClick={() => void submit()}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
