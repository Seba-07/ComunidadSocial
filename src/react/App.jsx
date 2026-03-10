import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { sessionManager } from '@shared/SessionManager.js';
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

/** Modal de advertencia de inactividad */
function SessionWarningModal({ secondsLeft, onKeepAlive }) {
  if (secondsLeft === null) return null;

  const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999
  };

  const modalStyle = {
    background: '#fff',
    borderRadius: '16px',
    padding: '32px',
    maxWidth: '420px',
    width: '90%',
    textAlign: 'center',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
  };

  const iconStyle = {
    fontSize: '48px',
    marginBottom: '16px'
  };

  const titleStyle = {
    fontSize: '20px',
    fontWeight: 700,
    color: '#1e293b',
    marginBottom: '8px'
  };

  const textStyle = {
    fontSize: '15px',
    color: '#64748b',
    marginBottom: '24px',
    lineHeight: 1.5
  };

  const countdownStyle = {
    fontSize: '36px',
    fontWeight: 700,
    color: secondsLeft <= 10 ? '#dc2626' : '#f59e0b',
    marginBottom: '24px',
    fontVariantNumeric: 'tabular-nums'
  };

  const buttonStyle = {
    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    padding: '12px 32px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%'
  };

  return (
    <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onKeepAlive(); }}>
      <div style={modalStyle}>
        <div style={iconStyle}>&#9200;</div>
        <div style={titleStyle}>Sesion por expirar</div>
        <div style={textStyle}>
          Tu sesion se cerrara por inactividad.<br />
          ¿Deseas continuar?
        </div>
        <div style={countdownStyle}>{secondsLeft}s</div>
        <button style={buttonStyle} onClick={onKeepAlive}>
          Mantener sesion activa
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [warningSeconds, setWarningSeconds] = useState(null);
  const hydrate = useAuthStore((s) => s.hydrate);
  const verifySession = useAuthStore((s) => s.verifySession);
  const logout = useAuthStore((s) => s.logout);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const navigate = useNavigate();

  // Forzar logout y redirigir a login
  const forceLogout = useCallback(async () => {
    sessionManager.stop();
    setWarningSeconds(null);
    try { await logout(); } catch { /* ignore */ }
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  // Inicialización: hydrate + verificar sesión contra servidor
  useEffect(() => {
    let cancelled = false;

    async function init() {
      hydrate();

      const userJson = localStorage.getItem('currentUser');
      const isAuth = localStorage.getItem('isAuthenticated') === 'true';

      if (userJson && isAuth) {
        // Verificar token contra el servidor
        const valid = await verifySession();
        if (!cancelled && !valid) {
          // Token inválido → redirigir a login sin error crudo
          navigate('/login', { replace: true });
        }
      }

      if (!cancelled) setReady(true);
    }

    init();
    return () => { cancelled = true; };
  }, [hydrate, verifySession, navigate]);

  // Iniciar/detener SessionManager según estado de auth
  useEffect(() => {
    if (ready && isAuthenticated) {
      sessionManager.start();
    } else {
      sessionManager.stop();
      setWarningSeconds(null);
    }
    return () => sessionManager.stop();
  }, [ready, isAuthenticated]);

  // Escuchar eventos de sesión
  useEffect(() => {
    const onWarning = (e) => {
      setWarningSeconds(e.detail.secondsLeft);
    };

    const onExpired = () => {
      setWarningSeconds(null);
      forceLogout();
    };

    const onForceLogout = () => {
      forceLogout();
    };

    window.addEventListener('session-warning', onWarning);
    window.addEventListener('session-expired-inactivity', onExpired);
    window.addEventListener('session-force-logout', onForceLogout);

    return () => {
      window.removeEventListener('session-warning', onWarning);
      window.removeEventListener('session-expired-inactivity', onExpired);
      window.removeEventListener('session-force-logout', onForceLogout);
    };
  }, [forceLogout]);

  const handleKeepAlive = () => {
    setWarningSeconds(null);
    sessionManager.keepAlive();
  };

  if (!ready) {
    return <LoadingSpinner text="Verificando sesion..." />;
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
      <SessionWarningModal secondsLeft={warningSeconds} onKeepAlive={handleKeepAlive} />
    </>
  );
}
