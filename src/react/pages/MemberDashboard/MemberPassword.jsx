import { useState } from 'react';
import FormField from '../../components/ui/FormField';
import { apiService } from '@services/ApiService.js';
import { useUiStore } from '../../stores/uiStore';

export default function MemberPassword() {
  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const addToast = useUiStore((s) => s.addToast);

  function validate() {
    const errs = {};
    if (!current) errs.current = 'Ingresa tu contraseña actual';
    if (newPass.length < 6) errs.newPass = 'Mínimo 6 caracteres';
    else if (!/[A-Z]/.test(newPass)) errs.newPass = 'Debe contener al menos una mayúscula';
    if (newPass !== confirm) errs.confirm = 'Las contraseñas no coinciden';
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      await apiService.changePassword(current, newPass);

      // Update localStorage
      const userJson = localStorage.getItem('currentUser');
      if (userJson) {
        try {
          const user = JSON.parse(userJson);
          user.mustChangePassword = false;
          localStorage.setItem('currentUser', JSON.stringify(user));
        } catch { /* ignore */ }
      }

      addToast('Contraseña cambiada exitosamente', 'success');
      setCurrent('');
      setNewPass('');
      setConfirm('');
      setErrors({});
    } catch (error) {
      addToast(error.message || 'Error al cambiar contraseña', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1e3a8a', marginBottom: 16 }}>Cambiar Contraseña</h3>
      <form className="auth-form" onSubmit={handleSubmit}>
        <FormField
          label="Contraseña actual"
          id="current-password"
          type="password"
          placeholder="••••••••"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          error={errors.current}
        />
        <FormField
          label="Nueva contraseña"
          id="new-password"
          type="password"
          placeholder="Min 6 caracteres, una mayúscula"
          value={newPass}
          onChange={(e) => setNewPass(e.target.value)}
          error={errors.newPass}
        />
        <FormField
          label="Confirmar nueva contraseña"
          id="confirm-password"
          type="password"
          placeholder="Repite tu nueva contraseña"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={errors.confirm}
        />
        <button type="submit" className="btn-auth" disabled={submitting}>
          {submitting ? 'Cambiando...' : 'Cambiar Contraseña'}
        </button>
      </form>
    </div>
  );
}
