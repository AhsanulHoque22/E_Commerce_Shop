const LABELS: Record<string, string> = {
  PENDING_APPROVAL: "Pending approval",
  APPROVED: "Approved",
  PAYMENT_PENDING: "Payment pending",
  PAID: "Paid",
  SHIPPED: "Shipped",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
};

type Step = { status: string; reachedAt: string | null };

function stepVisual(
  index: number,
  steps: Step[],
  trackingIndex: number,
  orderStatus: string
): "done" | "current" | "upcoming" {
  if (orderStatus === "CANCELLED") {
    return steps[index]?.reachedAt ? "done" : "upcoming";
  }
  if (trackingIndex < 0) {
    return "upcoming";
  }
  if (index < trackingIndex) {
    return "done";
  }
  if (index === trackingIndex) {
    return "current";
  }
  return "upcoming";
}

/** Segment after step `index` (toward index+1) is complete. */
function segmentAfterDone(
  index: number,
  steps: Step[],
  trackingIndex: number,
  orderStatus: string
): boolean {
  if (orderStatus === "CANCELLED") {
    return Boolean(steps[index + 1]?.reachedAt);
  }
  return index < trackingIndex;
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M13.5 4.5L6.5 11.5L2.5 7.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function OrderTrackingTimeline(props: {
  steps: Step[];
  trackingIndex: number;
  orderStatus: string;
}) {
  const { steps, trackingIndex, orderStatus } = props;

  return (
    <>
      {/* Desktop: horizontal (no wrap — avoids broken connector lines mid-viewport) */}
      <div className="hidden md:block overflow-x-auto pb-2">
        <div className="flex min-w-[720px] flex-nowrap items-start justify-between gap-1">
          {steps.map((s, index) => {
            const v = stepVisual(index, steps, trackingIndex, orderStatus);
            const isLast = index === steps.length - 1;
            return (
              <div
                key={s.status}
                className="relative flex min-w-0 flex-1 flex-col items-center text-center"
              >
                {!isLast ? (
                  <div
                    className={
                      "absolute left-[calc(50%+14px)] top-[13px] z-0 h-0.5 w-[calc(100%-28px)] " +
                      (segmentAfterDone(index, steps, trackingIndex, orderStatus)
                        ? "bg-emerald-500"
                        : "bg-border")
                    }
                    aria-hidden
                  />
                ) : null}
                <div
                  className={
                    "relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold " +
                    (v === "done"
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : v === "current"
                        ? "border-ink bg-surface text-ink ring-2 ring-ink/20"
                        : "border-border bg-bg text-muted")
                  }
                >
                  {v === "done" ? <CheckIcon /> : index + 1}
                </div>
                <p
                  className={
                    "mt-2 max-w-[7.5rem] text-xs font-medium leading-tight " +
                    (v === "current" ? "text-ink" : v === "done" ? "text-emerald-800" : "text-muted")
                  }
                >
                  {LABELS[s.status] ?? s.status.replace(/_/g, " ")}
                </p>
                {s.reachedAt ? (
                  <p className="mt-0.5 max-w-[7.5rem] text-[10px] text-muted leading-tight">
                    {new Date(s.reachedAt).toLocaleString()}
                  </p>
                ) : (
                  <p className="mt-0.5 h-4" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile: vertical */}
      <div className="md:hidden">
        <ul className="relative space-y-0 border-l-2 border-border pl-6">
          {steps.map((s, index) => {
            const v = stepVisual(index, steps, trackingIndex, orderStatus);
            return (
              <li key={s.status} className="relative pb-8 last:pb-0">
                <span
                  className={
                    "absolute -left-[29px] top-0 flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold " +
                    (v === "done"
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : v === "current"
                        ? "border-ink bg-surface text-ink ring-2 ring-ink/20"
                        : "border-border bg-bg text-muted")
                  }
                >
                  {v === "done" ? <CheckIcon /> : index + 1}
                </span>
                <p
                  className={
                    "text-sm font-medium " +
                    (v === "current" ? "text-ink" : v === "done" ? "text-emerald-800" : "text-muted")
                  }
                >
                  {LABELS[s.status] ?? s.status.replace(/_/g, " ")}
                </p>
                {s.reachedAt ? (
                  <p className="mt-0.5 text-xs text-muted">
                    {new Date(s.reachedAt).toLocaleString()}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
