import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FormField from '../../components/ui/FormField';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { apiService } from '@services/ApiService.js';

export default function MinistroLoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const { addToast } = useUiStore();
  const navigate = useNavigate();

  function validate() {
    const errs = {};
    if (!email) errs.email = 'El email es requerido';
    if (!password) errs.password = 'La contraseña es requerida';
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      const data = await apiService.loginMinistro(email, password);
      const ministro = data.ministro || data.user;

      localStorage.setItem('currentMinistro', JSON.stringify(ministro));
      localStorage.setItem('isMinistroAuthenticated', 'true');
      localStorage.setItem('isAuthenticated', 'true');

      // Hydrate auth store
      useAuthStore.getState().hydrate();

      addToast(`Bienvenido ${ministro.firstName}`, 'success');
      setTimeout(() => navigate('/ministro'), 300);
    } catch (error) {
      setErrors({ email: 'Credenciales inválidas' });
      setSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <FormField
        label="Email"
        id="ministro-email"
        type="email"
        placeholder="ministro@email.cl"
        value={email}
        onChange={e => setEmail(e.target.value)}
        error={errors.email}
      />
      <FormField
        label="Contraseña"
        id="ministro-password"
        type="password"
        placeholder="••••••••"
        value={password}
        onChange={e => setPassword(e.target.value)}
        error={errors.password}
      />
      <button type="submit" className="btn-auth" disabled={submitting}>
        {submitting ? 'Iniciando sesión...' : 'Iniciar Sesión'}
      </button>
    </form>
  );
}
