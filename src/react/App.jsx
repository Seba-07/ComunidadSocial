import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useEffect } from 'react';
import AuthPage from './pages/Auth/AuthPage';
import MemberDashboardPage from './pages/MemberDashboard/MemberDashboardPage';
import OrgDashboardPage from './pages/OrganizationDashboard/OrgDashboardPage';
import ToastContainer from './components/ui/Toast';

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
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

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
