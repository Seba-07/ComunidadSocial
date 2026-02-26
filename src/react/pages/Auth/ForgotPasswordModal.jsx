import { useState } from 'react';
import Modal from '../../components/ui/Modal';
import FormField from '../../components/ui/FormField';

export default function ForgotPasswordModal({ open, onClose }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  function handleClose() {
    setEmail('');
    setError('');
    setResult(null);
    onClose();
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setResult(null);

    if (!email) {
      setError('El email es requerido');
      return;
    }
    if (!email.includes('@') || !email.includes('.')) {
      setError('Ingresa un email válido');
      return;
    }

    setResult(email);
  }

  return (
    <Modal open={open} onClose={handleClose} title="Recuperar Contraseña">
      <p style={{ color: '#6b7280', marginBottom: 24, fontSize: 16 }}>
        Ingresa tu email y te mostraremos tu contraseña actual. Podrás cambiarla desde tu perfil una vez que inicies sesión.
      </p>
      <form onSubmit={handleSubmit}>
        <FormField
          label="Email"
          id="recover-email"
          type="email"
          placeholder="tu@email.cl"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error}
        />
        <button type="submit" className="btn-auth">
          Recuperar Contraseña
        </button>
      </form>
      {result && (
        <div style={{
          marginTop: 24,
          padding: 20,
          background: '#fef3c7',
          border: '2px solid #fbbf24',
          borderRadius: 12
        }}>
          <p style={{ margin: '0 0 12px 0', color: '#065f46', fontWeight: 600, fontSize: 16 }}>
            Recuperación de contraseña
          </p>
          <p style={{ margin: 0, color: '#374151', fontSize: 14, lineHeight: 1.6 }}>
            Para recuperar tu contraseña, por favor contacta al administrador del sistema en:<br /><br />
            <strong>Email:</strong> admin@renca.cl<br />
            <strong>Teléfono:</strong> +56 2 2345 6789<br /><br />
            Proporciona tu email registrado: <strong>{result}</strong>
          </p>
        </div>
      )}
    </Modal>
  );
}
