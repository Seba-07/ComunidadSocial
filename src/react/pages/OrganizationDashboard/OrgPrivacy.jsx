import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { apiService } from '../../../services/ApiService';

const cardStyle = {
  background: '#fff',
  borderRadius: 12,
  border: '1px solid #e5e7eb',
  padding: 24,
  marginBottom: 16
};

const PURPOSE_LABELS = {
  essential: { label: 'Funcionamiento esencial', desc: 'Necesario para el uso de la plataforma. No se puede desactivar.', locked: true },
  notifications_email: { label: 'Notificaciones por email', desc: 'Recibir notificaciones sobre el estado de sus trámites y organizaciones.' },
  data_sharing_municipality: { label: 'Compartir datos con Municipalidad', desc: 'Permitir que sus datos sean compartidos con la Ilustre Municipalidad de Renca para fines de registro y fiscalización.' }
};

const ACTION_LABELS = {
  personal_data_export: 'Exportación de datos personales',
  account_deletion_request: 'Solicitud de eliminación de cuenta',
  arcop_opposition: 'Oposición al tratamiento',
  consent_update: 'Actualización de consentimiento'
};

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function OrgPrivacy() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const addToast = useUiStore((s) => s.addToast);
  const [consents, setConsents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [arcopHistory, setArcopHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showOpposeModal, setShowOpposeModal] = useState(false);
  const [opposePurpose, setOpposePurpose] = useState('');
  const [opposeReason, setOpposeReason] = useState('');
  const [opposing, setOpposing] = useState(false);

  useEffect(() => {
    loadConsents();
    loadArcopHistory();
  }, []);

  async function loadConsents() {
    try {
      const data = await apiService.getMyConsents();
      setConsents(data.consents || []);
    } catch (err) {
      addToast('Error al cargar consentimientos', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadArcopHistory() {
    setLoadingHistory(true);
    try {
      const data = await apiService.getArcopHistory();
      setArcopHistory(data.history || []);
    } catch (err) {
      // Silent fail - history is non-critical
    } finally {
      setLoadingHistory(false);
    }
  }

  async function handleToggleConsent(purpose, currentGranted) {
    setSaving(true);
    try {
      await apiService.updateMyConsents([{ purpose, granted: !currentGranted }]);
      setConsents(prev => prev.map(c =>
        c.purpose === purpose ? { ...c, granted: !currentGranted } : c
      ));
      addToast('Preferencia actualizada', 'success');
      loadArcopHistory();
    } catch (err) {
      addToast('Error al actualizar preferencia', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleExport(format) {
    setExporting(true);
    try {
      if (format === 'csv') {
        await apiService.exportMyData('csv');
        addToast('Archivo CSV descargado', 'success');
      } else {
        const data = await apiService.exportMyData('json');
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'mis_datos.json';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        addToast('Archivo JSON descargado', 'success');
      }
      loadArcopHistory();
    } catch (err) {
      addToast('Error al exportar datos', 'error');
    } finally {
      setExporting(false);
    }
  }

  function openOpposeModal(purpose) {
    setOpposePurpose(purpose);
    setOpposeReason('');
    setShowOpposeModal(true);
  }

  async function handleOppose() {
    if (!opposeReason || opposeReason.trim().length < 5) {
      addToast('Debe proporcionar una justificación (mínimo 5 caracteres)', 'error');
      return;
    }
    setOpposing(true);
    try {
      await apiService.opposeDataProcessing(opposePurpose, opposeReason.trim());
      setConsents(prev => prev.map(c =>
        c.purpose === opposePurpose ? { ...c, granted: false } : c
      ));
      addToast('Oposición registrada exitosamente', 'success');
      setShowOpposeModal(false);
      loadArcopHistory();
    } catch (err) {
      addToast(err.message || 'Error al registrar oposición', 'error');
    } finally {
      setOpposing(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      await apiService.deleteMyAccount(deleteReason);
      addToast('Cuenta eliminada exitosamente', 'success');
      setShowDeleteModal(false);
      setTimeout(() => {
        logout();
        window.location.href = '/app/login';
      }, 1500);
    } catch (err) {
      addToast(err.message || 'Error al eliminar cuenta', 'error');
      setDeleting(false);
    }
  }

  if (loading) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Cargando...</div>;
  }

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 20 }}>
        Mis Datos y Privacidad
      </h2>

      {/* Personal Data Summary */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 12 }}>
          Datos Personales Almacenados
        </h3>
        <div className="r-grid-2">
          {[
            { label: 'Nombre', value: `${user?.firstName || ''} ${user?.lastName || ''}` },
            { label: 'RUT', value: user?.rut || '-' },
            { label: 'Email', value: user?.email || '-' },
            { label: 'Teléfono', value: user?.phone || 'No registrado' },
            { label: 'Dirección', value: user?.address || 'No registrada' },
            { label: 'Rol', value: user?.role || '-' }
          ].map(({ label, value }) => (
            <div key={label} style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 14, color: '#111827', fontWeight: 500 }}>{value}</div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 12 }}>
          Puede modificar sus datos personales desde la sección de perfil.
        </p>
      </div>

      {/* Consent Toggles */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
          Preferencias de Consentimiento
        </h3>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
          Controle cómo se utilizan sus datos. Los cambios se aplican inmediatamente.
        </p>
        {consents.map(consent => {
          const meta = PURPOSE_LABELS[consent.purpose] || { label: consent.purpose, desc: '' };
          return (
            <div
              key={consent.purpose}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 0',
                borderBottom: '1px solid #f3f4f6',
                gap: 12
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>{meta.label}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{meta.desc}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {!meta.locked && consent.granted && (
                  <button
                    onClick={() => openOpposeModal(consent.purpose)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#6b7280',
                      fontSize: 11,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      padding: 0
                    }}
                    title="Oponerse formalmente al tratamiento"
                  >
                    Oponerme
                  </button>
                )}
                <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24 }}>
                  <input
                    type="checkbox"
                    checked={consent.granted}
                    disabled={meta.locked || saving}
                    onChange={() => handleToggleConsent(consent.purpose, consent.granted)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      cursor: meta.locked ? 'not-allowed' : 'pointer',
                      top: 0, left: 0, right: 0, bottom: 0,
                      backgroundColor: consent.granted ? '#2563eb' : '#d1d5db',
                      borderRadius: 24,
                      transition: 'background-color 0.2s',
                      opacity: meta.locked ? 0.6 : 1
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        height: 18,
                        width: 18,
                        left: consent.granted ? 22 : 3,
                        bottom: 3,
                        backgroundColor: '#fff',
                        borderRadius: '50%',
                        transition: 'left 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                      }}
                    />
                  </span>
                </label>
              </div>
            </div>
          );
        })}
      </div>

      {/* Data Export */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
          Descargar Mis Datos
        </h3>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
          Descargue una copia de todos sus datos personales almacenados en la plataforma (derecho de portabilidad).
        </p>
        <div className="r-form-row">
          <button
            onClick={() => handleExport('json')}
            disabled={exporting}
            style={{
              padding: '10px 20px',
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: exporting ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 500,
              opacity: exporting ? 0.6 : 1
            }}
          >
            {exporting ? 'Exportando...' : 'Descargar JSON'}
          </button>
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting}
            style={{
              padding: '10px 20px',
              background: '#fff',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              cursor: exporting ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 500,
              opacity: exporting ? 0.6 : 1
            }}
          >
            {exporting ? 'Exportando...' : 'Descargar CSV'}
          </button>
        </div>
      </div>

      {/* ARCOP History */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
          Historial de Solicitudes ARCOP
        </h3>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
          Registro de sus solicitudes de acceso, rectificación, cancelación, oposición y portabilidad.
        </p>
        {loadingHistory ? (
          <p style={{ fontSize: 13, color: '#9ca3af' }}>Cargando historial...</p>
        ) : arcopHistory.length === 0 ? (
          <p style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>No hay solicitudes registradas.</p>
        ) : (
          <div className="r-table-wrap" style={{ maxHeight: 300 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '8px 6px', color: '#6b7280', fontWeight: 600 }}>Fecha</th>
                  <th style={{ textAlign: 'left', padding: '8px 6px', color: '#6b7280', fontWeight: 600 }}>Tipo</th>
                  <th style={{ textAlign: 'left', padding: '8px 6px', color: '#6b7280', fontWeight: 600 }}>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {arcopHistory.map((entry, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px 6px', color: '#374151', whiteSpace: 'nowrap' }}>
                      {formatDate(entry.date)}
                    </td>
                    <td style={{ padding: '8px 6px', color: '#111827', fontWeight: 500 }}>
                      {ACTION_LABELS[entry.type] || entry.type}
                    </td>
                    <td style={{ padding: '8px 6px', color: '#6b7280' }}>
                      {entry.type === 'arcop_opposition' && entry.details?.purpose && (
                        <span>Propósito: {PURPOSE_LABELS[entry.details.purpose]?.label || entry.details.purpose}. Motivo: {entry.details.reason || '-'}</span>
                      )}
                      {entry.type === 'personal_data_export' && (
                        <span>Formato: {entry.details?.format || 'json'}</span>
                      )}
                      {entry.type === 'consent_update' && entry.details?.consents && (
                        <span>
                          {entry.details.consents.map(c =>
                            `${PURPOSE_LABELS[c.purpose]?.label || c.purpose}: ${c.granted ? 'activado' : 'desactivado'}`
                          ).join(', ')}
                        </span>
                      )}
                      {entry.type === 'account_deletion_request' && (
                        <span>Motivo: {entry.details?.reason || '-'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Privacy Policy Link */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 8 }}>
          Documentos Legales
        </h3>
        <div style={{ display: 'flex', gap: 16 }}>
          <a
            href="/app/privacy"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#2563eb', fontSize: 14, textDecoration: 'underline' }}
          >
            Política de Privacidad
          </a>
          <a
            href="/app/terms"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#2563eb', fontSize: 14, textDecoration: 'underline' }}
          >
            Términos de Uso
          </a>
        </div>
      </div>

      {/* Delete Account */}
      <div style={{ ...cardStyle, border: '1px solid #fecaca' }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#dc2626', marginBottom: 4 }}>
          Eliminar Mi Cuenta
        </h3>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
          Esta acción es irreversible. Sus datos personales serán anonimizados y su cuenta será desactivada permanentemente.
          Los datos de las organizaciones a las que pertenece no serán afectados.
        </p>
        <button
          onClick={() => setShowDeleteModal(true)}
          style={{
            padding: '10px 20px',
            background: '#fff',
            color: '#dc2626',
            border: '1px solid #fecaca',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 500
          }}
        >
          Solicitar Eliminación de Cuenta
        </button>
      </div>

      {/* Opposition Modal */}
      {showOpposeModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
          }}
          onClick={() => !opposing && setShowOpposeModal(false)}
        >
          <div
            style={{
              background: '#fff', borderRadius: 16, padding: 32,
              maxWidth: 480, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
              Oposición al Tratamiento de Datos
            </h3>
            <p style={{ fontSize: 14, color: '#4b5563', marginBottom: 4 }}>
              Propósito: <strong>{PURPOSE_LABELS[opposePurpose]?.label || opposePurpose}</strong>
            </p>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16, lineHeight: 1.5 }}>
              Conforme a la Ley 21.719, tiene derecho a oponerse al tratamiento de sus datos para
              este propósito. Por favor, indique su justificación. Esta solicitud será registrada
              formalmente y el tratamiento será suspendido inmediatamente.
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: '#374151', fontWeight: 500, display: 'block', marginBottom: 6 }}>
                Justificación *
              </label>
              <textarea
                value={opposeReason}
                onChange={(e) => setOpposeReason(e.target.value)}
                placeholder="Explique por qué se opone al tratamiento de sus datos para este propósito..."
                rows={4}
                style={{
                  width: '100%', padding: '10px 12px', border: '1px solid #d1d5db',
                  borderRadius: 8, fontSize: 14, resize: 'vertical', boxSizing: 'border-box'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowOpposeModal(false)}
                disabled={opposing}
                style={{
                  padding: '10px 20px', background: '#fff', color: '#374151',
                  border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer', fontSize: 14
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleOppose}
                disabled={opposing || opposeReason.trim().length < 5}
                style={{
                  padding: '10px 20px', background: '#dc2626', color: '#fff',
                  border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
                  cursor: (opposing || opposeReason.trim().length < 5) ? 'not-allowed' : 'pointer',
                  opacity: (opposing || opposeReason.trim().length < 5) ? 0.6 : 1
                }}
              >
                {opposing ? 'Registrando...' : 'Confirmar Oposición'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
          }}
          onClick={() => !deleting && setShowDeleteModal(false)}
        >
          <div
            style={{
              background: '#fff', borderRadius: 16, padding: 32,
              maxWidth: 480, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>
              Confirmar Eliminación de Cuenta
            </h3>
            <p style={{ fontSize: 14, color: '#4b5563', marginBottom: 16, lineHeight: 1.6 }}>
              Esta acción <strong>no se puede deshacer</strong>. Sus datos personales serán anonimizados,
              sus consentimientos eliminados y su cuenta será desactivada permanentemente.
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: '#374151', fontWeight: 500, display: 'block', marginBottom: 6 }}>
                Motivo (opcional)
              </label>
              <textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="¿Por qué desea eliminar su cuenta?"
                rows={3}
                style={{
                  width: '100%', padding: '10px 12px', border: '1px solid #d1d5db',
                  borderRadius: 8, fontSize: 14, resize: 'vertical', boxSizing: 'border-box'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                style={{
                  padding: '10px 20px', background: '#fff', color: '#374151',
                  border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer', fontSize: 14
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                style={{
                  padding: '10px 20px', background: '#dc2626', color: '#fff',
                  border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.6 : 1
                }}
              >
                {deleting ? 'Eliminando...' : 'Eliminar Mi Cuenta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
