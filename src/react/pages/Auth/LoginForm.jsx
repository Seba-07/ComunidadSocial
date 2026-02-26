import { useState } from 'react';
import FormField from '../../components/ui/FormField';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const login = useAuthStore((s) => s.login);
  const addToast = useUiStore((s) => s.addToast);

  function validate() {
    const errs = {};
    if (!email) errs.email = 'El email es requerido';
    else if (!email.includes('@') || !email.includes('.')) errs.email = 'Ingresa un email válido';
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
      const user = await login(email, password);

      if (user.role === 'MINISTRO_FE') {
        localStorage.removeItem('currentUser');
        localStorage.setItem('currentMinistro', JSON.stringify(user));
        localStorage.setItem('isMinistroAuthenticated', 'true');
        addToast(`¡Bienvenido ${user.firstName}!`, 'success');
        const url = user.mustChangePassword
          ? '/ministro-dashboard.html?changePassword=true'
          : '/ministro-dashboard.html';
        setTimeout(() => { window.location.href = url; }, 500);
      } else if (user.role === 'MUNICIPALIDAD') {
        localStorage.setItem('isAuthenticated', 'true');
        addToast(`¡Bienvenido ${user.firstName || 'Municipalidad'}!`, 'success');
        setTimeout(() => { window.location.href = '/?admin=true'; }, 500);
      } else if (user.role === 'MIEMBRO') {
        localStorage.setItem('isAuthenticated', 'true');
        addToast(`¡Bienvenido ${user.firstName || 'Miembro'}!`, 'success');
        setTimeout(() => { window.location.href = '/?member=true'; }, 500);
      } else {
        localStorage.setItem('isAuthenticated', 'true');
        addToast(`¡Bienvenido ${user.firstName || user.profile?.firstName || 'Usuario'}!`, 'success');
        setTimeout(() => { window.location.href = '/'; }, 500);
      }
    } catch (error) {
      if (error.message.includes('no encontrado') || error.message.includes('Usuario') || error.message.includes('Credenciales inválidas') || error.message.includes('inválidas')) {
        setErrors({ email: 'Correo o contraseña incorrectos', password: 'Correo o contraseña incorrectos' });
      } else if (error.message.includes('contraseña') || error.message.includes('Contraseña')) {
        setErrors({ password: 'Contraseña incorrecta' });
      } else if (error.message.includes('desactivada') || error.message.includes('inactivo')) {
        addToast(error.message, 'error');
      } else {
        addToast(error.message || 'Error al iniciar sesión', 'error');
      }
      setSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <FormField
        label="Email"
        id="login-email"
        type="email"
        placeholder="tu@email.cl"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
      />
      <FormField
        label="Contraseña"
        id="login-password"
        type="password"
        placeholder="••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
      />
      <button type="submit" className="btn-auth" disabled={submitting}>
        {submitting ? 'Iniciando sesión...' : 'Iniciar Sesión'}
      </button>
      <div className="form-footer">
        <a href="#" id="forgot-password-link" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
          ¿Olvidaste tu contraseña?
        </a>
        <div style={{ marginTop: 12, color: '#6b7280' }}>
          ¿No tienes cuenta? Haz clic en &quot;Registrarse&quot; arriba
        </div>
      </div>
    </form>
  );
}
