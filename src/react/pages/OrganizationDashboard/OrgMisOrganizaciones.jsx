import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '@services/ApiService.js';

const STATUS_CONFIG = {
  DRAFT: { label: 'Borrador', color: '#6b7280', bg: '#f3f4f6' },
  PENDING_REVIEW: { label: 'Pendiente', color: '#d97706', bg: '#fef3c7' },
  IN_REVIEW: { label: 'En Revisión', color: '#2563eb', bg: '#dbeafe' },
  PENDING_CIVIL_REGISTRY: { label: 'Registro Civil', color: '#7c3aed', bg: '#ede9fe' },
  REJECTED: { label: 'Rechazada', color: '#dc2626', bg: '#fee2e2' },
  APPROVED: { label: 'Aprobada', color: '#059669', bg: '#d1fae5' },
  ACTIVE: { label: 'Activa', color: '#059669', bg: '#d1fae5' },
};

const PROGRESS_STEPS = ['Enviada', 'En Revisión', 'Registro Civil', 'Aprobada'];

function getProgressIndex(status) {
  switch (status) {
    case 'PENDING_REVIEW': return 0;
    case 'IN_REVIEW': return 1;
    case 'PENDING_CIVIL_REGISTRY': return 2;
    case 'APPROVED': case 'ACTIVE': return 3;
    default: return -1;
  }
}

function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.DRAFT;
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
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState(() => getWizardDraft());

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

  // Filter non-approved orgs
  const pendingOrgs = orgs.filter(o =>
    o.status && !['APPROVED', 'ACTIVE'].includes(o.status)
  );

  const approvedOrgs = orgs.filter(o =>
    o.status && ['APPROVED', 'ACTIVE'].includes(o.status)
  );

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

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111827' }}>
            Mis Organizaciones
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#6b7280' }}>
            Gestiona tus organizaciones y crea nuevas
          </p>
        </div>
        <button
          onClick={() => navigate('/wizard')}
          style={{
            padding: '10px 20px',
            background: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.target.style.background = '#1d4ed8'}
          onMouseLeave={e => e.target.style.background = '#2563eb'}
        >
          + Crear Nueva Organización
        </button>
      </div>

      {/* Local Draft */}
      {draft && (
        <div style={{
          marginBottom: 24, background: '#fefce8', borderRadius: 12,
          border: '2px dashed #d97706', padding: 20,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
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
              <button
                onClick={() => {
                  localStorage.removeItem('wizard_progress');
                  setDraft(null);
                }}
                style={{
                  padding: '8px 16px', borderRadius: 8,
                  background: 'white', color: '#6b7280',
                  border: '1px solid #d1d5db', fontSize: 13, cursor: 'pointer',
                }}
              >
                Descartar
              </button>
              <button
                onClick={() => navigate('/wizard')}
                style={{
                  padding: '8px 16px', borderRadius: 8,
                  background: '#d97706', color: 'white',
                  border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
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
            {pendingOrgs.map(org => (
              <div key={org._id} style={{
                background: 'white',
                borderRadius: 12,
                border: '1px solid #e5e7eb',
                padding: 20,
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#111827' }}>
                        {org.organizationName || 'Sin nombre'}
                      </h4>
                      <StatusBadge status={org.status} />
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#6b7280' }}>
                      {org.organizationType && (
                        <span>{org.organizationType}</span>
                      )}
                      {org.createdAt && (
                        <span>Creada: {new Date(org.createdAt).toLocaleDateString('es-CL')}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {org.status === 'DRAFT' && (
                      <button
                        onClick={() => navigate(`/wizard/${org._id}`)}
                        style={{
                          padding: '8px 16px', borderRadius: 8,
                          background: '#2563eb', color: 'white',
                          border: 'none', fontSize: 13, fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        Continuar
                      </button>
                    )}
                  </div>
                </div>
                <ProgressTracker status={org.status} />
                <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                  {PROGRESS_STEPS.map((step, i) => {
                    const idx = getProgressIndex(org.status);
                    return (
                      <span key={step} style={{
                        flex: 1, textAlign: 'center',
                        fontSize: 11, color: i <= idx ? '#2563eb' : '#9ca3af',
                        fontWeight: i === idx ? 600 : 400,
                      }}>
                        {step}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
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
                background: 'white',
                borderRadius: 12,
                border: '1px solid #e5e7eb',
                padding: 16,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>🏢</span>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#111827' }}>
                      {org.organizationName}
                    </h4>
                    <StatusBadge status={org.status} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {orgs.length === 0 && !draft && (
        <div style={{
          background: 'white',
          borderRadius: 16,
          border: '1px solid #e5e7eb',
          padding: 60,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏠</div>
          <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600, color: '#111827' }}>
            No tienes organizaciones
          </h3>
          <p style={{ margin: '0 0 24px', color: '#6b7280', fontSize: 15 }}>
            Crea tu primera organización comunitaria para comenzar
          </p>
          <button
            onClick={() => navigate('/wizard')}
            style={{
              padding: '12px 28px',
              background: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Crear Organización
          </button>
        </div>
      )}
    </div>
  );
}
