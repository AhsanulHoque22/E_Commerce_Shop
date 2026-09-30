import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate } from "react-router-dom";
import { useState } from "react";
import { apiFetch } from "@/services/api";
import { useSession } from "@/hooks/useSession";

type OrderRow = {
  publicId: string;
  status: string;
  total: string;
  createdAt: string;
};

type Address = {
  publicId: string;
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  area: string | null;
  postalCode: string | null;
  isDefault: boolean;
};

type AddressForm = {
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  area: string;
  postalCode: string;
};

const emptyForm: AddressForm = {
  label: "Home",
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  area: "",
  postalCode: "",
};

function AddressForm({
  initial,
  onCancel,
  onSubmit,
  pending,
  error,
}: {
  initial: AddressForm;
  onCancel: () => void;
  onSubmit: (form: AddressForm) => void;
  pending: boolean;
  error: string | null;
}) {
  const [form, setForm] = useState(initial);
  const set = (k: keyof AddressForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const inputClass =
    "mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm";

  return (
    <div className="mt-4 rounded-2xl border border-border bg-surface p-5 shadow-card">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          Label
          <input className={inputClass} value={form.label} onChange={set("label")} placeholder="Home, Office…" />
        </label>
        <label className="block text-sm">
          Full name *
          <input className={inputClass} value={form.fullName} onChange={set("fullName")} />
        </label>
        <label className="block text-sm">
          Phone *
          <input className={inputClass} value={form.phone} onChange={set("phone")} />
        </label>
        <label className="block text-sm">
          City *
          <input className={inputClass} value={form.city} onChange={set("city")} />
        </label>
        <label className="block text-sm sm:col-span-2">
          Address line 1 *
          <input className={inputClass} value={form.line1} onChange={set("line1")} />
        </label>
        <label className="block text-sm sm:col-span-2">
          Address line 2
          <input className={inputClass} value={form.line2} onChange={set("line2")} />
        </label>
        <label className="block text-sm">
          Area
          <input className={inputClass} value={form.area} onChange={set("area")} />
        </label>
        <label className="block text-sm">
          Postal code
          <input className={inputClass} value={form.postalCode} onChange={set("postalCode")} />
        </label>
      </div>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => onSubmit(form)}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save address"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-border px-4 py-2 text-sm text-muted hover:bg-bg"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function AccountPage() {
  const { user } = useSession();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<"new" | string | null>(null);

  const orders = useQuery({
    queryKey: ["orders", "mine"],
    queryFn: () => apiFetch<OrderRow[]>("/api/orders/mine"),
    enabled: Boolean(user),
  });

  const addresses = useQuery({
    queryKey: ["addresses"],
    queryFn: () => apiFetch<Address[]>("/api/addresses"),
    enabled: Boolean(user) && user?.role === "CUSTOMER",
  });

  const invalidateAddresses = () => void qc.invalidateQueries({ queryKey: ["addresses"] });

  const createMut = useMutation({
    mutationFn: (body: AddressForm) =>
      apiFetch("/api/addresses", { method: "POST", body: JSON.stringify(cleanForm(body)) }),
    onSuccess: () => {
      invalidateAddresses();
      setEditing(null);
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ publicId, body }: { publicId: string; body: AddressForm }) =>
      apiFetch(`/api/addresses/${publicId}`, {
        method: "PATCH",
        body: JSON.stringify(cleanForm(body)),
      }),
    onSuccess: () => {
      invalidateAddresses();
      setEditing(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (publicId: string) =>
      apiFetch(`/api/addresses/${publicId}`, { method: "DELETE" }),
    onSuccess: invalidateAddresses,
  });

  const defaultMut = useMutation({
    mutationFn: (publicId: string) =>
      apiFetch(`/api/addresses/${publicId}/default`, { method: "POST" }),
    onSuccess: invalidateAddresses,
  });

  if (!user) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center text-muted">
        Log in to view your account.
      </div>
    );
  }

  if (user.role === "ADMIN") {
    return <Navigate to="/admin" replace />;
  }

  const editingAddress =
    typeof editing === "string" && editing !== "new"
      ? (addresses.data?.find((a) => a.publicId === editing) ?? null)
      : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-semibold">Account</h1>
      <p className="mt-2 text-muted">{user.email}</p>
      {user.phone ? (
        <p className="mt-1 text-sm text-muted">{user.phone}</p>
      ) : null}

      <div className="mt-10 flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold">Saved addresses</h2>
        {editing === null ? (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="rounded-xl border border-accent px-4 py-2 text-sm font-semibold text-ink hover:bg-accent/10"
          >
            Add address
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {addresses.data?.map((a) => (
          <div
            key={a.publicId}
            className="rounded-2xl border border-border bg-surface p-4 shadow-card"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-subtle">
                {a.label}
              </span>
              {a.isDefault ? (
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent-400">
                  Default
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm font-medium">{a.fullName}</p>
            <p className="text-sm text-muted">{a.phone}</p>
            <p className="mt-1 text-sm text-muted">
              {a.line1}
              {a.line2 ? `, ${a.line2}` : ""}, {a.city}
              {a.area ? `, ${a.area}` : ""}
              {a.postalCode ? ` ${a.postalCode}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <button
                type="button"
                className="font-medium text-accent-400 hover:underline"
                onClick={() => setEditing(a.publicId)}
              >
                Edit
              </button>
              {!a.isDefault ? (
                <button
                  type="button"
                  disabled={defaultMut.isPending}
                  className="font-medium text-muted hover:text-ink disabled:opacity-50"
                  onClick={() => defaultMut.mutate(a.publicId)}
                >
                  Set as default
                </button>
              ) : null}
              <button
                type="button"
                disabled={deleteMut.isPending}
                className="font-medium text-muted hover:text-red-400 disabled:opacity-50"
                onClick={() => deleteMut.mutate(a.publicId)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {addresses.data && addresses.data.length === 0 && editing === null ? (
          <p className="text-sm text-muted">No saved addresses yet.</p>
        ) : null}
      </div>

      {editing === "new" ? (
        <AddressForm
          initial={emptyForm}
          pending={createMut.isPending}
          error={createMut.isError ? (createMut.error as Error).message : null}
          onCancel={() => setEditing(null)}
          onSubmit={(form) => createMut.mutate(form)}
        />
      ) : editingAddress ? (
        <AddressForm
          initial={{
            label: editingAddress.label,
            fullName: editingAddress.fullName,
            phone: editingAddress.phone,
            line1: editingAddress.line1,
            line2: editingAddress.line2 ?? "",
            city: editingAddress.city,
            area: editingAddress.area ?? "",
            postalCode: editingAddress.postalCode ?? "",
          }}
          pending={updateMut.isPending}
          error={updateMut.isError ? (updateMut.error as Error).message : null}
          onCancel={() => setEditing(null)}
          onSubmit={(form) => updateMut.mutate({ publicId: editingAddress.publicId, body: form })}
        />
      ) : null}

      <h2 className="mt-10 font-display text-xl font-semibold">Orders</h2>
      <ul className="mt-4 space-y-3">
        {orders.data?.map((o) => (
          <li key={o.publicId}>
            <Link
              className="block rounded-2xl border border-border bg-surface p-4 shadow-card"
              to={"/account/orders/" + o.publicId}
            >
              <span className="font-medium">{o.publicId}</span>
              <span className="ml-3 text-sm text-muted">{o.status}</span>
              <span className="ml-3 text-sm">BDT {o.total}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function cleanForm(form: AddressForm) {
  return {
    label: form.label.trim() || undefined,
    fullName: form.fullName.trim(),
    phone: form.phone.trim(),
    line1: form.line1.trim(),
    line2: form.line2.trim() || undefined,
    city: form.city.trim(),
    area: form.area.trim() || undefined,
    postalCode: form.postalCode.trim() || undefined,
  };
}
