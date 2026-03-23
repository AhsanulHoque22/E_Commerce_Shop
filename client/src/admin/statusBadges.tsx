const orderTone: Record<string, string> = {
  PENDING_APPROVAL: "bg-amber-100 text-amber-900",
  APPROVED: "bg-sky-100 text-sky-900",
  PAYMENT_PENDING: "bg-violet-100 text-violet-900",
  PAID: "bg-emerald-100 text-emerald-900",
  SHIPPED: "bg-blue-100 text-blue-900",
  OUT_FOR_DELIVERY: "bg-indigo-100 text-indigo-900",
  DELIVERED: "bg-teal-100 text-teal-900",
  COMPLETED: "bg-zinc-200 text-zinc-900",
  CANCELLED: "bg-red-100 text-red-900",
};

const productTone: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-900",
  OUT_OF_STOCK: "bg-amber-100 text-amber-900",
  DISCONTINUED: "bg-zinc-200 text-zinc-700",
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
