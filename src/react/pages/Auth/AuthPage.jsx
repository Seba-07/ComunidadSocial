import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/layout/AuthLayout';
import LoginForm from './LoginForm';
import LoginSocioForm from './LoginSocioForm';
import RegisterForm from './RegisterForm';
import MinistroLoginForm from './MinistroLoginForm';
import ForgotPasswordModal from './ForgotPasswordModal';
import { useAuthStore } from '../../stores/authStore';
import './auth.css';

const TABS = [
  { id: 'login', label: 'Organizador' },
  { id: 'login-socio', label: 'Socio' },
  { id: 'login-ministro', label: 'Ministro de Fe' },
  { id: 'register', label: 'Registrarse' }
];

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState('login');
  const [forgotOpen, setForgotOpen] = useState(false);
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
        {activeTab === 'login-socio' && <LoginSocioForm />}
        {activeTab === 'login-ministro' && <MinistroLoginForm />}
        {activeTab === 'register' && <RegisterForm />}
      </div>

      <ForgotPasswordModal open={forgotOpen} onClose={() => setForgotOpen(false)} />
    </AuthLayout>
  );
}
