import { useState } from "react";
import { NavLink, Navigate, Outlet, useNavigate } from "react-router-dom";
import { useSession } from "@/hooks/useSession";

const linkClass =
  "block rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-bg hover:text-ink";
const activeClass = "bg-bg text-ink font-semibold";

export function AdminLayout() {
  const { user, loading, logout } = useSession();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      navigate("/", { replace: true });
    } catch {
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center text-muted">
        Loading…
      </div>
    );
  }
  if (!user || user.role !== "ADMIN") {
    return <Navigate to="/" replace />;
  }

  const navCls = ({ isActive }: { isActive: boolean }) =>
    "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium " +
    (isActive ? "bg-bg text-ink" : "text-muted hover:bg-bg");

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <nav className="-mx-1 mb-6 flex gap-1 overflow-x-auto pb-1 lg:hidden">
        <NavLink to="/admin" end className={navCls}>
          Dashboard
        </NavLink>
        <NavLink to="/admin/products" className={navCls}>
          Products
        </NavLink>
        <NavLink to="/admin/orders" className={navCls}>
          Orders
        </NavLink>
        <NavLink to="/admin/categories" className={navCls}>
          Categories
        </NavLink>
        <NavLink to="/admin/ads" className={navCls}>
          Banners
        </NavLink>
        <NavLink to="/admin/brands" className={navCls}>
          Brands
        </NavLink>
        <button
          type="button"
          onClick={() => void handleLogout()}
          disabled={loggingOut}
          className={
            "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-bg disabled:opacity-50"
          }
        >
          {loggingOut ? "…" : "Log out"}
        </button>
      </nav>
      <div className="flex gap-0 lg:gap-8">
      <aside className="hidden w-52 shrink-0 lg:block">
        <p className="px-3 text-xs font-semibold uppercase tracking-wide text-subtle">
          Admin
        </p>
        <nav className="mt-4 flex flex-col gap-1">
          <NavLink
            to="/admin"
            end
            className={({ isActive }) =>
              linkClass + (isActive ? " " + activeClass : "")
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/admin/products"
            className={({ isActive }) =>
              linkClass + (isActive ? " " + activeClass : "")
            }
          >
            Products
          </NavLink>
          <NavLink
            to="/admin/orders"
            className={({ isActive }) =>
              linkClass + (isActive ? " " + activeClass : "")
            }
          >
            Orders
          </NavLink>
          <NavLink
            to="/admin/categories"
            className={({ isActive }) =>
              linkClass + (isActive ? " " + activeClass : "")
            }
          >
            Categories
          </NavLink>
          <NavLink
            to="/admin/ads"
            className={({ isActive }) =>
              linkClass + (isActive ? " " + activeClass : "")
            }
          >
            Banners
          </NavLink>
          <NavLink
            to="/admin/brands"
            className={({ isActive }) =>
              linkClass + (isActive ? " " + activeClass : "")
            }
          >
            Brands
          </NavLink>
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
            className={
              "mt-4 w-full text-left " +
              linkClass +
              " text-muted hover:text-ink disabled:opacity-50"
            }
          >
            {loggingOut ? "Signing out…" : "Log out"}
          </button>
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
      </div>
    </div>
  );
}
