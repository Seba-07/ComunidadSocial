import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { apiService } from '../../../services/ApiService';
import tenant from '../../../config/tenant.js';

const cardStyle = {
  background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, marginBottom: 16
};
const inputStyle = {
  width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8,
  fontSize: 14, boxSizing: 'border-box', transition: 'border-color 0.15s'
};
const labelStyle = { fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 };
const btnPrimary = {
  padding: '10px 24px', background: '#2563eb', color: '#fff', border: 'none',
  borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer'
};

export default function SettingsPage() {
  const { user, hydrate } = useAuthStore();
  const addToast = useUiStore(s => s.addToast);
  const isMuni = user?.role === 'MUNICIPALIDAD';

  // Profile form
  const [profile, setProfile] = useState({
    firstName: '', lastName: '', phone: '', address: '', region: '', commune: ''
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Password form
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingPw, setSavingPw] = useState(false);

  // Admin preferences (only for MUNICIPALIDAD)
  const [requireBlockConfirmation, setRequireBlockConfirmation] = useState(false);
  const [savingPref, setSavingPref] = useState(false);

  // Email verification
  const [sendingVerification, setSendingVerification] = useState(false);

  // Municipality institutional config (only for MUNICIPALIDAD)
  const [muniConfig, setMuniConfig] = useState({
    officialName: '', rut: '', address: '', region: '', comuna: ''
  });
  const [savingMuni, setSavingMuni] = useState(false);

  useEffect(() => {
    if (isMuni) {
      apiService.getAdminPreference('requireBlockConfirmation')
        .then(res => { if (res.value !== null) setRequireBlockConfirmation(res.value); })
        .catch(() => {});
    }
  }, [isMuni]);

  useEffect(() => {
    if (isMuni) {
      apiService.getMunicipalityConfig()
        .then(res => {
          if (res.data) setMuniConfig(res.data);
        })
        .catch(() => {});
    }
  }, [isMuni]);

  async function handleToggleBlockConfirmation() {
    const newVal = !requireBlockConfirmation;
    setSavingPref(true);
    try {
      await apiService.setAdminPreference('requireBlockConfirmation', newVal);
      setRequireBlockConfirmation(newVal);
      addToast(newVal ? 'Bloqueos de MF ahora requieren aprobación' : 'Bloqueos de MF ahora se aprueban automáticamente', 'success');
    } catch (err) {
      addToast(err.message || 'Error al guardar preferencia', 'error');
    } finally {
      setSavingPref(false);
    }
  }

  useEffect(() => {
    if (user) {
      setProfile({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phone: user.phone || '',
        address: user.address || '',
        region: user.region || 'Región Metropolitana',
        commune: user.commune || tenant.communeName
      });
    }
  }, [user]);

  async function handleSaveProfile(e) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const result = await apiService.updateProfile(profile);
      // Update local state
      const updated = result.user;
      const stored = JSON.parse(localStorage.getItem('currentUser') || '{}');
      Object.assign(stored, updated);
      localStorage.setItem('currentUser', JSON.stringify(stored));
      hydrate(); // Update auth store so other components see the changes
      addToast('Perfil actualizado', 'success');
    } catch (err) {
      addToast(err.message || 'Error al actualizar perfil', 'error');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    if (pw.newPassword.length < 6) {
      addToast('La contraseña debe tener al menos 6 caracteres', 'error');
      return;
    }
    if (!/[A-Z]/.test(pw.newPassword)) {
      addToast('Debe contener al menos una mayúscula', 'error');
      return;
    }
    if (pw.newPassword !== pw.confirmPassword) {
      addToast('Las contraseñas no coinciden', 'error');
      return;
    }
    setSavingPw(true);
    try {
      await apiService.changePassword(pw.currentPassword, pw.newPassword);
      addToast('Contraseña actualizada. Otras sesiones han sido cerradas.', 'success');
      setPw({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      addToast(err.message || 'Error al cambiar contraseña', 'error');
    } finally {
      setSavingPw(false);
    }
  }

  async function handleResendVerification() {
    setSendingVerification(true);
    try {
      await apiService.resendVerificationEmail();
      addToast('Email de verificación enviado', 'success');
    } catch (err) {
      addToast(err.message || 'Error al enviar verificación', 'error');
    } finally {
      setSendingVerification(false);
    }
  }

  async function handleSaveMuniConfig(e) {
    e.preventDefault();
    setSavingMuni(true);
    try {
      await apiService.updateMunicipalityConfig(muniConfig);
      addToast('Datos institucionales actualizados', 'success');
    } catch (err) {
      addToast(err.message || 'Error al guardar datos institucionales', 'error');
    } finally {
      setSavingMuni(false);
    }
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 20 }}>
        Configuración de Cuenta
      </h2>

      {/* Email verification status */}
      {user && !user.emailVerified && (
        <div style={{
          ...cardStyle,
          border: '1px solid #fbbf24',
          background: '#fffbeb',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16
        }}>
          <div>
            <div style={{ fontWeight: 600, color: '#92400e', fontSize: 14 }}>Email no verificado</div>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#a16207' }}>
              Verifica tu correo ({user.email}) para acceder a todas las funciones.
            </p>
          </div>
          <button
            onClick={handleResendVerification}
            disabled={sendingVerification}
            style={{
              ...btnPrimary, background: '#f59e0b', flexShrink: 0, fontSize: 13,
              opacity: sendingVerification ? 0.6 : 1
            }}
          >
            {sendingVerification ? 'Enviando...' : 'Reenviar'}
          </button>
        </div>
      )}

      {user?.emailVerified && (
        <div style={{
          ...cardStyle, border: '1px solid #86efac', background: '#f0fdf4',
          display: 'flex', alignItems: 'center', gap: 12, padding: '14px 24px'
        }}>
          <span style={{ color: '#16a34a', fontSize: 18 }}>&#10003;</span>
          <span style={{ fontSize: 14, color: '#166534', fontWeight: 500 }}>Email verificado</span>
        </div>
      )}

      {/* Datos de la Institución - only for MUNICIPALIDAD */}
      {isMuni && (
        <form onSubmit={handleSaveMuniConfig}>
          <div style={cardStyle}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 8 }}>Datos de la Institución</h3>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px' }}>
              Estos datos representan a la institución municipal y se usan en documentos legales, actas y estatutos.
            </p>
            <div className="r-grid-2" style={{ gap: 12 }}>
              <div>
                <label style={labelStyle}>Nombre Oficial</label>
                <input value={muniConfig.officialName} onChange={e => setMuniConfig(c => ({ ...c, officialName: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>RUT</label>
                <input value={muniConfig.rut} onChange={e => setMuniConfig(c => ({ ...c, rut: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Dirección</label>
                <input value={muniConfig.address} onChange={e => setMuniConfig(c => ({ ...c, address: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Región</label>
                <input value={muniConfig.region} onChange={e => setMuniConfig(c => ({ ...c, region: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Comuna</label>
                <input value={muniConfig.comuna} onChange={e => setMuniConfig(c => ({ ...c, comuna: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="submit" disabled={savingMuni} style={{ ...btnPrimary, opacity: savingMuni ? 0.6 : 1 }}>
                {savingMuni ? 'Guardando...' : 'Guardar Datos Institucionales'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Datos Personales */}
      <form onSubmit={handleSaveProfile}>
        <div style={cardStyle}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 16 }}>Datos Personales</h3>
          <div className="r-grid-2" style={{ gap: 12 }}>
            <div>
              <label style={labelStyle}>Nombre</label>
              <input value={profile.firstName} onChange={e => setProfile(p => ({ ...p, firstName: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Apellido</label>
              <input value={profile.lastName} onChange={e => setProfile(p => ({ ...p, lastName: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Teléfono</label>
              <input value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} style={inputStyle} placeholder="+56 9 1234 5678" />
            </div>
            <div>
              <label style={labelStyle}>Dirección</label>
              <input value={profile.address} onChange={e => setProfile(p => ({ ...p, address: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Región</label>
              <input value={profile.region} disabled style={{ ...inputStyle, background: '#f3f4f6', color: '#6b7280' }} />
            </div>
            <div>
              <label style={labelStyle}>Comuna</label>
              <input value={profile.commune} disabled style={{ ...inputStyle, background: '#f3f4f6', color: '#6b7280' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <p style={{ flex: 1, fontSize: 12, color: '#9ca3af', margin: 0 }}>
              RUT, email, región y comuna no se pueden modificar.
            </p>
            <button type="submit" disabled={savingProfile} style={{ ...btnPrimary, opacity: savingProfile ? 0.6 : 1 }}>
              {savingProfile ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>
      </form>

      {/* Cambiar Contraseña */}
      <form onSubmit={handleChangePassword}>
        <div style={cardStyle}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 16 }}>Cambiar Contraseña</h3>
          <div style={{ display: 'grid', gap: 12, maxWidth: 400 }}>
            <div>
              <label style={labelStyle}>Contraseña actual</label>
              <input type="password" value={pw.currentPassword} onChange={e => setPw(p => ({ ...p, currentPassword: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Nueva contraseña</label>
              <input type="password" value={pw.newPassword} onChange={e => setPw(p => ({ ...p, newPassword: e.target.value }))} style={inputStyle} placeholder="Mín. 6 caracteres, 1 mayúscula" />
            </div>
            <div>
              <label style={labelStyle}>Confirmar nueva contraseña</label>
              <input type="password" value={pw.confirmPassword} onChange={e => setPw(p => ({ ...p, confirmPassword: e.target.value }))} style={inputStyle} />
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <button type="submit" disabled={savingPw} style={{ ...btnPrimary, opacity: savingPw ? 0.6 : 1 }}>
              {savingPw ? 'Actualizando...' : 'Cambiar Contraseña'}
            </button>
          </div>
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>
            Al cambiar tu contraseña, todas las demás sesiones activas serán cerradas.
          </p>
        </div>
      </form>

      {/* Preferencias de Administración - only for MUNICIPALIDAD */}
      {isMuni && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 16 }}>Preferencias de Administración</h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>
                Aprobación de bloqueos de Ministros de Fe
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
                {requireBlockConfirmation
                  ? 'Los bloqueos creados por MF requieren tu aprobación antes de activarse.'
                  : 'Los bloqueos de MF se activan automáticamente y solo recibes una notificación.'}
              </p>
            </div>
            <button
              onClick={handleToggleBlockConfirmation}
              disabled={savingPref}
              style={{
                flexShrink: 0, width: 52, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
                background: requireBlockConfirmation ? '#2563eb' : '#d1d5db',
                position: 'relative', transition: 'background 0.2s',
                opacity: savingPref ? 0.6 : 1
              }}
            >
              <span style={{
                position: 'absolute', top: 3, left: requireBlockConfirmation ? 27 : 3,
                width: 22, height: 22, borderRadius: '50%', background: '#fff',
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
              }} />
            </button>
          </div>
        </div>
      )}

      {/* Información de Cuenta */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 12 }}>Información de Cuenta</h3>
        <div className="r-grid-2" style={{ gap: 12, fontSize: 14 }}>
          <div><span style={{ color: '#6b7280' }}>RUT:</span> <strong>{user?.rut || '-'}</strong></div>
          <div><span style={{ color: '#6b7280' }}>Email:</span> <strong>{user?.email || '-'}</strong></div>
          <div><span style={{ color: '#6b7280' }}>Rol:</span> <strong>{{ ORGANIZADOR: 'Dirigente Social', MUNICIPALIDAD: 'Secretario Municipal', MINISTRO_FE: 'Ministro de Fe', MIEMBRO: 'Miembro', MIEMBRO_DIRECTIVO: 'Miembro Directivo' }[user?.role] || user?.role || '-'}</strong></div>
          <div><span style={{ color: '#6b7280' }}>Estado:</span> <strong style={{ color: '#16a34a' }}>Activo</strong></div>
        </div>
      </div>
    </div>
  );
}
