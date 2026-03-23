import { Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { LoginModal } from "@/components/LoginModal";
import { HomePage } from "@/pages/HomePage";
import { ProductsPage } from "@/pages/ProductsPage";
import { ProductDetailPage } from "@/pages/ProductDetailPage";
import { CartPage } from "@/pages/CartPage";
import { CheckoutPage } from "@/pages/CheckoutPage";
import { AccountPage } from "@/pages/AccountPage";
import { OrderDetailPage } from "@/pages/OrderDetailPage";
import { SupportPage } from "@/pages/SupportPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { AdminLayout } from "@/admin/AdminLayout";
import { AdminDashboardPage } from "@/admin/pages/DashboardPage";
import { AdminProductsPage } from "@/admin/pages/ProductsAdminPage";
import { AdminOrdersPage } from "@/admin/pages/OrdersAdminPage";
import { AdminCategoriesPage } from "@/admin/pages/CategoriesAdminPage";
import { AdminAdsPage } from "@/admin/pages/AdsAdminPage";
import { AdminBrandsPage } from "@/admin/pages/BrandsAdminPage";

export default function App() {
  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/:publicId" element={<ProductDetailPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/account/orders/:publicId" element={<OrderDetailPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="products" element={<AdminProductsPage />} />
            <Route path="orders" element={<AdminOrdersPage />} />
            <Route path="categories" element={<AdminCategoriesPage />} />
            <Route path="ads" element={<AdminAdsPage />} />
            <Route path="brands" element={<AdminBrandsPage />} />
          </Route>
        </Route>
      </Routes>
      <LoginModal />
    </>
  );
}
