import { useMutation, useQuery } from "@tanstack/react-query";
import { Navigate, useNavigate } from "react-router-dom";
import { apiFetch } from "@/services/api";
import { useSession } from "@/hooks/useSession";
import { useEffect, useState } from "react";

type CartLine = {
  name: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  variantOptions?: Record<string, string> | null;
};

type CouponResult = { discount: number; code: string };

export function CheckoutPage() {
  const { user } = useSession();
  const nav = useNavigate();
  const [fullName, setFullName] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [country, setCountry] = useState("Bangladesh");
  const [contactEmail, setContactEmail] = useState(user?.email ?? "");
  // `user` loads asynchronously (useSession resolves after mount), so the
  // useState initializer above can miss it — sync once it's available,
  // without clobbering anything the customer has already typed.
  useEffect(() => {
    if (user?.email && !contactEmail) {
      setContactEmail(user.email);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);
  const [paymentMethod, setPaymentMethod] = useState<
    "cod" | "sslcommerz" | "mock_card" | "mock_wallet"
  >("sslcommerz");
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<CouponResult | null>(null);

  const cart = useQuery({
    queryKey: ["cart"],
    queryFn: () => apiFetch<{ items: CartLine[]; subtotal: string }>("/api/cart"),
    enabled: Boolean(user),
  });
  const subtotal = Number(cart.data?.subtotal ?? 0);
  const total = Math.max(0, subtotal - (appliedCoupon?.discount ?? 0));

  const couponMut = useMutation({
    mutationFn: () =>
      apiFetch<CouponResult>("/api/coupons/validate", {
        method: "POST",
        body: JSON.stringify({ code: couponInput.trim(), subtotal }),
      }),
    onSuccess: (data) => setAppliedCoupon(data),
  });

  const mut = useMutation({
    mutationFn: () =>
      apiFetch<{ publicId: string }>("/api/orders/checkout", {
        method: "POST",
        body: JSON.stringify({
          shipping: { fullName, line1, city, district, country },
          contactEmail,
          paymentMethod,
          ...(appliedCoupon ? { couponCode: appliedCoupon.code } : {}),
        }),
      }),
    onSuccess: (data) => {
      nav(`/account/orders/${data.publicId}`);
    },
  });

  if (!user) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center">
        <p className="text-muted">Log in to checkout.</p>
      </div>
    );
  }

  if (user.role === "ADMIN") {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-semibold">Checkout</h1>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-card">
        <h2 className="font-display text-sm font-semibold">Order review</h2>
        {cart.isLoading ? (
          <div className="mt-3 h-16 animate-pulse rounded-xl bg-border" />
        ) : (
          <>
            <ul className="mt-3 divide-y divide-border text-sm">
              {cart.data?.items.map((line, idx) => (
                <li key={idx} className="flex justify-between gap-3 py-2">
                  <span className="text-muted">
                    {line.name}
                    {line.variantOptions
                      ? ` (${Object.values(line.variantOptions).join(", ")})`
                      : ""}{" "}
                    ×{line.quantity}
                  </span>
                  <span>BDT {line.lineTotal}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2">
              <input
                type="text"
                placeholder="Coupon code"
                className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm"
                value={couponInput}
                onChange={(e) => {
                  setCouponInput(e.target.value);
                  setAppliedCoupon(null);
                }}
              />
              <button
                type="button"
                disabled={!couponInput.trim() || couponMut.isPending}
                onClick={() => couponMut.mutate()}
                className="min-h-10 shrink-0 rounded-xl border border-accent px-4 text-sm font-semibold text-ink hover:bg-accent/10 disabled:opacity-50"
              >
                Apply
              </button>
            </div>
            {couponMut.isError ? (
              <p className="mt-2 text-sm text-red-400">
                {(couponMut.error as Error).message}
              </p>
            ) : null}
            {appliedCoupon ? (
              <p className="mt-2 text-sm text-emerald-300">
                Coupon "{appliedCoupon.code}" applied: -BDT{" "}
                {appliedCoupon.discount.toFixed(2)}
              </p>
            ) : null}
            <div className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Subtotal</span>
                <span>BDT {subtotal.toFixed(2)}</span>
              </div>
              {appliedCoupon ? (
                <div className="flex justify-between text-emerald-300">
                  <span>Discount</span>
                  <span>-BDT {appliedCoupon.discount.toFixed(2)}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-base font-semibold">
                <span>Total</span>
                <span>BDT {total.toFixed(2)}</span>
              </div>
            </div>
          </>
        )}
      </div>

      <form
        className="mt-8 space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          mut.mutate();
        }}
      >
        <div>
          <label className="block text-sm font-medium" htmlFor="fullName">
            Full name
          </label>
          <input
            id="fullName"
            required
            className="mt-1 w-full rounded-xl border border-border px-3 py-3"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="line1">
            Address line
          </label>
          <input
            id="line1"
            required
            className="mt-1 w-full rounded-xl border border-border px-3 py-3"
            value={line1}
            onChange={(e) => setLine1(e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium" htmlFor="city">
              City
            </label>
            <input
              id="city"
              required
              className="mt-1 w-full rounded-xl border border-border px-3 py-3"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="district">
              District
            </label>
            <input
              id="district"
              required
              className="mt-1 w-full rounded-xl border border-border px-3 py-3"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="country">
            Country
          </label>
          <input
            id="country"
            required
            className="mt-1 w-full rounded-xl border border-border px-3 py-3"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="cemail">
            Contact email
          </label>
          <input
            id="cemail"
            type="email"
            required
            className="mt-1 w-full rounded-xl border border-border px-3 py-3"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
          />
        </div>
        <fieldset>
          <legend className="text-sm font-medium">Payment</legend>
          <div className="mt-3 space-y-2">
            <label className="flex items-center gap-3 text-sm">
              <input
                type="radio"
                name="pm"
                checked={paymentMethod === "sslcommerz"}
                onChange={() => setPaymentMethod("sslcommerz")}
              />
              Pay online (bKash, Nagad, Rocket, card)
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="radio"
                name="pm"
                checked={paymentMethod === "cod"}
                onChange={() => setPaymentMethod("cod")}
              />
              Cash on delivery
            </label>
          </div>
          <p className="mt-2 text-xs text-subtle">
            Your order is reviewed and approved first. You'll get a "Pay online now" link
            on your order page once it's approved.
          </p>
        </fieldset>
        {mut.error && (
          <p className="text-sm text-red-400">{(mut.error as Error).message}</p>
        )}
        <button
          type="submit"
          disabled={mut.isPending}
          className="min-h-11 w-full rounded-xl bg-accent py-3 text-sm font-semibold text-white"
        >
          Pay & place order
        </button>
      </form>
    </div>
  );
}
