import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import { AboutPage, ContactPage, PrivacyPage, ServicesPage, TermsPage } from './pages/StaticPages';
import RegisterPage from './pages/RegisterPage';
import OtpVerifyPage from './pages/OtpVerifyPage';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import DashboardPage from './pages/DashboardPage';
import TenantProfilePage from './pages/TenantProfilePage';
import LandlordProfilePage from './pages/LandlordProfilePage';
import DocumentsPage from './pages/DocumentsPage';
import LandlordPropertiesPage from './pages/LandlordPropertiesPage';
import PropertySearchPage from './pages/PropertySearchPage';
import PropertyDetailPage from './pages/PropertyDetailPage';
import MyApplicationsPage from './pages/MyApplicationsPage';
import ReceivedApplicationsPage from './pages/ReceivedApplicationsPage';
import VerificationRequestsPage from './pages/VerificationRequestsPage';
import VerificationAccessPage from './pages/VerificationAccessPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminTrustScorePage from './pages/AdminTrustScorePage';
import AgreementPage from './pages/AgreementPage';
import RentalHistoryPage from './pages/RentalHistoryPage';
import AppShell from './components/AppShell';
import { useAuthStore } from './store/authStore';
import type { ReactNode } from 'react';

// Gate for authenticated routes. Layout (header/footer) is provided one
// level up, so this only handles the redirect.
function RequireAuth() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}

// Restricts an already-protected route to a single role. The check is
// synchronous against the in-memory store, so wrong-role users are
// redirected before the children ever mount.
function RequireRole({ role, children }: { role: 'tenant' | 'landlord' | 'admin'; children: ReactNode }) {
  const userRole = useAuthStore((s) => s.user?.role);
  if (userRole !== role) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

// /profile renders the form matching the logged-in user's role.
function ProfileByRole() {
  const role = useAuthStore((s) => s.user?.role);
  if (role === 'tenant') return <TenantProfilePage />;
  if (role === 'landlord') return <LandlordProfilePage />;
  return (
    <main className="flex items-center justify-center py-24">
      <p className="text-ink-muted">Profiles are not available for your account type.</p>
    </main>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* one site-wide shell: Header + content + Footer on every route */}
        <Route element={<AppShell />}>
          {/* public */}
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-otp" element={<OtpVerifyPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/properties" element={<PropertySearchPage />} />
          <Route path="/properties/:id" element={<PropertyDetailPage />} />
          {/* public by design: access controlled entirely by the token */}
          <Route path="/verify/:token" element={<VerificationAccessPage />} />

          {/* authenticated */}
          <Route element={<RequireAuth />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/profile" element={<ProfileByRole />} />
            <Route path="/documents" element={<RequireRole role="tenant"><DocumentsPage /></RequireRole>} />
            <Route path="/my-properties" element={<RequireRole role="landlord"><LandlordPropertiesPage /></RequireRole>} />
            <Route path="/my-applications" element={<RequireRole role="tenant"><MyApplicationsPage /></RequireRole>} />
            <Route path="/received-applications" element={<RequireRole role="landlord"><ReceivedApplicationsPage /></RequireRole>} />
            <Route path="/verification-requests" element={<RequireRole role="tenant"><VerificationRequestsPage /></RequireRole>} />
            <Route path="/admin" element={<RequireRole role="admin"><AdminDashboardPage /></RequireRole>} />
            <Route path="/admin/trust-score" element={<RequireRole role="admin"><AdminTrustScorePage /></RequireRole>} />
            {/* party checks happen in the controller/page by identity */}
            <Route path="/agreements/:id" element={<AgreementPage />} />
            <Route path="/rental-history" element={<RentalHistoryPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
