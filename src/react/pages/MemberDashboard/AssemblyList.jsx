import { useState } from 'react';
import StatusBadge from '../../components/ui/StatusBadge';
import { formatDate } from '../../utils/formatters';
import VotingPanel from './VotingPanel';
import Modal from '../../components/ui/Modal';

const STATUS_LABELS = {
  draft: 'Borrador',
  convocada: 'Convocada',
  en_curso: 'En Curso',
  finalizada: 'Finalizada',
  cancelada: 'Cancelada'
};

const STATUS_COLORS = {
  draft: '#6b7280',
  convocada: '#3b82f6',
  en_curso: '#10b981',
  finalizada: '#8b5cf6',
  cancelada: '#ef4444'
};

function calcQuorumMet(assembly, org) {
  const attendeeCount = assembly.attendees?.length || 0;
  const quorumValue = assembly.quorumValue ?? 50;
  const quorumType = assembly.quorumType || 'percentage';
  if (quorumType === 'percentage') {
    const totalMembers = org?.members?.length || 0;
    const required = totalMembers > 0 ? Math.ceil(totalMembers * (quorumValue / 100)) : 0;
    return { met: totalMembers > 0 && attendeeCount >= required, required, actual: attendeeCount };
  }
  return { met: attendeeCount >= quorumValue, required: quorumValue, actual: attendeeCount };
}

export default function AssemblyList({ assemblies = [], orgId, org, currentUser, onRefresh }) {
  const [selectedAssembly, setSelectedAssembly] = useState(null);

  const active = assemblies.filter((a) => ['convocada', 'en_curso'].includes(a.status));
  const past = assemblies.filter((a) => ['finalizada', 'cancelada'].includes(a.status));
  const drafts = assemblies.filter((a) => a.status === 'draft');

  return (
    <div>
      <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1e3a8a', marginBottom: 16 }}>Asambleas</h3>

      {active.length > 0 && (
        <Section title="Próximas / En Curso" color="#10b981">
          {active.map((a) => (
            <AssemblyCard key={a.id || a._id} assembly={a} onClick={() => setSelectedAssembly(a)} />
          ))}
        </Section>
      )}

      {past.length > 0 && (
        <Section title="Historial" color="#8b5cf6">
          {past.map((a) => (
            <AssemblyCard key={a.id || a._id} assembly={a} onClick={() => setSelectedAssembly(a)} />
          ))}
        </Section>
      )}

      {drafts.length > 0 && (
        <Section title="Borradores" color="#6b7280">
          {drafts.map((a) => (
            <AssemblyCard key={a.id || a._id} assembly={a} onClick={() => setSelectedAssembly(a)} />
          ))}
        </Section>
      )}

      {assemblies.length === 0 && (
        <p style={{ color: '#6b7280', textAlign: 'center', padding: 48 }}>No hay asambleas registradas</p>
      )}

      <Modal
        open={!!selectedAssembly}
        onClose={() => setSelectedAssembly(null)}
        title={selectedAssembly?.title || 'Detalle de Asamblea'}
      >
        {selectedAssembly && (
          <AssemblyDetail
            assembly={selectedAssembly}
            orgId={orgId}
            org={org}
            currentUser={currentUser}
            onRefresh={onRefresh}
          />
        )}
      </Modal>
    </div>
  );
}

function Section({ title, color, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {children}
      </div>
    </div>
  );
}

function AssemblyCard({ assembly, onClick }) {
  const a = assembly;
  const hasVotingOpen = a.agendaItems?.some((item) => item.votingOpen);
  const color = STATUS_COLORS[a.status] || '#6b7280';

  return (
    <div
      onClick={onClick}
      style={{
        border: '1px solid #e5e7eb',
        borderLeft: `4px solid ${color}`,
        borderRadius: 12,
        padding: 16,
        cursor: 'pointer',
        transition: 'box-shadow 0.2s',
        background: 'white'
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 600, color: '#1e3a8a' }}>{a.title}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {hasVotingOpen && (
            <span style={{ fontSize: 11, fontWeight: 600, color: '#10b981', padding: '2px 8px', background: '#d1fae5', borderRadius: 12 }}>
              Votación Abierta
            </span>
          )}
          <span style={{ fontSize: 12, fontWeight: 600, color, padding: '2px 10px', borderRadius: 12, background: `${color}15` }}>
            {STATUS_LABELS[a.status] || a.status}
          </span>
        </div>
      </div>
      <div style={{ fontSize: 13, color: '#6b7280', display: 'flex', gap: 16 }}>
        <span>{formatDate(a.date)}</span>
        {a.time && <span>{a.time}</span>}
        <span>{a.attendees?.length || 0} asistentes</span>
        <span>{a.agendaItems?.length || 0} puntos</span>
      </div>
    </div>
  );
}

function AssemblyDetail({ assembly, orgId, org, currentUser, onRefresh }) {
  const a = assembly;

  return (
    <div>
      <div className="r-grid-2" style={{ gap: 12, marginBottom: 24 }}>
        <InfoPill label="Estado" value={STATUS_LABELS[a.status] || a.status} />
        <InfoPill label="Tipo" value={a.type === 'ordinaria' ? 'Ordinaria' : 'Extraordinaria'} />
        <InfoPill label="Fecha" value={formatDate(a.date)} />
        <InfoPill label="Asistentes" value={(() => { const q = calcQuorumMet(a, org); return `${q.actual} / ${q.required} ${q.met ? '(Cumplido)' : '(No cumplido)'}`; })()} />
      </div>

      {a.agendaItems?.length > 0 && (
        <div>
          <h4 style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Tabla</h4>
          {a.agendaItems.map((item, idx) => (
            <div key={item.id || idx} style={{ marginBottom: 16, padding: 16, background: '#f9fafb', borderRadius: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>{idx + 1}. {item.title}</div>
              {item.type === 'eleccion_directorio' && item.votingOpen && a.status === 'en_curso' && (
                <VotingPanel
                  agendaItem={item}
                  orgId={orgId}
                  assemblyId={a.id || a._id}
                  currentUser={currentUser}
                  onVoted={onRefresh}
                />
              )}
              {item.result && (
                <div style={{
                  marginTop: 8, fontSize: 13, fontWeight: 500, padding: 8, borderRadius: 8,
                  background: item.result.mode === 'mano_alzada'
                    ? (item.result.resolucion === 'aprobado' ? '#d1fae5' : '#fee2e2')
                    : '#d1fae5',
                  color: item.result.mode === 'mano_alzada' && item.result.resolucion === 'rechazado' ? '#991b1b' : '#059669'
                }}>
                  {item.result.mode === 'mano_alzada' ? (
                    <>
                      <strong>{item.result.resolucion === 'aprobado' ? 'Aprobado (mano alzada)' : 'Rechazado (mano alzada)'}</strong>
                      {(item.result.votosAFavor != null || item.result.votosEnContra != null) && (
                        <div style={{ fontSize: 12, marginTop: 4 }}>
                          {item.result.votosAFavor != null && <span>A favor: {item.result.votosAFavor} </span>}
                          {item.result.votosEnContra != null && <span>En contra: {item.result.votosEnContra} </span>}
                          {item.result.abstenciones != null && <span>Abstenciones: {item.result.abstenciones}</span>}
                        </div>
                      )}
                      {item.result.observaciones && <div style={{ fontStyle: 'italic', fontSize: 12, marginTop: 4 }}>{item.result.observaciones}</div>}
                    </>
                  ) : 'Resultado registrado'}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InfoPill({ label, value }) {
  return (
    <div style={{ background: '#f3f4f6', borderRadius: 8, padding: '8px 12px' }}>
      <span style={{ fontSize: 11, color: '#6b7280', display: 'block' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>{value}</span>
    </div>
  );
}
