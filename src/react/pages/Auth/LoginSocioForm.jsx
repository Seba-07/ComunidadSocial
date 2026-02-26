import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FormField from '../../components/ui/FormField';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { formatRut } from '../../utils/validators';

export default function LoginSocioForm() {
  const [lastName, setLastName] = useState('');
  const [rut, setRut] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const loginSocio = useAuthStore((s) => s.loginSocio);
  const addToast = useUiStore((s) => s.addToast);
  const navigate = useNavigate();

  function handleRutChange(e) {
    const raw = e.target.value.replace(/[^0-9kK]/g, '');
    if (raw.length <= 9) {
      setRut(raw.length > 1 ? formatRut(raw) : raw);
    }
  }

  function validate() {
    const errs = {};
    if (!lastName || lastName.length < 2) errs.lastName = 'Ingresa tu apellido paterno';
    const cleanRut = rut.replace(/[.\-]/g, '');
    if (!cleanRut || cleanRut.length < 7) errs.rut = 'Ingresa tu RUT';
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
        navigate('/member');
      }, 300);
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
        label="RUT"
        id="socio-rut"
        type="text"
        placeholder="12.345.678-9"
        value={rut}
        onChange={handleRutChange}
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
