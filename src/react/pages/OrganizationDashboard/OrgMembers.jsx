import { useState } from 'react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import FormField from '../../components/ui/FormField';
import { apiService } from '@services/ApiService.js';
import { useUiStore } from '../../stores/uiStore';
import { validateRut, formatRut } from '../../utils/validators';

export default function OrgMembers({ org, onRefresh }) {
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const addToast = useUiStore((s) => s.addToast);

  const members = org?.members || [];
  const filtered = search
    ? members.filter((m) => {
        const q = search.toLowerCase();
        return (
          (m.firstName || '').toLowerCase().includes(q) ||
          (m.lastName || '').toLowerCase().includes(q) ||
          (m.rut || '').includes(q)
        );
      })
    : members;

  const columns = [
    {
      key: 'name',
      label: 'Nombre',
      render: (_, row) => `${row.firstName || ''} ${row.lastName || ''}`
    },
    { key: 'rut', label: 'RUT' },
    {
      key: 'role',
      label: 'Rol',
      render: (val) => {
        const label = val === 'directivo' ? 'Directivo' : 'Socio';
        const bg = val === 'directivo' ? '#dbeafe' : '#f3f4f6';
        const color = val === 'directivo' ? '#1e40af' : '#374151';
        return <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: bg, color }}>{label}</span>;
      }
    },
    {
      key: 'phone',
      label: 'Teléfono',
      render: (val) => val || '—'
    }
  ];

  const data = filtered.map((m) => ({ ...m, name: `${m.firstName} ${m.lastName}` }));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1e3a8a', margin: 0 }}>
          Miembros ({members.length})
        </h3>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Buscar por nombre o RUT..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: '8px 14px',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              fontSize: 14,
              width: 260
            }}
          />
          <button
            className="btn-primary"
            style={{ padding: '8px 16px', fontSize: 14 }}
            onClick={() => setShowAdd(true)}
          >
            + Agregar Miembro
          </button>
        </div>
      </div>

      <DataTable columns={columns} data={data} emptyMessage="No hay miembros registrados" />

      <AddMemberModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        orgId={org._id}
        onAdded={() => { setShowAdd(false); onRefresh(); }}
        addToast={addToast}
      />
    </div>
  );
}

function AddMemberModal({ open, onClose, orgId, onAdded, addToast }) {
  const [form, setForm] = useState({
    firstName: '', lastName: '', rut: '', phone: '', email: ''
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  function set(field) {
    return (e) => {
      let value = e.target.value;
      if (field === 'rut') {
        const clean = value.replace(/\./g, '').replace(/-/g, '');
        value = clean ? formatRut(clean) : '';
      }
      setForm((f) => ({ ...f, [field]: value }));
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = {};
    if (!form.firstName || form.firstName.length < 2) errs.firstName = 'Nombre requerido';
    if (!form.lastName || form.lastName.length < 2) errs.lastName = 'Apellido requerido';
    if (!validateRut(form.rut)) errs.rut = 'RUT inválido';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      await apiService.updateOrganization(orgId, {
        addMember: {
          firstName: form.firstName,
          lastName: form.lastName,
          rut: form.rut,
          phone: form.phone,
          email: form.email
        }
      });
      addToast('Miembro agregado exitosamente', 'success');
      setForm({ firstName: '', lastName: '', rut: '', phone: '', email: '' });
      onAdded();
    } catch (error) {
      addToast(error.message || 'Error al agregar miembro', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Agregar Miembro">
      <form className="auth-form" onSubmit={handleSubmit}>
        <FormField label="Nombre *" id="add-member-name" type="text" placeholder="Juan" value={form.firstName} onChange={set('firstName')} error={errors.firstName} />
        <FormField label="Apellido *" id="add-member-lastname" type="text" placeholder="Pérez" value={form.lastName} onChange={set('lastName')} error={errors.lastName} />
        <FormField label="RUT *" id="add-member-rut" type="text" placeholder="12.345.678-9" value={form.rut} onChange={set('rut')} error={errors.rut} />
        <FormField label="Teléfono" id="add-member-phone" type="tel" placeholder="+56 9 1234 5678" value={form.phone} onChange={set('phone')} />
        <FormField label="Email" id="add-member-email" type="email" placeholder="juan@email.cl" value={form.email} onChange={set('email')} />
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: 12, background: '#f3f4f6', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
            Cancelar
          </button>
          <button type="submit" className="btn-auth" style={{ flex: 1 }} disabled={submitting}>
            {submitting ? 'Agregando...' : 'Agregar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
