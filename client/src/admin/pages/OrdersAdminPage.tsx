import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiFetch } from "@/services/api";
import { OrderStatusBadge } from "@/admin/statusBadges";

type OrderRow = {
  publicId: string;
  status: string;
  total: string;
  paymentStatus: string;
  paymentReference: string | null;
  shipmentTrackingId: string | null;
  courierName: string | null;
  userEmail: string;
  createdAt: string;
  itemCount: number;
};

type ListRes = {
  items: OrderRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type OrderDetail = {
  publicId: string;
  status: string;
  subtotal: string;
  shippingTotal: string;
  total: string;
  advancePercent: number;
  advanceAmount: string;
  paymentMethod: string | null;
  paymentStatus: string;
  paymentReference: string | null;
  shipmentTrackingId: string | null;
  courierName: string | null;
  shipmentTrackingUrl: string | null;
  shippingAddress: unknown;
  contactEmail: string;
  contactPhone: string | null;
  notes: string | null;
  createdAt: string;
  user: { email: string; publicId: string; firstName: string | null; lastName: string | null };
  items: { name: string; quantity: number; unitPrice: string }[];
  allowedNext: string[];
};

const ALL = [
  "",
  "PENDING_APPROVAL",
  "APPROVED",
  "PAYMENT_PENDING",
  "PAID",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
] as const;

export function AdminOrdersPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["admin", "orders", page, status, search],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: String(page), limit: "15" });
      if (status) qs.set("status", status);
      if (search.trim()) qs.set("search", search.trim());
      return apiFetch<ListRes>("/api/admin/orders?" + qs.toString());
    },
  });

  const detail = useQuery({
    queryKey: ["admin", "order", selected],
    queryFn: () => apiFetch<OrderDetail>("/api/admin/orders/" + selected),
    enabled: Boolean(selected),
  });

  const statusMut = useMutation({
    mutationFn: (body: {
      status: string;
      shipmentTrackingId?: string;
      courierName?: string;
      shipmentTrackingUrl?: string;
      paymentReference?: string;
      paymentStatus?: string;
    }) =>
      apiFetch<OrderDetail>("/api/admin/orders/" + selected + "/status", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      void qc.invalidateQueries({ queryKey: ["admin", "order", selected] });
      void qc.invalidateQueries({ queryKey: ["admin", "overview"] });
    },
  });

  const [nextStatus, setNextStatus] = useState("");
  const [tracking, setTracking] = useState("");
  const [courier, setCourier] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [payRef, setPayRef] = useState("");
  const [payStat, setPayStat] = useState("");

  useEffect(() => {
    if (!detail.data) return;
    setTracking(detail.data.shipmentTrackingId ?? "");
    setCourier(detail.data.courierName ?? "");
    setTrackingUrl(detail.data.shipmentTrackingUrl ?? "");
    setPayRef(detail.data.paymentReference ?? "");
    setPayStat(detail.data.paymentStatus);
  }, [detail.data]);

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Orders</h1>
      <div className="mt-6 flex flex-wrap gap-3">
        <input
          className="min-w-[200px] flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm"
          placeholder="Order ID or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="rounded-xl border border-border bg-surface px-3 py-2 text-sm"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          {ALL.map((s) => (
            <option key={s || "all"} value={s}>
              {s ? s.replace(/_/g, " ") : "All statuses"}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="rounded-xl border border-border px-4 py-2 text-sm"
          onClick={() => void list.refetch()}
        >
          Search
        </button>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-border bg-bg text-xs uppercase text-subtle">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Items</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.items.map((o) => (
              <tr
                key={o.publicId}
                className={
                  "cursor-pointer border-b border-border last:border-0 hover:bg-bg " +
                  (selected === o.publicId ? "bg-bg" : "")
                }
                onClick={() => {
                  setSelected(o.publicId);
                  setNextStatus("");
                  setTracking(o.shipmentTrackingId ?? "");
                  setCourier(o.courierName ?? "");
                  setPayRef(o.paymentReference ?? "");
                  setPayStat(o.paymentStatus);
                }}
              >
                <td className="px-4 py-3 font-mono text-xs">{o.publicId}</td>
                <td className="px-4 py-3 text-muted">{o.userEmail}</td>
                <td className="px-4 py-3">
                  <OrderStatusBadge status={o.status} />
                </td>
                <td className="px-4 py-3 text-xs text-muted">{o.paymentStatus}</td>
                <td className="px-4 py-3 font-medium">BDT {o.total}</td>
                <td className="px-4 py-3">{o.itemCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {list.data && list.data.totalPages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            className="rounded-lg border border-border px-3 py-1 text-sm disabled:opacity-40"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <span className="text-sm text-muted">
            {page} / {list.data.totalPages}
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

      {selected && detail.data && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="my-8 w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-card">
            <h2 className="font-display text-lg font-semibold">Order detail</h2>
            <p className="mt-1 font-mono text-xs text-muted">{detail.data.publicId}</p>
            <div className="mt-4 space-y-2 text-sm">
              <p>
                <span className="text-muted">Customer:</span> {detail.data.user.email}
              </p>
              <p>
                <span className="text-muted">Total:</span> BDT {detail.data.total}
              </p>
              <p>
                <span className="text-muted">Payment:</span> {detail.data.paymentStatus}
                {detail.data.paymentReference && (
                  <span className="ml-2 font-mono text-xs">{detail.data.paymentReference}</span>
                )}
              </p>
              {detail.data.shipmentTrackingId && (
                <p>
                  <span className="text-muted">Tracking:</span>{" "}
                  {detail.data.shipmentTrackingId}
                </p>
              )}
              {detail.data.courierName ? (
                <p>
                  <span className="text-muted">Courier:</span> {detail.data.courierName}
                </p>
              ) : null}
              {detail.data.shipmentTrackingUrl ? (
                <p className="break-all text-xs">
                  <span className="text-muted">Tracking URL:</span>{" "}
                  {detail.data.shipmentTrackingUrl}
                </p>
              ) : null}
              <ul className="mt-2 rounded-xl border border-border bg-bg p-3 text-xs">
                {detail.data.items.map((i, idx) => (
                  <li key={idx}>
                    {i.name} x {i.quantity} @ {i.unitPrice}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6 border-t border-border pt-4">
              <h3 className="text-sm font-semibold">Update status</h3>
              <p className="mt-1 text-xs text-muted">
                Ship only after payment. Tracking ID required for SHIPPED; add courier and tracking
                link for customers.
              </p>
              <label className="mt-3 block text-sm">
                Next status
                <select
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                  value={nextStatus}
                  onChange={(e) => setNextStatus(e.target.value)}
                >
                  <option value="">Select</option>
                  {detail.data.allowedNext.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </label>
              {nextStatus === "SHIPPED" && (
                <>
                  <label className="mt-3 block text-sm">
                    Shipment tracking ID
                    <input
                      className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-xs"
                      value={tracking}
                      onChange={(e) => setTracking(e.target.value)}
                    />
                  </label>
                  <label className="mt-3 block text-sm">
                    Courier name (optional)
                    <input
                      className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-xs"
                      value={courier}
                      onChange={(e) => setCourier(e.target.value)}
                      placeholder="e.g. Pathao, Steadfast"
                    />
                  </label>
                  <label className="mt-3 block text-sm">
                    Tracking page URL (optional)
                    <input
                      className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-xs"
                      value={trackingUrl}
                      onChange={(e) => setTrackingUrl(e.target.value)}
                      placeholder="https://..."
                    />
                  </label>
                </>
              )}
              <label className="mt-3 block text-sm">
                Payment reference (optional)
                <input
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-xs"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                />
              </label>
              <label className="mt-3 block text-sm">
                Payment status label (optional)
                <input
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-xs"
                  value={payStat}
                  onChange={(e) => setPayStat(e.target.value)}
                />
              </label>
              {statusMut.isError && (
                <p className="mt-2 text-sm text-red-600">
                  {statusMut.error instanceof Error
                    ? statusMut.error.message
                    : "Update failed"}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  disabled={!nextStatus || statusMut.isPending}
                  onClick={() => {
                    if (!nextStatus) return;
                    statusMut.mutate({
                      status: nextStatus,
                      shipmentTrackingId: tracking.trim() || undefined,
                      courierName: courier.trim() || undefined,
                      shipmentTrackingUrl: trackingUrl.trim() || undefined,
                      paymentReference: payRef.trim() || undefined,
                      paymentStatus: payStat.trim() || undefined,
                    });
                  }}
                >
                  Apply transition
                </button>
                <button
                  type="button"
                  className="rounded-lg px-3 py-2 text-sm"
                  onClick={() => setSelected(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
