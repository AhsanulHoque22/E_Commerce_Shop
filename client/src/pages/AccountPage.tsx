import { useQuery } from "@tanstack/react-query";
import { Link, Navigate } from "react-router-dom";
import { apiFetch } from "@/services/api";
import { useSession } from "@/hooks/useSession";

type OrderRow = {
  publicId: string;
  status: string;
  total: string;
  createdAt: string;
};

export function AccountPage() {
  const { user } = useSession();
  const orders = useQuery({
    queryKey: ["orders", "mine"],
    queryFn: () => apiFetch<OrderRow[]>("/api/orders/mine"),
    enabled: Boolean(user),
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-semibold">Account</h1>
      <p className="mt-2 text-muted">{user.email}</p>
      {user.phone ? (
        <p className="mt-1 text-sm text-muted">{user.phone}</p>
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
