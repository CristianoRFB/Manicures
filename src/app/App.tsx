import { Route, Routes } from "react-router-dom";
import { Layout } from "../components/Layout";
import { HomePage } from "../pages/HomePage";
import { TenantPublicPage } from "../pages/TenantPublicPage";
import { BookingPage } from "../pages/BookingPage";
import { TenantAdminPage } from "../pages/TenantAdminPage";
import { ProfessionalPage } from "../pages/ProfessionalPage";
import { PlatformPage } from "../pages/PlatformPage";
import { PricingPage } from "../pages/PricingPage";
import { NotFoundPage } from "../pages/NotFoundPage";

export function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/platform" element={<PlatformPage />} />
        <Route path="/app/:tenantSlug" element={<TenantAdminPage />} />
        <Route path="/professional/:tenantSlug" element={<ProfessionalPage />} />
        <Route path="/:tenantSlug/book" element={<BookingPage />} />
        <Route path="/:tenantSlug" element={<TenantPublicPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  );
}
