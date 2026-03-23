import { useMutation } from "@tanstack/react-query";
import { Navigate, useNavigate } from "react-router-dom";
import { apiFetch } from "@/services/api";
import { useSession } from "@/hooks/useSession";
import { useState } from "react";

export function CheckoutPage() {
  const { user } = useSession();
  const nav = useNavigate();
  const [fullName, setFullName] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [country, setCountry] = useState("Bangladesh");
  const [contactEmail, setContactEmail] = useState(user?.email ?? "");
  const [paymentMethod, setPaymentMethod] = useState<"mock_card" | "mock_wallet">(
    "mock_card"
  );

  const mut = useMutation({
    mutationFn: () =>
      apiFetch<{ publicId: string }>("/api/orders/checkout", {
        method: "POST",
        body: JSON.stringify({
          shipping: { fullName, line1, city, district, country },
          contactEmail,
          paymentMethod,
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
          <legend className="text-sm font-medium">Payment (mock)</legend>
          <div className="mt-3 space-y-2">
            <label className="flex items-center gap-3 text-sm">
              <input
                type="radio"
                name="pm"
                checked={paymentMethod === "mock_card"}
                onChange={() => setPaymentMethod("mock_card")}
              />
              Card (mock)
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="radio"
                name="pm"
                checked={paymentMethod === "mock_wallet"}
                onChange={() => setPaymentMethod("mock_wallet")}
              />
              Mobile wallet (mock)
            </label>
          </div>
        </fieldset>
        {mut.error && (
          <p className="text-sm text-red-600">{(mut.error as Error).message}</p>
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
