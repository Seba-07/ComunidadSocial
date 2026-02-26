import { useState } from 'react';
import FormField from '../../components/ui/FormField';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';

export default function LoginSocioForm() {
  const [lastName, setLastName] = useState('');
  const [rut, setRut] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const loginSocio = useAuthStore((s) => s.loginSocio);
  const addToast = useUiStore((s) => s.addToast);

  function validate() {
    const errs = {};
    if (!lastName || lastName.length < 2) errs.lastName = 'Ingresa tu apellido paterno';
    if (!rut || rut.length < 7) errs.rut = 'Ingresa tu RUT sin puntos ni guión';
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      const user = await loginSocio(lastName, rut);

      localStorage.setItem('isAuthenticated', 'true');
      addToast(`¡Bienvenido ${user.firstName}!`, 'success');

      setTimeout(() => {
        if (user.mustChangePassword) {
          window.location.href = '/?member=true&changePassword=true';
        } else {
          window.location.href = '/?member=true';
        }
      }, 500);
    } catch (error) {
      if (error.message.includes('Apellido') || error.message.includes('apellido')) {
        setErrors({ lastName: error.message });
      } else if (error.message.includes('RUT') || error.message.includes('rut')) {
        setErrors({ rut: error.message });
      } else {
        addToast(error.message || 'Error al iniciar sesión', 'error');
      }
      setSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <div className="socio-info-box">
        <strong>Acceso para Socios</strong>
        <p style={{ margin: '8px 0 0' }}>
          Si eres miembro de una organización comunitaria, ingresa con tu apellido paterno y tu RUT (sin puntos ni guión). La contraseña inicial es tu RUT.
        </p>
      </div>
      <FormField
        label="Apellido Paterno"
        id="socio-lastname"
        type="text"
        placeholder="Pérez"
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
        error={errors.lastName}
      />
      <FormField
        label="RUT (sin puntos ni guión)"
        id="socio-rut"
        type="text"
        placeholder="123456789"
        value={rut}
        onChange={(e) => setRut(e.target.value)}
        error={errors.rut}
      />
      <button type="submit" className="btn-auth" disabled={submitting}>
        {submitting ? 'Ingresando...' : 'Ingresar como Socio'}
      </button>
      <div className="form-footer">
        Tu contraseña inicial es tu RUT sin puntos ni guión.
      </div>
    </form>
  );
}
