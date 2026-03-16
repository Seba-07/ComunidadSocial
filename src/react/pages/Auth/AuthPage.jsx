import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/layout/AuthLayout';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import ForgotPasswordModal from './ForgotPasswordModal';
import ContactSupportModal from './ContactSupportModal';
import { useAuthStore } from '../../stores/authStore';
import './auth.css';

const TABS = [
  { id: 'login', label: 'Iniciar Sesión' },
  { id: 'register', label: 'Registrarse' }
];

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState('login');
  const [forgotOpen, setForgotOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();

  // If already authenticated, redirect based on role
  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'MIEMBRO') {
        navigate('/member', { replace: true });
      } else if (user.role === 'ORGANIZADOR') {
        navigate('/org/auto', { replace: true });
      } else if (user.role === 'MUNICIPALIDAD') {
        navigate('/admin', { replace: true });
      } else if (user.role === 'MINISTRO_FE') {
        navigate('/ministro', { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate]);

  // Listen for forgot password click from LoginForm
  useEffect(() => {
    function handleForgotClick(e) {
      if (e.target.id === 'forgot-password-link') {
        e.preventDefault();
        setForgotOpen(true);
      }
    }
    document.addEventListener('click', handleForgotClick);
    return () => document.removeEventListener('click', handleForgotClick);
  }, []);

  return (
    <AuthLayout>
      <div className="auth-card">
        <h3>Bienvenido</h3>
        <p className="subtitle">Ingresa a tu cuenta o crea una nueva</p>

        <div className="auth-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`auth-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'login' && <LoginForm />}
        {activeTab === 'register' && <RegisterForm />}
      </div>

      {/* Contact support link */}
      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <button
          onClick={() => setContactOpen(true)}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.7)',
            fontSize: 14,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            transition: 'color 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          ¿Necesitas ayuda? Escribenos
        </button>
      </div>

      <ForgotPasswordModal open={forgotOpen} onClose={() => setForgotOpen(false)} />
      <ContactSupportModal open={contactOpen} onClose={() => setContactOpen(false)} />
    </AuthLayout>
  );
}
