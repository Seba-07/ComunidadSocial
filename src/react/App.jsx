import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useState, useEffect, lazy, Suspense } from 'react';
import AuthPage from './pages/Auth/AuthPage';
import MemberDashboardPage from './pages/MemberDashboard/MemberDashboardPage';
import OrgDashboardPage from './pages/OrganizationDashboard/OrgDashboardPage';
import ToastContainer from './components/ui/Toast';
import LoadingSpinner from './components/ui/LoadingSpinner';

// Lazy-loaded pages for code splitting
const AdminDashboardPage = lazy(() => import('./pages/Admin/AdminDashboardPage'));
const WizardPage = lazy(() => import('./pages/Wizard/WizardPage'));
const MinistroDashboardPage = lazy(() => import('./pages/Ministro/MinistroDashboardPage'));
const PrivacyPage = lazy(() => import('./pages/Legal/PrivacyPage'));
const TermsPage = lazy(() => import('./pages/Legal/TermsPage'));
const VerifyEmailPage = lazy(() => import('./pages/Auth/VerifyEmailPage'));

function ProtectedRoute({ children, allowedRoles }) {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function SuspenseWrapper({ children }) {
  return (
    <Suspense fallback={<LoadingSpinner text="Cargando..." />}>
      {children}
    </Suspense>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
    setReady(true);
  }, [hydrate]);

  if (!ready) {
    return <LoadingSpinner text="Cargando..." />;
  }

  return (
    <>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/privacy" element={<SuspenseWrapper><PrivacyPage /></SuspenseWrapper>} />
        <Route path="/terms" element={<SuspenseWrapper><TermsPage /></SuspenseWrapper>} />
        <Route path="/verify-email" element={<SuspenseWrapper><VerifyEmailPage /></SuspenseWrapper>} />
        <Route
          path="/member"
          element={
            <ProtectedRoute allowedRoles={['MIEMBRO']}>
              <MemberDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/org/:id/*"
          element={
            <ProtectedRoute>
              <OrgDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute allowedRoles={['MUNICIPALIDAD']}>
              <SuspenseWrapper>
                <AdminDashboardPage />
              </SuspenseWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="/wizard"
          element={
            <ProtectedRoute allowedRoles={['ORGANIZADOR']}>
              <SuspenseWrapper>
                <WizardPage />
              </SuspenseWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="/wizard/:orgId"
          element={
            <ProtectedRoute allowedRoles={['ORGANIZADOR']}>
              <SuspenseWrapper>
                <WizardPage />
              </SuspenseWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="/ministro"
          element={
            <ProtectedRoute allowedRoles={['MINISTRO_FE']}>
              <SuspenseWrapper>
                <MinistroDashboardPage />
              </SuspenseWrapper>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      <ToastContainer />
    </>
  );
}
