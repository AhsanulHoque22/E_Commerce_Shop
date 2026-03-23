import { useQuery } from "@tanstack/react-query";
import { Navigate, useParams } from "react-router-dom";
import { OrderTrackingTimeline } from "@/components/OrderTrackingTimeline";
import { apiFetch, downloadAuthenticatedFile } from "@/services/api";
import { useSession } from "@/hooks/useSession";

type TimelineStep = { status: string; reachedAt: string | null };

type OrderDetail = {
  publicId: string;
  status: string;
  total: string;
  subtotal?: string;
  shippingTotal?: string;
  currency?: string;
  advancePercent: number;
  advanceAmount: string;
  paymentMethod?: string | null;
  paymentStatus?: string;
  paymentReference?: string | null;
  contactEmail?: string;
  contactPhone?: string | null;
  createdAt?: string;
  invoiceAvailable?: boolean;
  receiptAvailable?: boolean;
  documentPaymentStatus?: string;
  invoicePublicId?: string | null;
  invoiceIssuedAt?: string | null;
  receiptPublicId?: string | null;
  receiptIssuedAt?: string | null;
  shipmentTrackingId?: string | null;
  courierName?: string | null;
  shipmentTrackingUrl?: string | null;
  fulfillmentTimeline?: TimelineStep[];
  trackingIndex?: number;
  items: { name: string; quantity: number; unitPrice: string }[];
};

function paymentMethodLabel(method: string | null | undefined): string {
  if (method === "mock_card") return "Card";
  if (method === "mock_wallet") return "Wallet";
  return method?.trim() ? method : "—";
}

function trackingHref(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const u = new URL(url.trim());
    if (u.protocol === "http:" || u.protocol === "https:") {
      return u.href;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function OrderDetailPage() {
  const { publicId } = useParams();
  const { user } = useSession();
  const q = useQuery({
    queryKey: ["order", publicId],
    queryFn: async () => {
      const id = publicId ?? "";
      return apiFetch<OrderDetail>("/api/orders/mine/" + id);
    },
    enabled: Boolean(user) && Boolean(publicId),
  });

  if (!user) {
    return <div className="p-10 text-center text-muted">Log in required.</div>;
  }

  if (user.role === "ADMIN") {
    return <Navigate to="/admin/orders" replace />;
  }

  const o = q.data;
  const id = publicId ?? "";
  const invoicePath = `/api/orders/mine/${encodeURIComponent(id)}/invoice`;
  const receiptPath = `/api/orders/mine/${encodeURIComponent(id)}/receipt`;
  const timeline = o?.fulfillmentTimeline ?? [];
  const trackingIndex = o?.trackingIndex ?? -1;

  const showShipment =
    o &&
    o.shipmentTrackingId &&
    ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "COMPLETED"].includes(o.status);

  const trackUrl = trackingHref(o?.shipmentTrackingUrl ?? null);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-2xl font-semibold">Order</h1>
      {o && (
        <div className="mt-6 space-y-6">
          <p className="text-sm text-muted">ID: {o.publicId}</p>
          <p className="text-sm text-muted">Status: {o.status.replace(/_/g, " ")}</p>
          {o.status === "CANCELLED" ? (
            <p className="rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-900">
              This order was cancelled. Documents below may no longer apply.
            </p>
          ) : null}
          {o.createdAt ? (
            <p className="text-sm text-muted">
              Placed: {new Date(o.createdAt).toLocaleString()}
            </p>
          ) : null}
          <p className="text-sm text-muted">
            Advance: {String(o.advancePercent)}% ({o.currency ?? "BDT"} {o.advanceAmount})
          </p>
          <p className="text-lg font-semibold">
            Total {o.currency ?? "BDT"} {o.total}
          </p>

          {timeline.length > 0 ? (
            <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <h2 className="font-display text-sm font-semibold text-ink">
                Order progress
              </h2>
              <p className="mt-1 text-xs text-muted">
                Completed steps are shown in green. The highlighted step is your current stage.
              </p>
              <div className="mt-5">
                <OrderTrackingTimeline
                  steps={timeline}
                  trackingIndex={trackingIndex}
                  orderStatus={o.status}
                />
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-border bg-bg px-4 py-3 text-sm">
            <p>
              <span className="text-muted">Payment:</span>{" "}
              <span className="font-medium">{o.documentPaymentStatus ?? "—"}</span>
              {o.paymentStatus ? (
                <span className="ml-2 text-muted">({o.paymentStatus})</span>
              ) : null}
            </p>
            {o.paymentMethod ? (
              <p className="mt-1 text-muted">
                Method selected: {paymentMethodLabel(o.paymentMethod)}
              </p>
            ) : null}
          </div>

          {showShipment ? (
            <div className="rounded-2xl border border-border bg-surface p-4">
              <h2 className="font-display text-sm font-semibold">Shipment</h2>
              <p className="mt-2 text-sm">
                <span className="text-muted">Tracking ID:</span>{" "}
                <span className="font-mono text-xs">{o.shipmentTrackingId}</span>
              </p>
              {o.courierName ? (
                <p className="mt-1 text-sm text-muted">Courier: {o.courierName}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {trackUrl ? (
                  <a
                    href={trackUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center rounded-xl bg-ink px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
                  >
                    Track shipment
                  </a>
                ) : (
                  <p className="text-xs text-muted">
                    A tracking link will appear here when the store provides one.
                  </p>
                )}
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            <h2 className="font-display text-sm font-semibold">Documents</h2>
            {o.invoiceAvailable ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
                <p className="text-sm font-medium text-amber-950">Invoice</p>
                {o.invoicePublicId ? (
                  <p className="mt-1 font-mono text-xs text-muted">{o.invoicePublicId}</p>
                ) : null}
                {o.invoiceIssuedAt ? (
                  <p className="text-xs text-muted">
                    Issued {new Date(o.invoiceIssuedAt).toLocaleString()}
                  </p>
                ) : null}
                <p className="mt-2 text-sm text-amber-900/90">
                  {o.documentPaymentStatus === "INCOMPLETE"
                    ? "Payment is still pending for this order. This invoice is not proof of payment."
                    : "Payment is complete — use the payment receipt as proof of payment."}
                </p>
                <button
                  type="button"
                  className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-ink px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
                  onClick={() =>
                    void downloadAuthenticatedFile(
                      invoicePath,
                      `invoice-${o.publicId.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`
                    )
                  }
                >
                  Download invoice (PDF)
                </button>
              </div>
            ) : o.status !== "CANCELLED" ? (
              <p className="rounded-2xl border border-border bg-bg px-4 py-3 text-sm text-muted">
                Your invoice will be available after the store approves this order.
              </p>
            ) : null}

            {o.receiptAvailable ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
                <p className="text-sm font-medium text-emerald-950">Payment receipt</p>
                {o.receiptPublicId ? (
                  <p className="mt-1 font-mono text-xs text-muted">{o.receiptPublicId}</p>
                ) : null}
                {o.receiptIssuedAt ? (
                  <p className="text-xs text-muted">
                    Issued {new Date(o.receiptIssuedAt).toLocaleString()}
                  </p>
                ) : null}
                <p className="mt-2 text-sm text-emerald-900/90">
                  Payment successful — keep this receipt for your records.
                </p>
                <button
                  type="button"
                  className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-emerald-800 px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
                  onClick={() =>
                    void downloadAuthenticatedFile(
                      receiptPath,
                      `receipt-${o.publicId.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`
                    )
                  }
                >
                  Download receipt (PDF)
                </button>
              </div>
            ) : o.invoiceAvailable && o.documentPaymentStatus === "INCOMPLETE" ? (
              <p className="rounded-2xl border border-border bg-bg px-4 py-3 text-sm text-muted">
                Your payment receipt will be available after payment is marked complete.
              </p>
            ) : null}
          </div>

          <ul className="divide-y divide-border rounded-2xl border border-border">
            {o.items.map((i, idx) => (
              <li key={`${idx}-${i.name}`} className="flex justify-between px-4 py-3 text-sm">
                <span>
                  {i.name} ×{String(i.quantity)}
                </span>
                <span>
                  {o.currency ?? "BDT"} {i.unitPrice}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
