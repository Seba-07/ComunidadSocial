import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FormField from '../../components/ui/FormField';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { validateRut, formatRut } from '../../utils/validators';

export default function RegisterForm() {
  const [form, setForm] = useState({
    firstName: '', lastName: '', rut: '', email: '', password: '', passwordConfirm: '', privacyAccepted: false
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const register = useAuthStore((s) => s.register);
  const addToast = useUiStore((s) => s.addToast);
  const navigate = useNavigate();

  function set(field) {
    return (e) => {
      let value = e.target.value;
      if (field === 'rut') {
        const clean = value.replace(/\./g, '').replace(/-/g, '');
        value = clean ? formatRut(clean) : '';
      }
      setForm((f) => ({ ...f, [field]: value }));
    };
  }

  function validate() {
    const errs = {};
    if (form.firstName.length < 2) errs.firstName = 'El nombre debe tener al menos 2 caracteres';
    if (form.lastName.length < 2) errs.lastName = 'El apellido debe tener al menos 2 caracteres';
    if (!validateRut(form.rut)) errs.rut = 'RUT inválido';
    if (!form.email.includes('@') || !form.email.includes('.')) errs.email = 'Email inválido';
    if (form.password.length < 6) errs.password = 'La contraseña debe tener al menos 6 caracteres';
    else if (!/[A-Z]/.test(form.password)) errs.password = 'Debe contener al menos una mayúscula';
    if (form.password !== form.passwordConfirm) errs.passwordConfirm = 'Las contraseñas no coinciden';
    if (!form.privacyAccepted) errs.privacyAccepted = 'Debe aceptar la política de privacidad';
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      await register({
        rut: form.rut,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        privacyAccepted: true
      });

      localStorage.setItem('isAuthenticated', 'true');
      addToast('¡Cuenta creada exitosamente! Redirigiendo...', 'success');
      setTimeout(() => { navigate('/org/auto'); }, 1500);
    } catch (error) {
      if (error.details && Array.isArray(error.details)) {
        const fieldMap = {
          firstName: 'firstName',
          lastName: 'lastName',
          rut: 'rut',
          email: 'email',
          password: 'password'
        };
        const newErrors = {};
        let shownFieldError = false;
        for (const detail of error.details) {
          if (fieldMap[detail.field]) {
            newErrors[fieldMap[detail.field]] = detail.message;
            shownFieldError = true;
          }
        }
        if (shownFieldError) {
          setErrors(newErrors);
        } else {
          addToast(error.details.map((d) => d.message).join('. ') || error.message, 'error');
        }
      } else if (error.message.includes('email') || error.message.includes('Email')) {
        setErrors({ email: error.message });
      } else if (error.message.includes('RUT') || error.message.includes('rut')) {
        setErrors({ rut: error.message });
      } else {
        addToast(error.message || 'Error al crear la cuenta', 'error');
      }
      setSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <FormField
        label="Nombre *"
        id="register-name"
        type="text"
        placeholder="Juan"
        value={form.firstName}
        onChange={set('firstName')}
        error={errors.firstName}
      />
      <FormField
        label="Apellido *"
        id="register-lastname"
        type="text"
        placeholder="Pérez"
        value={form.lastName}
        onChange={set('lastName')}
        error={errors.lastName}
      />
      <FormField
        label="RUT *"
        id="register-rut"
        type="text"
        placeholder="12.345.678-9"
        value={form.rut}
        onChange={set('rut')}
        error={errors.rut}
      />
      <FormField
        label="Email *"
        id="register-email"
        type="email"
        placeholder="tu@email.cl"
        value={form.email}
        onChange={set('email')}
        error={errors.email}
      />
      <FormField
        label="Contraseña *"
        id="register-password"
        type="password"
        placeholder="Min 6 caracteres, una mayúscula"
        value={form.password}
        onChange={set('password')}
        error={errors.password}
      />
      <FormField
        label="Confirmar Contraseña *"
        id="register-password-confirm"
        type="password"
        placeholder="Repite tu contraseña"
        value={form.passwordConfirm}
        onChange={set('passwordConfirm')}
        error={errors.passwordConfirm}
      />
      <div style={{ margin: '12px 0' }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', fontSize: 13, color: '#374151', lineHeight: 1.4 }}>
          <input
            type="checkbox"
            checked={form.privacyAccepted}
            onChange={(e) => setForm((f) => ({ ...f, privacyAccepted: e.target.checked }))}
            style={{ marginTop: 2, accentColor: '#2563eb' }}
          />
          <span>
            He leído y acepto la{' '}
            <a href="/app/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>
              Política de Privacidad
            </a>{' '}
            y los{' '}
            <a href="/app/terms" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>
              Términos de Uso
            </a>
          </span>
        </label>
        {errors.privacyAccepted && (
          <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4, marginLeft: 24 }}>{errors.privacyAccepted}</p>
        )}
      </div>
      <button type="submit" className="btn-auth" disabled={submitting}>
        {submitting ? 'Creando cuenta...' : 'Crear Cuenta'}
      </button>
    </form>
  );
}
