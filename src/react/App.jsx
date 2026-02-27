import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useState, useEffect } from 'react';
import AuthPage from './pages/Auth/AuthPage';
import MemberDashboardPage from './pages/MemberDashboard/MemberDashboardPage';
import OrgDashboardPage from './pages/OrganizationDashboard/OrgDashboardPage';
import ToastContainer from './components/ui/Toast';
import LoadingSpinner from './components/ui/LoadingSpinner';

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
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      <ToastContainer />
    </>
  );
}
