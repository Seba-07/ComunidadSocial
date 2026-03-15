import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '@services/ApiService.js';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import OrgSolicitudDetail from './OrgSolicitudDetail';

const STATUS_CONFIG = {
  draft: { label: 'Borrador', color: '#6b7280', bg: '#f3f4f6' },
  waiting_ministro: { label: 'Esperando Ministro de Fe', color: '#f59e0b', bg: '#fef3c7' },
  ministro_scheduled: { label: 'Ministro Agendado', color: '#3b82f6', bg: '#dbeafe' },
  ministro_approved: { label: 'Aprobada por Ministro', color: '#06b6d4', bg: '#ecfeff' },
  pending_review: { label: 'Pendiente de Revisión', color: '#d97706', bg: '#fef3c7' },
  in_review: { label: 'En Revisión', color: '#2563eb', bg: '#dbeafe' },
  sent_registry: { label: 'Registro Civil', color: '#7c3aed', bg: '#ede9fe' },
  registry_observations: { label: 'Observaciones Registro', color: '#ea580c', bg: '#fff7ed' },
  rejected: { label: 'Rechazada', color: '#dc2626', bg: '#fee2e2' },
  approved: { label: 'Aprobada', color: '#059669', bg: '#d1fae5' },
};

const PROGRESS_STEPS = ['Solicitud', 'Ministro de Fe', 'Revisión', 'Registro Civil', 'Aprobada'];

function getProgressIndex(status) {
  switch (status) {
    case 'waiting_ministro': return 0;
    case 'ministro_scheduled': case 'ministro_approved': return 1;
    case 'pending_review': case 'in_review': return 2;
    case 'sent_registry': case 'registry_observations': return 3;
    case 'approved': return 4;
    default: return -1;
  }
}

function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG[(status || '').toLowerCase()] || STATUS_CONFIG.draft;
  return (
    <span style={{
      display: 'inline-block',
      padding: '4px 12px',
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 600,
      color: config.color,
      background: config.bg,
    }}>
      {config.label}
    </span>
  );
}

function ProgressTracker({ status }) {
  const currentIdx = getProgressIndex(status);
  if (currentIdx < 0) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 12 }}>
      {PROGRESS_STEPS.map((step, i) => {
        const isDone = i <= currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <div key={step} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              background: isDone ? '#2563eb' : '#e5e7eb',
              color: isDone ? 'white' : '#9ca3af',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, flexShrink: 0,
              border: isCurrent ? '2px solid #93c5fd' : 'none',
            }}>
              {isDone && i < currentIdx ? '✓' : i + 1}
            </div>
            {i < PROGRESS_STEPS.length - 1 && (
              <div style={{
                flex: 1, height: 2,
                background: i < currentIdx ? '#2563eb' : '#e5e7eb',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

const WIZARD_STEP_LABELS = [
  'Datos Generales', 'Miembros', 'Directorio', 'Estatutos', 'Certificados', 'Acta Constitutiva', 'Revisión'
];

function getWizardDraft() {
  try {
    const raw = localStorage.getItem('wizard_progress');
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Expire after 7 days (same as wizardStore)
    if (data.savedAt && Date.now() - data.savedAt > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem('wizard_progress');
      return null;
    }
    return data;
  } catch { return null; }
}

export default function OrgMisOrganizaciones() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const addToast = useUiStore(s => s.addToast);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState(() => getWizardDraft());
  const [selectedOrgId, setSelectedOrgId] = useState(null);
  const [orgDetail, setOrgDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Check profile completeness
  const missingFields = [];
  if (!user?.firstName) missingFields.push('Nombre');
  if (!user?.lastName) missingFields.push('Apellido');
  if (!user?.phone) missingFields.push('Teléfono');
  if (!user?.address) missingFields.push('Dirección');
  if (!user?.region) missingFields.push('Región');
  if (!user?.commune) missingFields.push('Comuna');
  const profileIncomplete = missingFields.length > 0;

  function handleCreateOrg() {
    if (profileIncomplete) {
      addToast('Completa tus datos personales en Configuración antes de crear una organización', 'error');
      return;
    }
    navigate('/wizard');
  }

  useEffect(() => {
    loadOrgs();
  }, []);

  async function loadOrgs() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getMyOrganizations();
      const list = data.organizations || data || [];
      setOrgs(list);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function openOrgDetail(orgId) {
    setLoadingDetail(true);
    try {
      const data = await apiService.getOrganization(orgId);
      const org = data.organization || data;
      setOrgDetail(org);
      setSelectedOrgId(orgId);
    } catch (err) {
      addToast('Error al cargar detalle de la solicitud', 'error');
    } finally {
      setLoadingDetail(false);
    }
  }

  function handleBackFromDetail() {
    setSelectedOrgId(null);
    setOrgDetail(null);
  }

  function handleRefreshDetail() {
    if (selectedOrgId) openOrgDetail(selectedOrgId);
    loadOrgs();
  }

  const APPROVED = new Set(['approved', 'APPROVED', 'ACTIVE']);
  const pendingOrgs = orgs.filter(o => o.status && !APPROVED.has(o.status));
  const approvedOrgs = orgs.filter(o => o.status && APPROVED.has(o.status));

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ color: '#6b7280', fontSize: 15 }}>Cargando organizaciones...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: '#ef4444', fontSize: 15 }}>Error: {error}</p>
        <button onClick={loadOrgs} style={{
          marginTop: 12, padding: '8px 20px', borderRadius: 8,
          background: '#2563eb', color: 'white', border: 'none',
          fontSize: 14, cursor: 'pointer',
        }}>Reintentar</button>
      </div>
    );
  }

  // If detail view is open, show it instead of the list
  if (selectedOrgId && orgDetail) {
    return <OrgSolicitudDetail org={orgDetail} onBack={handleBackFromDetail} onRefresh={handleRefreshDetail} />;
  }

  return (
    <div>
      {/* Header */}
      <div className="r-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111827' }}>
            Mis Organizaciones
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#6b7280' }}>
            Gestiona tus organizaciones y crea nuevas
          </p>
        </div>
        <button
          onClick={handleCreateOrg}
          style={{
            padding: '10px 20px', background: profileIncomplete ? '#9ca3af' : '#2563eb', color: 'white', border: 'none',
            borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: profileIncomplete ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          + Crear Nueva Organización
        </button>
      </div>

      {/* Profile incomplete warning */}
      {profileIncomplete && (
        <div style={{
          marginBottom: 24, background: '#fef2f2', borderRadius: 12,
          border: '1px solid #fecaca', padding: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap'
        }}>
          <div>
            <div style={{ fontWeight: 600, color: '#991b1b', fontSize: 14, marginBottom: 4 }}>
              Completa tu perfil para crear organizaciones
            </div>
            <p style={{ margin: 0, fontSize: 13, color: '#b91c1c' }}>
              Campos pendientes: {missingFields.join(', ')}
            </p>
          </div>
          <button
            onClick={() => navigate('/app/org/auto', { state: { tab: 'settings' } })}
            style={{
              padding: '8px 16px', background: '#dc2626', color: 'white', border: 'none',
              borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0
            }}
          >
            Ir a Configuración
          </button>
        </div>
      )}

      {/* Local Draft */}
      {draft && (
        <div style={{
          marginBottom: 24, background: '#fefce8', borderRadius: 12,
          border: '2px dashed #d97706', padding: 20,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#111827' }}>
                  {draft.formData?.organization?.organizationName || 'Nueva Organización'}
                </h4>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  color: '#92400e', background: '#fef3c7',
                }}>
                  Borrador local
                </span>
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#6b7280' }}>
                <span>Paso {(draft.currentStep || 0) + 1} de 7: {WIZARD_STEP_LABELS[draft.currentStep || 0]}</span>
                {(draft.formData?.members?.length || 0) > 0 && (
                  <span>{draft.formData.members.length} miembros</span>
                )}
                {draft.savedAt && (
                  <span>Guardado: {new Date(draft.savedAt).toLocaleDateString('es-CL')}</span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { localStorage.removeItem('wizard_progress'); setDraft(null); }}
                style={{ padding: '8px 16px', borderRadius: 8, background: 'white', color: '#6b7280', border: '1px solid #d1d5db', fontSize: 13, cursor: 'pointer' }}>
                Descartar
              </button>
              <button onClick={handleCreateOrg}
                style={{ padding: '8px 16px', borderRadius: 8, background: profileIncomplete ? '#9ca3af' : '#d97706', color: 'white', border: 'none', fontSize: 13, fontWeight: 600, cursor: profileIncomplete ? 'not-allowed' : 'pointer' }}>
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pending Orgs */}
      {pendingOrgs.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 12 }}>
            En Proceso ({pendingOrgs.length})
          </h3>
          <div style={{ display: 'grid', gap: 12 }}>
            {pendingOrgs.map(org => {
              const progressIdx = getProgressIndex(org.status);
              return (
                <div key={org._id}
                  onClick={() => openOrgDetail(org._id)}
                  style={{
                    background: 'white', borderRadius: 12, border: '1px solid #e5e7eb',
                    padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    cursor: 'pointer', transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#93c5fd'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(37,99,235,0.1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 14, flex: 1 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 10, background: 'linear-gradient(135deg, #dbeafe, #eff6ff)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0,
                      }}>
                        🏛️
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                          <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#111827' }}>
                            {org.organizationName || 'Sin nombre'}
                          </h4>
                          <StatusBadge status={org.status} />
                        </div>
                        <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#6b7280', flexWrap: 'wrap' }}>
                          {org.organizationType && <span>{org.organizationType.replace(/_/g, ' ')}</span>}
                          {org.createdAt && <span>Creada: {new Date(org.createdAt).toLocaleDateString('es-CL')}</span>}
                          {org.electionDate && <span>Asamblea: {new Date(org.electionDate).toLocaleDateString('es-CL')}</span>}
                          {(org.members || []).length > 0 && <span>{org.members.length} miembros</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {loadingDetail ? (
                        <span style={{ fontSize: 12, color: '#6b7280' }}>Cargando...</span>
                      ) : (
                        <span style={{ fontSize: 13, color: '#2563eb', fontWeight: 500 }}>Ver detalle →</span>
                      )}
                    </div>
                  </div>

                  {/* Progress */}
                  {progressIdx >= 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                        {PROGRESS_STEPS.map((step, i) => {
                          const isDone = i <= progressIdx;
                          const isCurrent = i === progressIdx;
                          return (
                            <div key={step} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                              <div style={{
                                width: 22, height: 22, borderRadius: '50%',
                                background: isDone ? '#2563eb' : '#e5e7eb',
                                color: isDone ? 'white' : '#9ca3af',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 10, fontWeight: 700, flexShrink: 0,
                                border: isCurrent ? '2px solid #93c5fd' : 'none',
                                boxShadow: isCurrent ? '0 0 0 3px rgba(37,99,235,0.15)' : 'none',
                              }}>
                                {isDone && i < progressIdx ? '✓' : i + 1}
                              </div>
                              {i < PROGRESS_STEPS.length - 1 && (
                                <div style={{ flex: 1, height: 2, background: i < progressIdx ? '#2563eb' : '#e5e7eb' }} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ display: 'flex', gap: 0, marginTop: 4 }}>
                        {PROGRESS_STEPS.map((step, i) => (
                          <span key={step} style={{
                            flex: 1, textAlign: 'center', fontSize: 10,
                            color: i <= progressIdx ? '#2563eb' : '#9ca3af',
                            fontWeight: i === progressIdx ? 600 : 400,
                          }}>{step}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Approved Orgs */}
      {approvedOrgs.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 12 }}>
            Activas ({approvedOrgs.length})
          </h3>
          <div style={{ display: 'grid', gap: 12 }}>
            {approvedOrgs.map(org => (
              <div key={org._id} style={{
                background: 'white', borderRadius: 12, border: '1px solid #e5e7eb',
                padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>🏢</span>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#111827' }}>
                    {org.organizationName}
                  </h4>
                  <StatusBadge status={org.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {orgs.length === 0 && !draft && (
        <div style={{
          background: 'white', borderRadius: 16, border: '1px solid #e5e7eb',
          padding: 60, textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏠</div>
          <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600, color: '#111827' }}>
            No tienes organizaciones
          </h3>
          <p style={{ margin: '0 0 24px', color: '#6b7280', fontSize: 15 }}>
            Crea tu primera organización comunitaria para comenzar
          </p>
          <button onClick={handleCreateOrg}
            style={{ padding: '12px 28px', background: profileIncomplete ? '#9ca3af' : '#2563eb', color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: profileIncomplete ? 'not-allowed' : 'pointer' }}>
            Crear Organización
          </button>
        </div>
      )}
    </div>
  );
}
