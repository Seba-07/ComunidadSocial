import { useState } from 'react';
import { apiService } from '@services/ApiService.js';
import { useUiStore } from '../../stores/uiStore';
import Modal from '../../components/ui/Modal';
import FormField from '../../components/ui/FormField';
import { formatDate } from '../../utils/formatters';

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

export default function OrgAsambleas({ org, onRefresh }) {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedAssembly, setSelectedAssembly] = useState(null);
  const addToast = useUiStore((s) => s.addToast);

  const assemblies = org?.assemblies || [];
  const active = assemblies.filter((a) => ['convocada', 'en_curso'].includes(a.status));
  const past = assemblies.filter((a) => ['finalizada', 'cancelada'].includes(a.status));
  const drafts = assemblies.filter((a) => a.status === 'draft');

  async function handleStatusAction(assemblyId, action) {
    try {
      await apiService.updateAssemblyStatus(org._id, assemblyId, action);
      const labels = { convocar: 'Asamblea convocada', iniciar: 'Asamblea iniciada', finalizar: 'Asamblea finalizada' };
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1e3a8a', margin: 0 }}>Asambleas</h3>
        <button className="btn-primary" style={{ padding: '8px 16px', fontSize: 14 }} onClick={() => setShowCreate(true)}>
          + Nueva Asamblea
        </button>
      </div>

      {active.length > 0 && <Section title="En Curso / Convocadas" color="#10b981" assemblies={active} onView={setSelectedAssembly} onAction={handleStatusAction} onDelete={handleDelete} />}
      {drafts.length > 0 && <Section title="Borradores" color="#6b7280" assemblies={drafts} onView={setSelectedAssembly} onAction={handleStatusAction} onDelete={handleDelete} />}
      {past.length > 0 && <Section title="Historial" color="#8b5cf6" assemblies={past} onView={setSelectedAssembly} onAction={handleStatusAction} onDelete={handleDelete} />}
      {assemblies.length === 0 && (
        <p style={{ color: '#6b7280', textAlign: 'center', padding: 48 }}>No hay asambleas registradas</p>
      )}

      <CreateAssemblyModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        orgId={org._id}
        onCreated={() => { setShowCreate(false); onRefresh(); }}
        addToast={addToast}
      />

      <Modal open={!!selectedAssembly} onClose={() => setSelectedAssembly(null)} title={selectedAssembly?.title || 'Detalle'}>
        {selectedAssembly && <AssemblyDetail assembly={selectedAssembly} />}
      </Modal>
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

  const actions = [];
  if (a.status === 'draft') actions.push({ label: 'Convocar', action: 'convocar', color: '#3b82f6' });
  if (a.status === 'convocada') actions.push({ label: 'Iniciar', action: 'iniciar', color: '#10b981' });
  if (a.status === 'en_curso') actions.push({ label: 'Finalizar', action: 'finalizar', color: '#8b5cf6' });

  return (
    <div style={{
      border: '1px solid #e5e7eb',
      borderLeft: `4px solid ${color}`,
      borderRadius: 12,
      padding: 16,
      background: 'white'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 600, color: '#1e3a8a', cursor: 'pointer' }} onClick={onView}>
          {a.title}
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {hasVoting && (
            <span style={{ fontSize: 11, fontWeight: 600, color: '#10b981', padding: '2px 8px', background: '#d1fae5', borderRadius: 12 }}>
              Votación Abierta
            </span>
          )}
          <span style={{ fontSize: 12, fontWeight: 600, color, padding: '2px 10px', borderRadius: 12, background: `${color}15` }}>
            {STATUS_LABELS[a.status]}
          </span>
        </div>
      </div>
      <div style={{ fontSize: 13, color: '#6b7280', display: 'flex', gap: 16, marginBottom: 8 }}>
        <span>{formatDate(a.date)}</span>
        {a.time && <span>{a.time}</span>}
        <span>{a.type === 'ordinaria' ? 'Ordinaria' : 'Extraordinaria'}</span>
        <span>{a.attendees?.length || 0} asistentes</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onView} style={{ padding: '4px 12px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, background: 'white', cursor: 'pointer', color: '#374151' }}>
          Ver detalle
        </button>
        {actions.map(({ label, action, color: btnColor }) => (
          <button
            key={action}
            onClick={() => onAction(id, action)}
            style={{ padding: '4px 12px', fontSize: 12, border: 'none', borderRadius: 6, background: btnColor, color: 'white', cursor: 'pointer', fontWeight: 600 }}
          >
            {label}
          </button>
        ))}
        {(a.status === 'draft' || a.status === 'cancelada') && (
          <button
            onClick={() => onDelete(id)}
            style={{ padding: '4px 12px', fontSize: 12, border: '1px solid #ef4444', borderRadius: 6, background: 'white', color: '#ef4444', cursor: 'pointer' }}
          >
            Eliminar
          </button>
        )}
      </div>
    </div>
  );
}

function AssemblyDetail({ assembly }) {
  const a = assembly;
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        <InfoPill label="Estado" value={STATUS_LABELS[a.status]} />
        <InfoPill label="Tipo" value={a.type === 'ordinaria' ? 'Ordinaria' : 'Extraordinaria'} />
        <InfoPill label="Fecha" value={formatDate(a.date)} />
        <InfoPill label="Asistentes" value={`${a.attendees?.length || 0}`} />
      </div>
      {a.agendaItems?.length > 0 && (
        <div>
          <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Tabla</h4>
          {a.agendaItems.map((item, idx) => (
            <div key={item.id || idx} style={{ padding: 12, background: '#f9fafb', borderRadius: 8, marginBottom: 8 }}>
              <span style={{ fontWeight: 500 }}>{idx + 1}. {item.title}</span>
              {item.type && <span style={{ marginLeft: 8, fontSize: 12, color: '#6b7280' }}>({item.type})</span>}
            </div>
          ))}
        </div>
      )}
      {a.description && (
        <div style={{ marginTop: 16 }}>
          <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Descripción</h4>
          <p style={{ color: '#374151', fontSize: 14, lineHeight: 1.6 }}>{a.description}</p>
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

function CreateAssemblyModal({ open, onClose, orgId, onCreated, addToast }) {
  const [form, setForm] = useState({
    title: '', type: 'ordinaria', date: '', time: '', description: ''
  });
  const [submitting, setSubmitting] = useState(false);

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title || !form.date) {
      addToast('Título y fecha son requeridos', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await apiService.createAssembly(orgId, form);
      addToast('Asamblea creada exitosamente', 'success');
      setForm({ title: '', type: 'ordinaria', date: '', time: '', description: '' });
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
        <FormField label="Título *" id="assembly-title" type="text" placeholder="Asamblea General Ordinaria" value={form.title} onChange={set('title')} />
        <FormField label="Tipo" id="assembly-type">
          <select id="assembly-type" value={form.type} onChange={set('type')} style={{ width: '100%', padding: '14px 16px', border: '2px solid #e5e7eb', borderRadius: 12, fontSize: 16 }}>
            <option value="ordinaria">Ordinaria</option>
            <option value="extraordinaria">Extraordinaria</option>
          </select>
        </FormField>
        <FormField label="Fecha *" id="assembly-date" type="date" value={form.date} onChange={set('date')} />
        <FormField label="Hora" id="assembly-time" type="time" value={form.time} onChange={set('time')} />
        <FormField label="Descripción" id="assembly-desc">
          <textarea
            id="assembly-desc"
            value={form.description}
            onChange={set('description')}
            placeholder="Descripción de la asamblea..."
            rows={3}
            style={{ width: '100%', padding: '14px 16px', border: '2px solid #e5e7eb', borderRadius: 12, fontSize: 16, resize: 'vertical', boxSizing: 'border-box' }}
          />
        </FormField>
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: 12, background: '#f3f4f6', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
            Cancelar
          </button>
          <button type="submit" className="btn-auth" style={{ flex: 1 }} disabled={submitting}>
            {submitting ? 'Creando...' : 'Crear Asamblea'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
