import { useQuery } from "@tanstack/react-query";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import { CategoryMegaNav } from "@/components/CategoryMegaNav";
import { SiteFooter } from "@/components/SiteFooter";
import { ProductSearchForm } from "@/components/ProductSearchForm";
import { apiFetch } from "@/services/api";
import { useSession } from "@/hooks/useSession";
import { useAuthUi } from "@/store/authUi";

export function Layout() {
  const { user, logout } = useSession();
  const openLogin = useAuthUi((s) => s.openLogin);
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const favoritesQ = useQuery({
    queryKey: ["favorites"],
    queryFn: () =>
      apiFetch<{ items: { productPublicId: string }[] }>("/api/favorites"),
    enabled: Boolean(user?.role === "CUSTOMER"),
  });
  const favCount = favoritesQ.data?.items.length ?? 0;

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      navigate("/", { replace: true });
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-2 sm:px-6 lg:px-8">
          <div className="flex min-h-11 flex-nowrap items-center gap-2 sm:gap-3 lg:gap-4">
            <Link
              to="/"
              className="shrink-0 font-display text-base font-semibold tracking-tight sm:text-lg"
            >
              Aurora Gadgets
            </Link>
            <nav className="flex shrink-0 items-center gap-3 sm:gap-5 lg:gap-6">
              <Link className="whitespace-nowrap text-sm text-muted hover:text-ink" to="/products">
                Shop
              </Link>
              <Link className="whitespace-nowrap text-sm text-muted hover:text-ink" to="/support">
                Support
              </Link>
            </nav>
            <div className="min-w-0 flex-1 px-0 sm:px-1">
              <ProductSearchForm variant="header" />
            </div>
            <div className="flex shrink-0 items-center justify-end gap-2 sm:gap-3">
              {user ? (
                user.role === "ADMIN" ? (
                  <>
                    <Link
                      to="/admin"
                      className="rounded-lg px-3 py-2 text-sm font-medium text-accent hover:bg-bg"
                    >
                      Admin
                    </Link>
                    <button
                      type="button"
                      onClick={() => void handleLogout()}
                      disabled={loggingOut}
                      className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-bg disabled:opacity-50"
                    >
                      {loggingOut ? "Signing out…" : "Log out"}
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/account"
                      className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-bg"
                    >
                      Account
                    </Link>
                    <button
                      type="button"
                      onClick={() => void handleLogout()}
                      disabled={loggingOut}
                      className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-bg disabled:opacity-50"
                    >
                      {loggingOut ? "Signing out…" : "Log out"}
                    </button>
                    <Link
                      to="/cart?tab=saved"
                      className="hidden min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-bg sm:inline-flex"
                    >
                      Saved
                      {favCount > 0 ? (
                        <span className="ml-1.5 rounded-full bg-rose-500/15 px-1.5 text-xs font-semibold text-rose-700 tabular-nums">
                          {favCount}
                        </span>
                      ) : null}
                    </Link>
                    <Link
                      to="/cart"
                      className="min-h-11 inline-flex items-center rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                    >
                      Cart
                    </Link>
                  </>
                )
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => openLogin()}
                    className="min-h-11 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-bg"
                  >
                    Log in
                  </button>
                  <button
                    type="button"
                    onClick={() => openLogin()}
                    className="min-h-11 inline-flex items-center rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                  >
                    Cart
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
        <CategoryMegaNav />
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
