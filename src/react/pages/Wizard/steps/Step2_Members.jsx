import { useState } from 'react';
import { useWizardStore } from '../../../stores/wizardStore';
import { useUiStore } from '../../../stores/uiStore';
import { validateRut, formatRut } from '../../../utils/validators';
import DataTable from '../../../components/ui/DataTable';
import Modal from '../../../components/ui/Modal';

const EMPTY_MEMBER = { firstName: '', lastName: '', rut: '', email: '', phone: '', birthDate: '' };

export default function Step2_Members({ onNext, onPrev }) {
  const { formData, addMember, removeMember, updateMember } = useWizardStore();
  const addToast = useUiStore(s => s.addToast);
  const [showForm, setShowForm] = useState(false);
  const [editIdx, setEditIdx] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_MEMBER });

  const members = formData.members || [];
  const minMembers = formData.organization?.type === 'JUNTA_VECINOS' ? 200 : 15;

  function openAdd() {
    setForm({ ...EMPTY_MEMBER });
    setEditIdx(null);
    setShowForm(true);
  }

  function openEdit(idx) {
    setForm({ ...members[idx] });
    setEditIdx(idx);
    setShowForm(true);
  }

  function saveMember() {
    if (!form.firstName?.trim() || !form.lastName?.trim() || !form.rut?.trim()) {
      addToast('Nombre, apellido y RUT son requeridos', 'error');
      return;
    }

    // Check duplicate RUT
    const normalizedRut = form.rut.replace(/\./g, '').replace(/-/g, '').toLowerCase();
    const duplicate = members.findIndex((m, i) => {
      if (editIdx !== null && i === editIdx) return false;
      return m.rut.replace(/\./g, '').replace(/-/g, '').toLowerCase() === normalizedRut;
    });
    if (duplicate >= 0) {
      addToast('Ya existe un miembro con este RUT', 'error');
      return;
    }

    if (editIdx !== null) {
      updateMember(editIdx, form);
    } else {
      addMember(form);
    }
    setShowForm(false);
  }

  function handleNext() {
    if (members.length < minMembers) {
      addToast(`Se requieren al menos ${minMembers} miembros (tienes ${members.length})`, 'error');
      return;
    }
    onNext();
  }

  const columns = [
    { key: 'firstName', label: 'Nombre', sortable: true },
    { key: 'lastName', label: 'Apellido', sortable: true },
    { key: 'rut', label: 'RUT', sortable: true },
    { key: 'email', label: 'Email' },
    {
      key: 'actions', label: '', sortable: false,
      render: (_, row) => {
        const idx = members.indexOf(row);
        return (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => openEdit(idx)} style={smallBtn}>Editar</button>
            <button onClick={() => removeMember(idx)} style={{ ...smallBtn, color: '#ef4444' }}>Eliminar</button>
          </div>
        );
      }
    }
  ];

  return (
    <div>
      <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#111827' }}>
        Miembros Fundadores
      </h2>
      <p style={{ margin: '0 0 20px', fontSize: 14, color: '#6b7280' }}>
        {members.length}/{minMembers} miembros (mínimo {minMembers} requeridos)
      </p>

      <div style={{
        height: 6, background: '#e5e7eb', borderRadius: 3, marginBottom: 20, overflow: 'hidden'
      }}>
        <div style={{
          height: '100%', borderRadius: 3,
          width: `${Math.min(100, (members.length / minMembers) * 100)}%`,
          background: members.length >= minMembers ? '#10b981' : '#2563eb',
          transition: 'width 0.3s'
        }} />
      </div>

      <button onClick={openAdd} style={{
        padding: '10px 20px', border: 'none', borderRadius: 10,
        background: '#2563eb', color: 'white', fontSize: 14, fontWeight: 600,
        cursor: 'pointer', marginBottom: 16
      }}>
        Agregar Miembro
      </button>

      <div style={{ background: '#f9fafb', borderRadius: 12, overflow: 'hidden' }}>
        <DataTable columns={columns} data={members} emptyMessage="Sin miembros registrados" pageSize={10} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <button onClick={onPrev} style={prevBtn}>Anterior</button>
        <button onClick={handleNext} style={nextBtnStyle}>Siguiente</button>
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editIdx !== null ? 'Editar Miembro' : 'Agregar Miembro'}>
        <div style={{ display: 'grid', gap: 14 }}>
          {[
            { key: 'firstName', label: 'Nombre *' },
            { key: 'lastName', label: 'Apellido *' },
            { key: 'rut', label: 'RUT *', placeholder: '12.345.678-9' },
            { key: 'email', label: 'Email', type: 'email' },
            { key: 'phone', label: 'Teléfono' },
            { key: 'birthDate', label: 'Fecha de nacimiento', type: 'date' }
          ].map(f => (
            <div key={f.key}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{f.label}</label>
              <input
                type={f.type || 'text'}
                value={form[f.key] || ''}
                onChange={e => {
                  let val = e.target.value;
                  if (f.key === 'rut') val = formatRut(val);
                  setForm(p => ({ ...p, [f.key]: val }));
                }}
                placeholder={f.placeholder || ''}
                style={{ width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}
              />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={() => setShowForm(false)} style={{ padding: '10px 20px', border: '1px solid #d1d5db', borderRadius: 10, background: 'white', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={saveMember} style={{ padding: '10px 20px', border: 'none', borderRadius: 10, background: '#2563eb', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Guardar</button>
        </div>
      </Modal>
    </div>
  );
}

const smallBtn = { padding: '4px 10px', border: '1px solid #d1d5db', borderRadius: 6, background: 'white', fontSize: 12, cursor: 'pointer', color: '#374151' };
const prevBtn = { padding: '12px 28px', border: '1px solid #d1d5db', borderRadius: 10, background: 'white', fontSize: 15, cursor: 'pointer', color: '#374151' };
const nextBtnStyle = { padding: '12px 28px', border: 'none', borderRadius: 10, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer' };
