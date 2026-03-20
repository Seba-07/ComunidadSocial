import { useState } from 'react';
import StatusBadge from '../../components/ui/StatusBadge';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { apiService } from '@services/ApiService.js';
import { pdfService } from '@services/PDFService.js';
import { formatDate } from '../../utils/formatters';

const TYPE_LABELS = {
  // Territoriales
  JUNTA_VECINOS: 'Junta de Vecinos',
  COMITE_VECINOS: 'Comité de Vecinos',
  // Clubes
  CLUB_DEPORTIVO: 'Club Deportivo',
  CLUB_ADULTO_MAYOR: 'Club de Adulto Mayor',
  CLUB_JUVENIL: 'Club Juvenil',
  CLUB_CULTURAL: 'Club Cultural',
  // Centros
  CENTRO_MADRES: 'Centro de Madres',
  CENTRO_PADRES: 'Centro de Padres',
  CENTRO_CULTURAL: 'Centro Cultural',
  // Agrupaciones
  AGRUPACION_FOLCLORICA: 'Agrupación Folclórica',
  AGRUPACION_CULTURAL: 'Agrupación Cultural',
  AGRUPACION_JUVENIL: 'Agrupación Juvenil',
  AGRUPACION_AMBIENTAL: 'Agrupación Ambiental',
  AGRUPACION_EMPRENDEDORES: 'Agrupación de Emprendedores',
  // Comités
  COMITE_VIVIENDA: 'Comité de Vivienda',
  COMITE_ALLEGADOS: 'Comité de Allegados',
  COMITE_APR: 'Comité APR',
  COMITE_ADELANTO: 'Comité de Adelanto',
  COMITE_MEJORAMIENTO: 'Comité de Mejoramiento',
  COMITE_CONVIVENCIA: 'Comité de Convivencia',
  // Organizaciones específicas
  ORG_SCOUT: 'Organización Scout',
  ORG_MUJERES: 'Organización de Mujeres',
  ORG_INDIGENA: 'Organización Indígena',
  ORG_SALUD: 'Organización de Salud',
  ORG_SOCIAL: 'Organización Social',
  ORG_CULTURAL: 'Organización Cultural',
  // Arte y cultura
  GRUPO_TEATRO: 'Grupo de Teatro',
  CORO: 'Coro',
  TALLER_ARTESANIA: 'Taller de Artesanía',
  // Genéricos
  ORG_COMUNITARIA: 'Organización Comunitaria',
  ORG_FUNCIONAL: 'Organización Funcional',
  OTRA_FUNCIONAL: 'Otra Funcional',
  // Registro extralegal
  CONDOMINIO: 'Condominio',
  FUNDACION: 'Fundación',
  CORPORACION: 'Corporación'
};

function prettifyType(type) {
  if (!type) return '—';
  return TYPE_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).replace(/\bOrg\b/i, 'Organización').replace(/\bApr\b/i, 'APR');
}

const QUORUM_MINIMUMS = { JUNTA_VECINOS: 50 };
const DEFAULT_MINIMUM = 15;
function getMinMembers(orgType) { return QUORUM_MINIMUMS[orgType] || DEFAULT_MINIMUM; }

const ALERT_STYLES = {
  red: { bg: '#fef2f2', border: '#fca5a5', color: '#991b1b', iconBg: '#fee2e2', btnBg: '#dc2626' },
  orange: { bg: '#fffbeb', border: '#fde68a', color: '#92400e', iconBg: '#fef3c7', btnBg: '#d97706' },
  blue: { bg: '#eff6ff', border: '#bfdbfe', color: '#1e40af', iconBg: '#dbeafe', btnBg: '#2563eb' },
};

function buildAlerts(org) {
  const alerts = [];
  const now = new Date();

  // 1. Vigencia de Directiva
  if (org.boardExpirationDate) {
    const daysLeft = Math.ceil((new Date(org.boardExpirationDate) - now) / (1000 * 60 * 60 * 24));
    const dateStr = new Date(org.boardExpirationDate).toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });
    if (daysLeft <= 0) {
      alerts.push({
        severity: 'red', icon: '\u26A0\uFE0F',
        title: 'Directiva Vencida',
        description: `El mandato venció el ${dateStr}. Inicie el proceso electoral de renovación de directorio de inmediato.`,
        actionLabel: 'Ir a Elecciones', actionTab: 'elecciones'
      });
    } else if (daysLeft <= 90) {
      alerts.push({
        severity: daysLeft <= 30 ? 'red' : 'orange', icon: '\u23F3',
        title: `Directiva vence en ${daysLeft} días`,
        description: `El mandato de la directiva vence el ${dateStr}. Planifique la renovación con anticipación.`,
        actionLabel: 'Ir a Elecciones', actionTab: 'elecciones'
      });
    }
  }

  // 2. Asambleas sin acta
  const assemblies = org.assemblies || [];
  const orphanAssemblies = assemblies.filter(a =>
    (a.status === 'finalizada' && (!a.actDocument || !a.actDocument.fileName))
  );
  if (orphanAssemblies.length > 0) {
    const titles = orphanAssemblies.slice(0, 2).map(a => `"${a.title}"`).join(', ');
    const extra = orphanAssemblies.length > 2 ? ` y ${orphanAssemblies.length - 2} más` : '';
    alerts.push({
      severity: 'orange', icon: '\uD83D\uDCCB',
      title: `${orphanAssemblies.length} asamblea${orphanAssemblies.length > 1 ? 's' : ''} sin acta`,
      description: `${titles}${extra}: Suba el documento firmado para legalizar los acuerdos adoptados.`,
      actionLabel: 'Ir a Asambleas', actionTab: 'asambleas'
    });
  }

  // 3. Rendición de subvenciones pendiente
  const finances = org.finances || [];
  const subIngreso = finances.filter(f => f.fundSource === 'SUBVENCION_MUNICIPAL' && f.amount > 0);
  const subEgreso = finances.filter(f => f.fundSource === 'SUBVENCION_MUNICIPAL' && f.amount < 0);
  if (subIngreso.length > 0) {
    const totalIngreso = subIngreso.reduce((s, t) => s + t.amount, 0);
    const totalEgreso = subEgreso.reduce((s, t) => s + Math.abs(t.amount), 0);
    const sinRef = subEgreso.filter(f => !f.documentRef);
    const saldoPendiente = totalIngreso - totalEgreso;

    if (sinRef.length > 0 || saldoPendiente > 0) {
      const issues = [];
      if (sinRef.length > 0) issues.push(`${sinRef.length} egreso${sinRef.length > 1 ? 's' : ''} sin referencia de documento`);
      if (saldoPendiente > 0) issues.push(`saldo de subvención pendiente por rendir: $${saldoPendiente.toLocaleString('es-CL')}`);
      alerts.push({
        severity: 'orange', icon: '\uD83D\uDCB0',
        title: 'Rendición de Cuentas Pendiente',
        description: `Subvenciones municipales: ${issues.join('; ')}. Complete la documentación de respaldo.`,
        actionLabel: 'Ir a Finanzas', actionTab: 'finanzas'
      });
    }
  }

  // 4. Baja participación histórica
  const finalized = assemblies.filter(a => a.status === 'finalizada').slice(-3);
  if (finalized.length >= 2) {
    const totalMembers = (org.members || []).filter(m => m.status !== 'inactive').length;
    if (totalMembers > 0) {
      const avgAttendance = finalized.reduce((s, a) => s + (a.attendees?.length || 0), 0) / finalized.length;
      const pct = (avgAttendance / totalMembers) * 100;
      if (pct < 25) {
        alerts.push({
          severity: 'blue', icon: '\uD83D\uDCC9',
          title: 'Baja participación detectada',
          description: `Promedio de asistencia: ${Math.round(pct)}% en las últimas ${finalized.length} asambleas. Considere estrategias de convocatoria para asegurar el quórum.`,
          actionLabel: 'Ver Asambleas', actionTab: 'asambleas'
        });
      }
    }
  }

  return alerts;
}

function AlertCard({ alert, onAction }) {
  const s = ALERT_STYLES[alert.severity] || ALERT_STYLES.orange;
  return (
    <div style={{
      background: s.bg, border: `2px solid ${s.border}`, borderRadius: 12,
      padding: 16, display: 'flex', alignItems: 'flex-start', gap: 12
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, background: s.iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, flexShrink: 0
      }}>
        {alert.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: s.color, marginBottom: 4 }}>{alert.title}</div>
        <p style={{ margin: 0, fontSize: 13, color: s.color, lineHeight: 1.5, opacity: 0.9 }}>{alert.description}</p>
        {alert.actionLabel && (
          <button onClick={() => onAction(alert.actionTab)}
            style={{ marginTop: 10, padding: '6px 16px', fontSize: 12, fontWeight: 600, background: s.btnBg, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
            {alert.actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export default function OrgOverview({ org, onNavigateTab, onRefresh }) {
  if (!org) return null;

  const { user } = useAuthStore();
  const addToast = useUiStore(s => s.addToast);
  const canEdit = user?.role === 'MUNICIPALIDAD' || org.userId === user?._id;
  const memberCount = org.members?.length || 0;
  const activeCount = (org.members || []).filter(m => m.status !== 'inactive').length;
  const assemblyCount = org.assemblies?.length || 0;
  const minRequired = getMinMembers(org.organizationType);
  const quorumMet = activeCount >= minRequired;
  const [showDissolve, setShowDissolve] = useState(false);
  const [dissolveReason, setDissolveReason] = useState('');
  const [dissolving, setDissolving] = useState(false);

  // Active assemblies alert
  const activeAssemblies = (org.assemblies || []).filter(
    (a) => a.status === 'convocada' || a.status === 'en_curso'
  );

  // ============ ALERTAS DE GESTIÓN ============
  const alerts = buildAlerts(org);

  return (
    <div>
      {/* Alertas de Gestión */}
      {alerts.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            Alertas de Gestión
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: '#fef2f2', color: '#dc2626' }}>{alerts.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {alerts.map((alert, i) => (
              <AlertCard key={i} alert={alert} onAction={(tab) => onNavigateTab(tab)} />
            ))}
          </div>
        </div>
      )}

      {/* Asambleas activas */}
      {activeAssemblies.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          {activeAssemblies.map((a) => (
            <div key={a.id || a._id} style={{
              background: a.status === 'en_curso' ? '#d1fae5' : '#dbeafe',
              border: `1px solid ${a.status === 'en_curso' ? '#10b981' : '#3b82f6'}`,
              borderRadius: 12, padding: 16, marginBottom: 8,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap'
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <span style={{ fontWeight: 600, color: a.status === 'en_curso' ? '#065f46' : '#1e40af', wordBreak: 'break-word' }}>{a.title}</span>
                <span style={{ marginLeft: 8, fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>{formatDate(a.date)}</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20, color: 'white', background: a.status === 'en_curso' ? '#10b981' : '#3b82f6' }}>
                {a.status === 'en_curso' ? 'En Curso' : 'Convocada'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Stats Grid */}
      <div className="r-grid-2" style={{ marginBottom: 32 }}>
        <StatCard label="Socios" value={memberCount} color="#3b82f6" onClick={() => onNavigateTab('members')} />
        <StatCard label="Asambleas" value={assemblyCount} color="#8b5cf6" onClick={() => onNavigateTab('asambleas')} />
      </div>

      {/* Organization Info */}
      <div className="r-card" style={{ background: 'white', border: '1px solid #e5e7eb', marginBottom: 24 }}>
        <h3 className="r-page-title" style={{ fontSize: 18, fontWeight: 600, color: '#1e3a8a', marginBottom: 16 }}>Información de la Organización</h3>
        <div className="r-grid-2">
          <InfoRow label="Nombre" value={org.organizationName} />
          <InfoRow label="Tipo" value={prettifyType(org.organizationType)} />
          <InfoRow label="Estado"><StatusBadge status={org.status} /></InfoRow>
          <InfoRow label="Dirección" value={org.address} />
          <InfoRow label="Comuna" value={org.comuna} />
          <InfoRow label="Unidad Vecinal" value={org.unidadVecinal} />
          {org.description && <InfoRow label="Descripción" value={org.description} />}
        </div>
      </div>

      {/* Legacy Drive Link */}
      <LegacyDriveSection orgId={org._id} link={org.legacyDriveLink} canEdit={canEdit} onRefresh={onRefresh} />

      {/* Directorio Summary */}
      {org.provisionalDirectorio && (
        <div className="r-card" style={{ background: 'white', border: '1px solid #e5e7eb' }}>
          <h3 className="r-page-title" style={{ fontSize: 18, fontWeight: 600, color: '#1e3a8a', marginBottom: 16 }}>
            Directorio {org.provisionalDirectorio.type === 'ELECTO' ? 'Electo' : 'Provisorio'}
          </h3>
          <div className="r-grid-2">
            <DirMember label="Presidente" member={org.provisionalDirectorio.president} />
            <DirMember label="Vicepresidente" member={org.provisionalDirectorio.vicePresident} />
            <DirMember label="Secretario" member={org.provisionalDirectorio.secretary} />
            <DirMember label="Tesorero" member={org.provisionalDirectorio.treasurer} />
          </div>
        </div>
      )}

      {/* Quorum Alert */}
      {org.status === 'approved' && !quorumMet && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 16, marginTop: 24 }}>
          <div style={{ fontWeight: 700, color: '#991b1b', fontSize: 15, marginBottom: 6 }}>
            Quórum Insuficiente
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#991b1b', lineHeight: 1.5 }}>
            La organización tiene <strong>{activeCount}</strong> socios activos pero necesita al menos <strong>{minRequired}</strong> para operar legalmente{org.organizationType === 'JUNTA_VECINOS' ? ' (Art. 40, Ley 19.418)' : ''}.
            Si esta situación persiste, la organización podría ser disuelta.
          </p>
        </div>
      )}

      {/* Dissolution (only for org owner/admin, only for approved orgs) */}
      {canEdit && org.status === 'approved' && (
        <div style={{ marginTop: 32, borderTop: '1px solid #e5e7eb', paddingTop: 24 }}>
          <details style={{ cursor: 'pointer' }}>
            <summary style={{ fontSize: 14, fontWeight: 600, color: '#6b7280', userSelect: 'none' }}>
              Disolver Organización
            </summary>
            <div style={{ marginTop: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 20 }}>
              <p style={{ fontSize: 13, color: '#991b1b', margin: '0 0 12px', lineHeight: 1.5 }}>
                La disolución es <strong>irreversible</strong>. Los bienes se transferirán a: <strong>{org.config?.beneficiarioDisolucion || 'No configurado'}</strong>.
              </p>
              <button onClick={() => setShowDissolve(true)}
                style={{ padding: '8px 20px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Iniciar Disolución
              </button>
            </div>
          </details>
        </div>
      )}

      {/* Dissolution confirmation modal */}
      {/* Self-service Certificate */}
      {(() => {
        if (!user?.rut) return null;
        const cleanR = (r) => (r || '').replace(/\./g, '').replace(/-/g, '').toUpperCase();
        const myMember = (org.members || []).find(m => cleanR(m.rut) === cleanR(user.rut) && m.status !== 'inactive');
        if (!myMember) return null;
        return (
          <div style={{ background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: 12, padding: 20, marginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#5b21b6' }}>Mi Certificado de Membresía</div>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Descarga tu certificado oficial como socio/a activo/a de esta organización.</div>
              </div>
              <button onClick={async () => {
                try {
                  const res = await apiService.getMemberCertificateData(org._id, myMember.rut);
                  const { organization: certOrg, member: certMember } = res.data;
                  const doc = await pdfService.generateMemberCertificate(certOrg, certMember);
                  doc.save(`certificado_${certMember.firstName}_${certMember.lastName}.pdf`);
                  addToast('Certificado descargado', 'success');
                } catch (err) {
                  addToast(err.message || 'Error al generar certificado', 'error');
                }
              }}
                style={{ padding: '10px 24px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Descargar Certificado
              </button>
            </div>
          </div>
        );
      })()}

      {showDissolve && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowDissolve(false); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, maxWidth: 480, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: '#dc2626' }}>Confirmar Disolución</h3>
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 10, marginBottom: 16, fontSize: 13, color: '#991b1b' }}>
              Esta acción es irreversible. La organización será disuelta y no podrá reactivarse.
            </div>
            {org.config?.beneficiarioDisolucion && (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 10, marginBottom: 16, fontSize: 13, color: '#1e40af' }}>
                <strong>Beneficiario de bienes:</strong> {org.config.beneficiarioDisolucion}
                {org.config.rutDisolucion && ` (RUT: ${org.config.rutDisolucion})`}
              </div>
            )}
            <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Razón de disolución *</label>
            <textarea value={dissolveReason} onChange={e => setDissolveReason(e.target.value)} rows={3}
              placeholder="Ej: Decisión de la asamblea, inactividad prolongada..."
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, resize: 'vertical', marginBottom: 16, boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowDissolve(false); setDissolveReason(''); }}
                style={{ padding: '8px 20px', fontSize: 13, background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={async () => {
                if (!dissolveReason.trim() || dissolveReason.trim().length < 10) {
                  addToast('Razón debe tener al menos 10 caracteres', 'error');
                  return;
                }
                setDissolving(true);
                try {
                  await apiService.dissolveOrganization(org._id, dissolveReason);
                  addToast('Organización disuelta', 'success');
                  setShowDissolve(false);
                  onRefresh();
                } catch (err) {
                  addToast(err.message || 'Error al disolver', 'error');
                } finally {
                  setDissolving(false);
                }
              }} disabled={dissolving}
                style={{ padding: '8px 20px', fontSize: 13, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, cursor: dissolving ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: dissolving ? 0.6 : 1 }}>
                {dissolving ? 'Disolviendo...' : 'Confirmar Disolución'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 20,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.2s'
      }}
      onMouseEnter={(e) => { if (onClick) e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
    >
      <span style={{ fontSize: 13, color: '#6b7280', display: 'block', marginBottom: 4 }}>{label}</span>
      <span style={{ fontSize: 28, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

function InfoRow({ label, value, children }) {
  return (
    <div style={{ padding: '8px 0' }}>
      <span style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 2 }}>{label}</span>
      {children || <span style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>{value || '—'}</span>}
    </div>
  );
}

function LegacyDriveSection({ orgId, link, canEdit, onRefresh }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(link || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiService.updateOrganization(orgId, { legacyDriveLink: value.trim() });
      setEditing(false);
      if (onRefresh) onRefresh();
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  // Show link button if link exists and not editing
  if (link && !editing) {
    return (
      <div className="r-card" style={{ background: 'white', border: '1px solid #e5e7eb', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Carpeta Historica</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', background: '#eff6ff', border: '1px solid #bfdbfe',
                borderRadius: 8, color: '#1d4ed8', fontSize: 13, fontWeight: 600, textDecoration: 'none'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Abrir Carpeta
            </a>
            {canEdit && (
              <button
                onClick={() => { setValue(link); setEditing(true); }}
                style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 12px', fontSize: 13, color: '#6b7280', cursor: 'pointer' }}
              >
                Editar
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show add/edit form
  if (canEdit && (editing || !link)) {
    return (
      <div className="r-card" style={{ background: 'white', border: '1px solid #e5e7eb', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Carpeta Historica</span>
        </div>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 10 }}>
          Enlace a Google Drive, SharePoint u otra carpeta externa con documentos historicos.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="url"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/..."
            style={{
              flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8,
              fontSize: 14, outline: 'none', boxSizing: 'border-box'
            }}
            onFocus={(e) => e.target.style.borderColor = '#2563eb'}
            onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
          />
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none',
              borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap'
            }}
          >
            {saving ? '...' : 'Guardar'}
          </button>
          {editing && (
            <button
              onClick={() => setEditing(false)}
              style={{ padding: '8px 12px', background: '#f3f4f6', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}

function DirMember({ label, member }) {
  const name = member
    ? `${member.firstName || member.name || ''} ${member.lastName || ''}`.trim()
    : 'Sin asignar';
  const initial = name[0]?.toUpperCase() || '?';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 8 }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%', background: member ? '#3b82f6' : '#d1d5db',
        color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, fontWeight: 600
      }}>
        {initial}
      </div>
      <div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 500, color: member ? '#374151' : '#9ca3af' }}>{name}</div>
      </div>
    </div>
  );
}
