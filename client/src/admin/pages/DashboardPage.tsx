import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiFetch } from "@/services/api";
import { OrderStatusBadge } from "@/admin/statusBadges";

type Overview = {
  orderCount: number;
  productCount: number;
  totalRevenue: string;
  ordersByStatus: Record<string, number>;
  lowStockThreshold: number;
  lowStock: {
    publicId: string;
    name: string;
    sku: string;
    stock: number;
    status: string;
  }[];
  recentOrders: {
    publicId: string;
    status: string;
    total: string;
    paymentStatus: string;
    userEmail: string;
    createdAt: string;
    itemCount: number;
  }[];
  topSellingProducts: {
    productPublicId: string;
    name: string;
    sku: string;
    quantitySold: number;
    mainImageUrl: string | null;
  }[];
};

export function AdminDashboardPage() {
  const q = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => apiFetch<Overview>("/api/admin/overview"),
  });

  if (q.isLoading) {
    return <p className="text-muted">Loading dashboard…</p>;
  }
  if (q.isError) {
    return (
      <p className="text-red-600">
        {q.error instanceof Error ? q.error.message : "Failed to load"}
      </p>
    );
  }

  const d = q.data!;

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Dashboard</h1>
      <p className="mt-1 text-sm text-muted">
        Revenue counts orders that reached paid fulfillment stages.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
          <p className="text-xs font-medium uppercase text-subtle">Revenue</p>
          <p className="mt-1 text-2xl font-semibold">BDT {d.totalRevenue}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
          <p className="text-xs font-medium uppercase text-subtle">Orders</p>
          <p className="mt-1 text-2xl font-semibold">{d.orderCount}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
          <p className="text-xs font-medium uppercase text-subtle">Products</p>
          <p className="mt-1 text-2xl font-semibold">{d.productCount}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
          <p className="text-xs font-medium uppercase text-subtle">Low-stock alert</p>
          <p className="mt-1 text-2xl font-semibold">≤{d.lowStockThreshold} units</p>
        </div>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="font-display text-lg font-semibold">Orders by status</h2>
          <ul className="mt-4 space-y-2">
            {Object.entries(d.ordersByStatus)
              .sort((a, b) => b[1] - a[1])
              .map(([status, count]) => (
                <li
                  key={status}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-2"
                >
                  <OrderStatusBadge status={status} />
                  <span className="text-sm font-medium">{count}</span>
                </li>
              ))}
          </ul>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold">Top sellers</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {d.topSellingProducts.length === 0 && (
              <li className="text-muted">No paid orders yet.</li>
            )}
            {d.topSellingProducts.map((p) => (
              <li
                key={p.productPublicId}
                className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-2"
              >
                <Link
                  to={"/products/" + p.productPublicId}
                  className="font-medium hover:text-accent"
                >
                  {p.name}
                </Link>
                <span className="text-muted">{p.quantitySold} sold</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-10">
        <h2 className="font-display text-lg font-semibold">Low stock</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="border-b border-border bg-bg text-xs uppercase text-subtle">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Stock</th>
              </tr>
            </thead>
            <tbody>
              {d.lowStock.map((p) => (
                <tr key={p.sku} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      className="font-medium hover:text-accent"
                      to={"/admin/products?search=" + encodeURIComponent(p.name)}
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{p.sku}</td>
                  <td className="px-4 py-3 font-medium text-amber-800">{p.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-lg font-semibold">Recent orders</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border bg-bg text-xs uppercase text-subtle">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {d.recentOrders.map((o) => (
                <tr key={o.publicId} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      to={"/admin/orders?highlight=" + o.publicId}
                      className="font-mono text-xs hover:text-accent"
                    >
                      {o.publicId}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{o.userEmail}</td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={o.status} />
                  </td>
                  <td className="px-4 py-3 text-muted">{o.paymentStatus}</td>
                  <td className="px-4 py-3 font-medium">BDT {o.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
