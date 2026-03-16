import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { apiService } from '@services/ApiService.js';
import { formatDate } from '../../utils/formatters';

const CARGO_COLORS = {
  presidente: '#1e40af', president: '#1e40af',
  vicepresidente: '#7c3aed', vicePresident: '#7c3aed',
  secretario: '#059669', secretary: '#059669',
  tesorero: '#d97706', treasurer: '#d97706'
};
const DEFAULT_COLOR = '#6b7280';

const CARGO_LABELS = {
  president: 'Presidente/a', presidente: 'Presidente/a',
  vicePresident: 'Vicepresidente/a', vicepresidente: 'Vicepresidente/a',
  secretary: 'Secretario/a', secretario: 'Secretario/a',
  treasurer: 'Tesorero/a', tesorero: 'Tesorero/a'
};

const REASON_LABELS = {
  RENUNCIA: 'Renuncia',
  FALLECIMIENTO: 'Fallecimiento',
  EXCLUSION: 'Exclusión'
};

function getMemberName(member) {
  if (!member) return null;
  return `${member.firstName || member.name || ''} ${member.lastName || ''}`.trim() || null;
}

function buildDirectorioList(dir) {
  if (!dir) return [];

  const list = [];

  const fixedCargos = [
    { key: 'president', cargoId: 'presidente', orden: 1 },
    { key: 'vicePresident', cargoId: 'vicepresidente', orden: 2 },
    { key: 'secretary', cargoId: 'secretario', orden: 3 },
    { key: 'treasurer', cargoId: 'tesorero', orden: 4 }
  ];

  fixedCargos.forEach(({ key, cargoId, orden }) => {
    if (dir[key]) {
      list.push({
        ...dir[key],
        cargoId,
        cargoKey: key,
        cargoNombre: CARGO_LABELS[cargoId] || cargoId,
        color: CARGO_COLORS[cargoId] || DEFAULT_COLOR,
        orden,
        isTitular: true
      });
    }
  });

  (dir.additionalMembers || []).forEach((m, i) => {
    if (m) {
      const cargoId = m.cargo || m.cargoId || `director_${i + 1}`;
      list.push({
        ...m,
        cargoId,
        cargoKey: 'additionalMember',
        cargoNombre: m.cargoNombre || CARGO_LABELS[cargoId] || m.cargo || `Director/a ${i + 1}`,
        color: CARGO_COLORS[cargoId] || DEFAULT_COLOR,
        orden: m.orden || 5 + i,
        isTitular: false
      });
    }
  });

  return list.sort((a, b) => (a.orden || 99) - (b.orden || 99));
}

export default function OrgDirectorio({ org, onRefresh }) {
  const dir = org?.provisionalDirectorio;
  const { user } = useAuthStore();
  const canManage = user?.role === 'MUNICIPALIDAD' || org?.userId === user?._id;
  const [resignationTarget, setResignationTarget] = useState(null);

  if (!dir) {
    return (
      <div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>
        <p style={{ fontSize: 16 }}>No hay directorio configurado</p>
      </div>
    );
  }

  const dirType = dir.type === 'ELECTO' ? 'Electo' : 'Provisorio';
  const members = buildDirectorioList(dir);

  // Get suplentes (additionalMembers) for the successor dropdown
  const suplentes = (dir.additionalMembers || []).filter(m => m && m.rut);

  // Deadline calculation (3 years renewal cycle)
  const elections = (org.assemblies || []).filter(
    (a) => a.status === 'finalizada' && a.agendaItems?.some((item) => item.type === 'eleccion_directorio')
  );
  let lastElectionDate = null;
  if (elections.length > 0) {
    lastElectionDate = elections.reduce((latest, e) => {
      const d = new Date(e.date);
      return d > latest ? d : latest;
    }, new Date(0));
  }
  const constitutionDate = org.statusHistory?.find((s) => s.status === 'constituida')?.date;
  const referenceDate = lastElectionDate || (constitutionDate ? new Date(constitutionDate) : (org.createdAt ? new Date(org.createdAt) : null));

  let deadline = null;
  let daysLeft = null;
  if (referenceDate) {
    deadline = new Date(referenceDate);
    deadline.setFullYear(deadline.getFullYear() + 3);
    daysLeft = Math.ceil((deadline - new Date()) / (1000 * 60 * 60 * 24));
  }

  return (
    <div>
      <div className="r-toolbar" style={{ marginBottom: 16 }}>
        <h3 className="r-page-title" style={{ fontSize: 18, fontWeight: 600, color: '#111827', margin: 0 }}>Directorio</h3>
        <span style={{
          padding: '4px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
          background: dirType === 'Electo' ? '#d1fae5' : '#fef3c7',
          color: dirType === 'Electo' ? '#065f46' : '#92400e'
        }}>
          {dirType}
        </span>
      </div>

      {/* Info panel */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: 16, marginBottom: 16, fontSize: 13, color: '#1e40af' }}>
        {dirType === 'Provisorio'
          ? 'El directorio provisorio será reemplazado por uno definitivo tras la primera elección.'
          : 'El directorio electo se renueva cada 3 años. Los miembros pueden ser reelectos por períodos sucesivos.'}
        {lastElectionDate && (
          <span style={{ display: 'block', marginTop: 4 }}>
            Última elección: {formatDate(lastElectionDate.toISOString())}
          </span>
        )}
      </div>

      {/* Deadline alert */}
      {deadline && daysLeft !== null && (
        <div style={{
          background: daysLeft < 0 ? '#fee2e2' : daysLeft < 180 ? '#fef3c7' : '#d1fae5',
          border: `1px solid ${daysLeft < 0 ? '#fca5a5' : daysLeft < 180 ? '#fde68a' : '#bbf7d0'}`,
          borderRadius: 12, padding: 16, marginBottom: 24
        }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: daysLeft < 0 ? '#ef4444' : daysLeft < 180 ? '#d97706' : '#059669', marginBottom: 4 }}>
            {daysLeft < 0 ? 'Renovación Vencida' : daysLeft < 180 ? 'Renovación Próxima' : 'Renovación al Día'}
          </div>
          <div style={{ fontSize: 13, color: '#374151' }}>
            Fecha de renovación: {formatDate(deadline.toISOString())}
            {daysLeft < 0
              ? ` (Vencido hace ${Math.abs(daysLeft)} días)`
              : ` (${daysLeft} días restantes)`}
          </div>
        </div>
      )}

      {/* Director cards */}
      {members.length === 0 ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: 24 }}>No hay miembros asignados al directorio</p>
      ) : (
        <div className="r-grid-auto">
          {members.map((m, i) => (
            <DirectorCard
              key={m.cargoId || i}
              member={m}
              canManage={canManage}
              onResign={() => setResignationTarget(m)}
            />
          ))}
        </div>
      )}

      {/* Historic records */}
      {org.directorioHistorico?.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h4 style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Historial de Salidas</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {org.directorioHistorico.map((h, i) => (
              <div key={i} style={{
                background: 'white', border: '1px solid #e5e7eb', borderRadius: 10,
                padding: '12px 16px', fontSize: 13
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <span style={{ fontWeight: 600, color: '#111827' }}>{h.firstName} {h.lastName}</span>
                    <span style={{ color: '#6b7280', marginLeft: 8 }}>({h.cargo})</span>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 12,
                    background: h.reason === 'RENUNCIA' ? '#fef3c7' : h.reason === 'FALLECIMIENTO' ? '#fee2e2' : '#fce7f3',
                    color: h.reason === 'RENUNCIA' ? '#92400e' : h.reason === 'FALLECIMIENTO' ? '#991b1b' : '#9d174d'
                  }}>
                    {REASON_LABELS[h.reason] || h.reason}
                  </span>
                </div>
                <div style={{ color: '#6b7280', marginTop: 4 }}>
                  {h.exitDate && <span>Fecha: {formatDate(h.exitDate)} · </span>}
                  {h.replacedBy?.rut && <span>Reemplazado por: {h.replacedBy.firstName} {h.replacedBy.lastName}</span>}
                  {!h.replacedBy?.rut && <span>Cargo dejado vacante</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resignation Modal */}
      {resignationTarget && (
        <ResignationModal
          org={org}
          member={resignationTarget}
          suplentes={suplentes.filter(s => s.rut !== resignationTarget.rut)}
          onClose={() => setResignationTarget(null)}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}

function DirectorCard({ member, canManage, onResign }) {
  const name = getMemberName(member);
  const initial = name ? name[0].toUpperCase() : '?';
  const color = member.color || DEFAULT_COLOR;

  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: name ? color : '#d1d5db', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, fontWeight: 700, flexShrink: 0
        }}>
          {initial}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: color, fontWeight: 600, marginBottom: 2 }}>
            {member.cargoNombre}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: name ? '#111827' : '#9ca3af' }}>
            {name || 'Sin asignar'}
          </div>
          {member.rut && <div style={{ fontSize: 12, color: '#6b7280' }}>{member.rut}</div>}
        </div>
        {canManage && name && (
          <button
            onClick={onResign}
            title="Registrar Salida / Renuncia"
            style={{
              background: 'none', border: '1px solid #e5e7eb', borderRadius: 8,
              padding: '6px 8px', cursor: 'pointer', color: '#6b7280', flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 4, fontSize: 12
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#6b7280'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span className="r-hide-mobile">Salida</span>
          </button>
        )}
      </div>
    </div>
  );
}

function ResignationModal({ org, member, suplentes, onClose, onRefresh }) {
  const [reason, setReason] = useState('RENUNCIA');
  const [exitDate, setExitDate] = useState(new Date().toISOString().split('T')[0]);
  const [documentUrl, setDocumentUrl] = useState('');
  const [rutIn, setRutIn] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const memberName = getMemberName(member) || 'Miembro';

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      await apiService.registerDirectorioResignation(org._id, {
        rutOut: member.rut,
        reason,
        exitDate,
        documentUrl: documentUrl.trim(),
        rutIn: rutIn || ''
      });
      if (onRefresh) await onRefresh();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Error al registrar la salida');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, padding: 16
      }}
    >
      <div style={{
        background: 'white', borderRadius: 16, width: '100%', maxWidth: 480,
        maxHeight: '90vh', overflow: 'auto', padding: 28
      }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
          Registrar Salida
        </h3>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
          {memberName} — {member.cargoNombre}
        </p>

        {error && (
          <div style={{
            background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8,
            padding: '8px 12px', marginBottom: 16, fontSize: 13, color: '#991b1b'
          }}>
            {error}
          </div>
        )}

        {/* Reason */}
        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Motivo de salida</span>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px', border: '1px solid #d1d5db',
              borderRadius: 8, fontSize: 14, background: 'white', boxSizing: 'border-box'
            }}
          >
            <option value="RENUNCIA">Renuncia</option>
            <option value="FALLECIMIENTO">Fallecimiento</option>
            <option value="EXCLUSION">Exclusión</option>
          </select>
        </label>

        {/* Exit Date */}
        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Fecha de salida</span>
          <input
            type="date"
            value={exitDate}
            onChange={(e) => setExitDate(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px', border: '1px solid #d1d5db',
              borderRadius: 8, fontSize: 14, boxSizing: 'border-box'
            }}
          />
        </label>

        {/* Document URL */}
        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Documento de respaldo (URL)</span>
          <input
            type="url"
            value={documentUrl}
            onChange={(e) => setDocumentUrl(e.target.value)}
            placeholder="https://drive.google.com/..."
            style={{
              width: '100%', padding: '10px 12px', border: '1px solid #d1d5db',
              borderRadius: 8, fontSize: 14, boxSizing: 'border-box'
            }}
          />
          <span style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, display: 'block' }}>Opcional. Enlace al documento que respalda la salida.</span>
        </label>

        {/* Successor */}
        <label style={{ display: 'block', marginBottom: 24 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Sucesión</span>
          <select
            value={rutIn}
            onChange={(e) => setRutIn(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px', border: '1px solid #d1d5db',
              borderRadius: 8, fontSize: 14, background: 'white', boxSizing: 'border-box'
            }}
          >
            <option value="">Dejar cargo vacante</option>
            {suplentes.map((s) => (
              <option key={s.rut} value={s.rut}>
                {getMemberName(s) || s.rut} — {s.cargoNombre || s.cargo || 'Suplente'}
              </option>
            ))}
          </select>
          <span style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, display: 'block' }}>
            {suplentes.length === 0
              ? 'No hay miembros adicionales disponibles para asumir el cargo.'
              : 'Seleccione un miembro adicional del directorio para asumir el cargo, o deje vacante.'}
          </span>
        </label>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              padding: '10px 20px', background: '#f3f4f6', border: 'none',
              borderRadius: 8, fontSize: 14, cursor: 'pointer', color: '#374151'
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{
              padding: '10px 20px', background: '#ef4444', color: 'white', border: 'none',
              borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
              opacity: saving ? 0.6 : 1
            }}
          >
            {saving ? 'Guardando...' : 'Confirmar Salida'}
          </button>
        </div>
      </div>
    </div>
  );
}
