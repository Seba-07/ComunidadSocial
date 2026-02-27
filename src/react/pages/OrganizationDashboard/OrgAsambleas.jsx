import { useState, useEffect } from 'react';
import { apiService } from '@services/ApiService.js';
import { useUiStore } from '../../stores/uiStore';
import Modal from '../../components/ui/Modal';
import FormField from '../../components/ui/FormField';
import { formatDate } from '../../utils/formatters';

const STATUS_LABELS = { draft: 'Borrador', convocada: 'Convocada', en_curso: 'En Curso', finalizada: 'Finalizada', cancelada: 'Cancelada' };
const STATUS_COLORS = { draft: '#6b7280', convocada: '#3b82f6', en_curso: '#10b981', finalizada: '#8b5cf6', cancelada: '#ef4444' };
const AGENDA_TYPE_LABELS = { eleccion_directorio: 'Elección Directorio', aprobacion_presupuesto: 'Presupuesto', reforma_estatutos: 'Reforma Estatutos', custom: 'Otro' };

export default function OrgAsambleas({ org, onRefresh }) {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedAssembly, setSelectedAssembly] = useState(null);
  const [showElections, setShowElections] = useState(false);

  // Sync selectedAssembly with refreshed org data
  useEffect(() => {
    if (selectedAssembly && org?.assemblies) {
      const updated = org.assemblies.find(a => (a.id || a._id) === (selectedAssembly.id || selectedAssembly._id));
      if (updated) {
        setSelectedAssembly(updated);
      }
    }
  }, [org?.assemblies]);
  const addToast = useUiStore((s) => s.addToast);

  const assemblies = org?.assemblies || [];
  const active = assemblies.filter((a) => ['convocada', 'en_curso'].includes(a.status));
  const past = assemblies.filter((a) => ['finalizada', 'cancelada'].includes(a.status));
  const drafts = assemblies.filter((a) => a.status === 'draft');

  // Elections: assemblies with eleccion_directorio agenda items
  const elections = assemblies.filter((a) =>
    a.status === 'finalizada' && a.agendaItems?.some((item) => item.type === 'eleccion_directorio')
  );

  async function handleStatusAction(assemblyId, action) {
    try {
      await apiService.updateAssemblyStatus(org._id, assemblyId, action);
      const labels = { convocar: 'Asamblea convocada', iniciar: 'Asamblea iniciada', finalizar: 'Asamblea finalizada', cancelar: 'Asamblea cancelada' };
      addToast(labels[action] || 'Estado actualizado', 'success');
      onRefresh();
    } catch (error) {
      addToast(error.message || 'Error al actualizar estado', 'error');
    }
  }

  async function handleDelete(assemblyId) {
    if (!confirm('¿Estás seguro de eliminar esta asamblea?')) return;
    try {
      await apiService.deleteAssembly(org._id, assemblyId);
      addToast('Asamblea eliminada', 'success');
      onRefresh();
    } catch (error) {
      addToast(error.message || 'Error al eliminar', 'error');
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1e3a8a', margin: 0 }}>Asambleas</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowElections(true)} style={{ padding: '8px 16px', fontSize: 14, border: '1px solid #8b5cf6', borderRadius: 8, background: 'white', color: '#8b5cf6', cursor: 'pointer', fontWeight: 600 }}>
            Elecciones
          </button>
          <button className="btn-primary" style={{ padding: '8px 16px', fontSize: 14 }} onClick={() => setShowCreate(true)}>
            + Nueva Asamblea
          </button>
        </div>
      </div>

      {/* Educational cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: 14 }}>
          <div style={{ fontWeight: 600, color: '#1e40af', fontSize: 14, marginBottom: 4 }}>Ordinaria</div>
          <div style={{ fontSize: 12, color: '#1e40af' }}>Se realiza al menos una vez al año para tratar temas regulares de la organización.</div>
        </div>
        <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 12, padding: 14 }}>
          <div style={{ fontWeight: 600, color: '#92400e', fontSize: 14, marginBottom: 4 }}>Extraordinaria</div>
          <div style={{ fontSize: 12, color: '#92400e' }}>Se convoca para temas urgentes o especiales (elecciones, reformas, etc).</div>
        </div>
      </div>

      {active.length > 0 && <Section title="En Curso / Convocadas" color="#10b981" assemblies={active} onView={setSelectedAssembly} onAction={handleStatusAction} onDelete={handleDelete} />}
      {drafts.length > 0 && <Section title="Borradores" color="#6b7280" assemblies={drafts} onView={setSelectedAssembly} onAction={handleStatusAction} onDelete={handleDelete} />}
      {past.length > 0 && <Section title="Historial" color="#8b5cf6" assemblies={past} onView={setSelectedAssembly} onAction={handleStatusAction} onDelete={handleDelete} />}
      {assemblies.length === 0 && <p style={{ color: '#6b7280', textAlign: 'center', padding: 48 }}>No hay asambleas registradas</p>}

      <CreateAssemblyModal open={showCreate} onClose={() => setShowCreate(false)} orgId={org._id} onCreated={() => { setShowCreate(false); onRefresh(); }} addToast={addToast} />
      <AssemblyDetailModal assembly={selectedAssembly} onClose={() => setSelectedAssembly(null)} orgId={org._id} onRefresh={onRefresh} addToast={addToast} />
      <ElectionsModal open={showElections} onClose={() => setShowElections(false)} elections={elections} org={org} />
    </div>
  );
}

function Section({ title, color, assemblies, onView, onAction, onDelete }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color, marginBottom: 12 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {assemblies.map((a) => (
          <AssemblyCard key={a.id || a._id} assembly={a} onView={() => onView(a)} onAction={onAction} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}

function AssemblyCard({ assembly, onView, onAction, onDelete }) {
  const a = assembly;
  const id = a.id || a._id;
  const color = STATUS_COLORS[a.status] || '#6b7280';
  const hasVoting = a.agendaItems?.some((item) => item.votingOpen);
  const agendaTypes = [...new Set((a.agendaItems || []).map((item) => AGENDA_TYPE_LABELS[item.type] || item.type).filter(Boolean))];

  const actions = [];
  if (a.status === 'draft') actions.push({ label: 'Convocar', action: 'convocar', color: '#3b82f6' });
  if (a.status === 'convocada') actions.push({ label: 'Iniciar', action: 'iniciar', color: '#10b981' });
  if (a.status === 'en_curso') actions.push({ label: 'Finalizar', action: 'finalizar', color: '#8b5cf6' });

  return (
    <div style={{ border: '1px solid #e5e7eb', borderLeft: `4px solid ${color}`, borderRadius: 12, padding: 16, background: 'white' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 600, color: '#1e3a8a', cursor: 'pointer' }} onClick={onView}>{a.title}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {hasVoting && <span style={{ fontSize: 11, fontWeight: 600, color: '#10b981', padding: '2px 8px', background: '#d1fae5', borderRadius: 12 }}>Votación Abierta</span>}
          <span style={{ fontSize: 12, fontWeight: 600, color, padding: '2px 10px', borderRadius: 12, background: `${color}15` }}>{STATUS_LABELS[a.status]}</span>
        </div>
      </div>
      <div style={{ fontSize: 13, color: '#6b7280', display: 'flex', gap: 16, marginBottom: 4 }}>
        <span>{formatDate(a.date)}</span>
        {a.time && <span>{a.time}</span>}
        <span>{a.type === 'ordinaria' ? 'Ordinaria' : 'Extraordinaria'}</span>
        <span>{a.attendees?.length || 0} asistentes</span>
      </div>
      {agendaTypes.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {agendaTypes.map((t) => <span key={t} style={{ fontSize: 11, padding: '1px 8px', borderRadius: 8, background: '#f3f4f6', color: '#374151' }}>{t}</span>)}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onView} style={{ padding: '4px 12px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, background: 'white', cursor: 'pointer', color: '#374151' }}>Ver detalle</button>
        {actions.map(({ label, action, color: c }) => (
          <button key={action} onClick={() => onAction(id, action)} style={{ padding: '4px 12px', fontSize: 12, border: 'none', borderRadius: 6, background: c, color: 'white', cursor: 'pointer', fontWeight: 600 }}>{label}</button>
        ))}
        {(a.status === 'draft' || a.status === 'convocada') && (
          <button onClick={() => onDelete(id)} style={{ padding: '4px 12px', fontSize: 12, border: '1px solid #ef4444', borderRadius: 6, background: 'white', color: '#ef4444', cursor: 'pointer' }}>Eliminar</button>
        )}
      </div>
    </div>
  );
}

// ========== Assembly Detail Modal ==========
function AssemblyDetailModal({ assembly, onClose, orgId, onRefresh, addToast }) {
  const [checkinRut, setCheckinRut] = useState('');
  const [candidateForm, setCandidateForm] = useState(null); // { agendaItemId }
  if (!assembly) return null;
  const a = assembly;
  const id = a.id || a._id;
  const attendeeCount = a.attendees?.length || 0;
  const quorumMet = a.quorumValue ? attendeeCount >= a.quorumValue : false;

  async function handleCheckin() {
    if (!checkinRut.trim()) { addToast('Ingresa un RUT', 'error'); return; }
    try {
      await apiService.checkinAssembly(orgId, id, { rut: checkinRut.trim() });
      addToast('Asistente registrado', 'success');
      setCheckinRut('');
      onRefresh();
    } catch (error) {
      addToast(error.message || 'Error al registrar', 'error');
    }
  }

  async function handleToggleVoting(agendaItemId) {
    try {
      await apiService.toggleVoting(orgId, id, agendaItemId);
      addToast('Votación actualizada', 'success');
      onRefresh();
    } catch (error) {
      addToast(error.message || 'Error', 'error');
    }
  }

  return (
    <Modal open={true} onClose={onClose} title={a.title}>
      {/* Info Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        <InfoPill label="Estado" value={STATUS_LABELS[a.status]} />
        <InfoPill label="Tipo" value={a.type === 'ordinaria' ? 'Ordinaria' : 'Extraordinaria'} />
        <InfoPill label="Fecha" value={formatDate(a.date)} />
        <div style={{ background: quorumMet ? '#d1fae5' : '#fee2e2', borderRadius: 8, padding: '8px 12px' }}>
          <span style={{ fontSize: 11, color: '#6b7280', display: 'block' }}>Quórum</span>
          <span style={{ fontSize: 14, fontWeight: 500, color: quorumMet ? '#059669' : '#ef4444' }}>
            {attendeeCount} / {a.quorumValue || '?'} {quorumMet ? '(Cumplido)' : '(No cumplido)'}
          </span>
        </div>
      </div>

      {a.description && <p style={{ color: '#374151', fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>{a.description}</p>}

      {/* Checkin (only when en_curso) */}
      {a.status === 'en_curso' && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#065f46', marginBottom: 8 }}>Registrar Asistencia</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="text" placeholder="RUT del asistente" value={checkinRut} onChange={(e) => setCheckinRut(e.target.value)}
              style={{ flex: 1, padding: '8px 12px', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 14 }} />
            <button onClick={handleCheckin} style={{ padding: '8px 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Registrar</button>
          </div>
          {a.attendees?.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#065f46' }}>
              Asistentes: {a.attendees.map((att) => `${att.firstName || ''} ${att.lastName || att.rut || ''}`).join(', ')}
            </div>
          )}
        </div>
      )}

      {/* Agenda Items */}
      {a.agendaItems?.length > 0 && (
        <div>
          <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Tabla</h4>
          {a.agendaItems.map((item, idx) => {
            const itemId = item.id || item._id;
            return (
              <div key={itemId || idx} style={{ padding: 16, background: '#f9fafb', borderRadius: 12, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600 }}>{idx + 1}. {item.title}</span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {item.type && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: '#dbeafe', color: '#1e40af' }}>{AGENDA_TYPE_LABELS[item.type] || item.type}</span>}
                    {item.votingOpen && <span style={{ fontSize: 11, fontWeight: 600, color: '#10b981' }}>Votación Abierta</span>}
                  </div>
                </div>

                {/* Toggle voting + add candidates (only organizer, en_curso) */}
                {a.status === 'en_curso' && item.type === 'eleccion_directorio' && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button onClick={() => handleToggleVoting(itemId)}
                      style={{ padding: '4px 12px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, background: item.votingOpen ? '#fee2e2' : '#d1fae5', cursor: 'pointer', color: item.votingOpen ? '#ef4444' : '#059669', fontWeight: 600 }}>
                      {item.votingOpen ? 'Cerrar Votación' : 'Abrir Votación'}
                    </button>
                    <button onClick={() => setCandidateForm({ agendaItemId: itemId })}
                      style={{ padding: '4px 12px', fontSize: 12, border: '1px solid #3b82f6', borderRadius: 6, background: 'white', cursor: 'pointer', color: '#3b82f6', fontWeight: 600 }}>
                      Agregar Candidatos
                    </button>
                  </div>
                )}

                {/* Candidates list */}
                {item.candidates?.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Candidatos:</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                      {item.candidates.map((c, ci) => (
                        <span key={ci} style={{ fontSize: 12, padding: '2px 10px', borderRadius: 12, background: '#f3f4f6', color: '#374151' }}>
                          {c.firstName} {c.lastName} {c.cargo && `(${c.cargo})`} {c.lista && `- ${c.lista}`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Votes count */}
                {item.votes?.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>{item.votes.length} voto(s) registrado(s)</div>
                )}

                {/* Results */}
                {item.result && (
                  <div style={{ marginTop: 8, padding: 8, background: '#d1fae5', borderRadius: 8, fontSize: 13, color: '#065f46' }}>
                    Resultado registrado
                    {item.result.winners && (
                      <div style={{ marginTop: 4 }}>
                        {Object.entries(item.result.winners).map(([cargo, winner]) => (
                          <div key={cargo}><strong>{cargo}:</strong> {winner.firstName || winner.name} {winner.lastName || ''}</div>
                        ))}
                      </div>
                    )}
                    {item.result.winningLista && <div style={{ marginTop: 4 }}><strong>Lista ganadora:</strong> {item.result.winningLista}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Candidates Modal */}
      {candidateForm && (
        <AddCandidatesForm
          orgId={orgId}
          assemblyId={id}
          agendaItemId={candidateForm.agendaItemId}
          onClose={() => setCandidateForm(null)}
          onAdded={() => { setCandidateForm(null); onRefresh(); }}
          addToast={addToast}
        />
      )}
    </Modal>
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

// ========== Add Candidates Form ==========
function AddCandidatesForm({ orgId, assemblyId, agendaItemId, onClose, onAdded, addToast }) {
  const [candidates, setCandidates] = useState([{ firstName: '', lastName: '', rut: '', cargo: '' }]);
  const [submitting, setSubmitting] = useState(false);

  function updateCandidate(idx, field, value) {
    setCandidates((prev) => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  }

  function addRow() {
    setCandidates((prev) => [...prev, { firstName: '', lastName: '', rut: '', cargo: '' }]);
  }

  async function handleSubmit() {
    const valid = candidates.filter((c) => c.firstName && c.lastName && c.rut);
    if (valid.length === 0) { addToast('Agrega al menos un candidato', 'error'); return; }
    setSubmitting(true);
    try {
      await apiService.addCandidates(orgId, assemblyId, agendaItemId, valid);
      addToast(`${valid.length} candidato(s) agregado(s)`, 'success');
      onAdded();
    } catch (error) {
      addToast(error.message || 'Error', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ marginTop: 16, padding: 16, background: '#eff6ff', borderRadius: 12, border: '1px solid #bfdbfe' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontWeight: 600, color: '#1e40af' }}>Agregar Candidatos</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 18, cursor: 'pointer' }}>&times;</button>
      </div>
      {candidates.map((c, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input placeholder="Nombre" value={c.firstName} onChange={(e) => updateCandidate(i, 'firstName', e.target.value)} style={inputSm} />
          <input placeholder="Apellido" value={c.lastName} onChange={(e) => updateCandidate(i, 'lastName', e.target.value)} style={inputSm} />
          <input placeholder="RUT" value={c.rut} onChange={(e) => updateCandidate(i, 'rut', e.target.value)} style={inputSm} />
          <input placeholder="Cargo" value={c.cargo} onChange={(e) => updateCandidate(i, 'cargo', e.target.value)} style={inputSm} />
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={addRow} style={{ padding: '4px 12px', fontSize: 12, border: '1px solid #bfdbfe', borderRadius: 6, background: 'white', cursor: 'pointer', color: '#1e40af' }}>+ Agregar fila</button>
        <button onClick={handleSubmit} disabled={submitting} style={{ padding: '4px 12px', fontSize: 12, border: 'none', borderRadius: 6, background: '#2563eb', color: 'white', cursor: 'pointer', fontWeight: 600 }}>
          {submitting ? 'Guardando...' : 'Guardar Candidatos'}
        </button>
      </div>
    </div>
  );
}

const inputSm = { flex: 1, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 };

// ========== Elections Modal ==========
function ElectionsModal({ open, onClose, elections, org }) {
  if (!open) return null;

  const dir = org?.provisionalDirectorio;
  const dirType = dir?.type === 'ELECTO' ? 'Electo' : 'Provisorio';

  // Estimate next election deadline (3 years from last or constitution)
  let lastElectionDate = null;
  if (elections.length > 0) {
    lastElectionDate = elections.reduce((latest, e) => {
      const d = new Date(e.date);
      return d > latest ? d : latest;
    }, new Date(0));
  }

  const constitutionDate = org?.statusHistory?.find((s) => s.status === 'constituida')?.date;
  const referenceDate = lastElectionDate || (constitutionDate ? new Date(constitutionDate) : null);

  let daysLeft = null;
  let deadline = null;
  if (referenceDate) {
    deadline = new Date(referenceDate);
    deadline.setFullYear(deadline.getFullYear() + 3);
    daysLeft = Math.ceil((deadline - new Date()) / (1000 * 60 * 60 * 24));
  }

  return (
    <Modal open={open} onClose={onClose} title="Gestión de Elecciones">
      {/* Renewal Status */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontWeight: 600, color: '#1e3a8a', marginBottom: 8 }}>Estado de Renovación</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <InfoPill label="Directorio Actual" value={dirType} />
          <InfoPill label="Última Elección" value={lastElectionDate ? formatDate(lastElectionDate.toISOString()) : 'Sin registro'} />
          {deadline && (
            <div style={{
              background: daysLeft < 0 ? '#fee2e2' : daysLeft < 180 ? '#fef3c7' : '#d1fae5',
              borderRadius: 8, padding: '8px 12px', gridColumn: 'span 2'
            }}>
              <span style={{ fontSize: 11, color: '#6b7280', display: 'block' }}>Próxima Renovación</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: daysLeft < 0 ? '#ef4444' : daysLeft < 180 ? '#d97706' : '#059669' }}>
                {formatDate(deadline.toISOString())} ({daysLeft < 0 ? `Vencido hace ${Math.abs(daysLeft)} días` : `${daysLeft} días restantes`})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Election History */}
      <div>
        <div style={{ fontWeight: 600, color: '#1e3a8a', marginBottom: 8 }}>Historial de Elecciones</div>
        {elections.length === 0 ? (
          <p style={{ color: '#6b7280', textAlign: 'center', padding: 24, fontSize: 14 }}>No hay elecciones registradas</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {elections.map((e) => (
              <div key={e.id || e._id} style={{ padding: 12, background: '#f9fafb', borderRadius: 8 }}>
                <div style={{ fontWeight: 500, color: '#1e3a8a' }}>{e.title}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{formatDate(e.date)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: 14, marginTop: 16, fontSize: 13, color: '#1e40af' }}>
        El directorio se renueva cada 3 años mediante una asamblea extraordinaria con punto de tabla &quot;Elección de Directorio&quot;.
        Para convocar una elección, cree una nueva asamblea extraordinaria con un punto de tipo &quot;Elección Directorio&quot;.
      </div>
    </Modal>
  );
}

// ========== Create Assembly Modal ==========
function CreateAssemblyModal({ open, onClose, orgId, onCreated, addToast }) {
  const [form, setForm] = useState({ title: '', type: 'ordinaria', date: '', time: '', description: '' });
  const [agendaItems, setAgendaItems] = useState([{ title: '', type: 'custom' }]);
  const [submitting, setSubmitting] = useState(false);

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function updateAgenda(idx, field, value) {
    setAgendaItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title || !form.date) { addToast('Título y fecha son requeridos', 'error'); return; }
    setSubmitting(true);
    try {
      const validItems = agendaItems.filter((item) => item.title.trim());
      await apiService.createAssembly(orgId, { ...form, agendaItems: validItems });
      addToast('Asamblea creada exitosamente', 'success');
      setForm({ title: '', type: 'ordinaria', date: '', time: '', description: '' });
      setAgendaItems([{ title: '', type: 'custom' }]);
      onCreated();
    } catch (error) {
      addToast(error.message || 'Error al crear asamblea', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nueva Asamblea">
      <form className="auth-form" onSubmit={handleSubmit}>
        <FormField label="Título *" id="asm-title" type="text" placeholder="Asamblea General Ordinaria" value={form.title} onChange={set('title')} />
        <FormField label="Tipo" id="asm-type">
          <select id="asm-type" value={form.type} onChange={set('type')} style={{ width: '100%', padding: '14px 16px', border: '2px solid #e5e7eb', borderRadius: 12, fontSize: 16 }}>
            <option value="ordinaria">Ordinaria</option>
            <option value="extraordinaria">Extraordinaria</option>
          </select>
        </FormField>
        <FormField label="Fecha *" id="asm-date" type="date" value={form.date} onChange={set('date')} />
        <FormField label="Hora" id="asm-time" type="time" value={form.time} onChange={set('time')} />
        <FormField label="Descripción" id="asm-desc">
          <textarea id="asm-desc" value={form.description} onChange={set('description')} placeholder="Descripción..." rows={3}
            style={{ width: '100%', padding: '14px 16px', border: '2px solid #e5e7eb', borderRadius: 12, fontSize: 16, resize: 'vertical', boxSizing: 'border-box' }} />
        </FormField>

        {/* Agenda Items */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Puntos de Tabla</label>
          {agendaItems.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input placeholder="Título del punto" value={item.title} onChange={(e) => updateAgenda(idx, 'title', e.target.value)}
                style={{ flex: 1, padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: 12, fontSize: 14 }} />
              <select value={item.type} onChange={(e) => updateAgenda(idx, 'type', e.target.value)}
                style={{ padding: '10px', border: '2px solid #e5e7eb', borderRadius: 12, fontSize: 14 }}>
                <option value="custom">Otro</option>
                <option value="eleccion_directorio">Elección Directorio</option>
                <option value="aprobacion_presupuesto">Presupuesto</option>
                <option value="reforma_estatutos">Reforma Estatutos</option>
              </select>
            </div>
          ))}
          <button type="button" onClick={() => setAgendaItems((prev) => [...prev, { title: '', type: 'custom' }])}
            style={{ padding: '4px 12px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, background: 'white', cursor: 'pointer', color: '#374151' }}>
            + Agregar punto
          </button>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: 12, background: '#f3f4f6', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>Cancelar</button>
          <button type="submit" className="btn-auth" style={{ flex: 1 }} disabled={submitting}>{submitting ? 'Creando...' : 'Crear Asamblea'}</button>
        </div>
      </form>
    </Modal>
  );
}
