const orderTone: Record<string, string> = {
  PENDING_APPROVAL: "bg-amber-400/10 text-amber-300",
  APPROVED: "bg-sky-400/10 text-sky-300",
  PAYMENT_PENDING: "bg-violet-400/10 text-violet-300",
  PAID: "bg-emerald-400/10 text-emerald-300",
  SHIPPED: "bg-blue-400/10 text-blue-300",
  OUT_FOR_DELIVERY: "bg-indigo-400/10 text-indigo-300",
  DELIVERED: "bg-teal-400/10 text-teal-300",
  COMPLETED: "bg-ink-700 text-ink-200",
  CANCELLED: "bg-red-400/10 text-red-300",
};

const productTone: Record<string, string> = {
  ACTIVE: "bg-emerald-400/10 text-emerald-300",
  OUT_OF_STOCK: "bg-amber-400/10 text-amber-300",
  DISCONTINUED: "bg-ink-700 text-ink-300",
};

export function OrderStatusBadge({ status }: { status: string }) {
  const cls = orderTone[status] ?? "bg-bg text-muted";
  return (
    <span className={"inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium " + cls}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function ProductStatusBadge({ status }: { status: string }) {
  const cls = productTone[status] ?? "bg-bg text-muted";
  return (
    <span className={"inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium " + cls}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
