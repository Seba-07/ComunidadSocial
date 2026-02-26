import { useState } from 'react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import FormField from '../../components/ui/FormField';
import { apiService } from '@services/ApiService.js';
import { useUiStore } from '../../stores/uiStore';
import { validateRut, formatRut } from '../../utils/validators';

function calcAge(birthDate) {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export default function OrgMembers({ org, onRefresh }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editMember, setEditMember] = useState(null);
  const [viewMember, setViewMember] = useState(null);
  const [search, setSearch] = useState('');
  const addToast = useUiStore((s) => s.addToast);

  const members = org?.members || [];
  const activeCount = members.filter((m) => m.status !== 'inactive').length;
  const filtered = search
    ? members.filter((m) => {
        const q = search.toLowerCase();
        return (m.firstName || '').toLowerCase().includes(q) ||
          (m.lastName || '').toLowerCase().includes(q) ||
          (m.rut || '').includes(q);
      })
    : members;

  async function handleDelete(member) {
    const name = `${member.firstName} ${member.lastName}`;
    if (!confirm(`¿Estás seguro de eliminar a ${name}?`)) return;
    try {
      await apiService.updateOrganization(org._id, { removeMemberRut: member.rut });
      addToast(`${name} eliminado`, 'success');
      onRefresh();
    } catch (error) {
      addToast(error.message || 'Error al eliminar', 'error');
    }
  }

  const columns = [
    {
      key: 'name',
      label: 'Nombre',
      render: (_, row) => (
        <span style={{ fontWeight: 500, cursor: 'pointer', color: '#1e40af' }} onClick={() => setViewMember(row)}>
          {row.firstName} {row.lastName}
        </span>
      )
    },
    { key: 'rut', label: 'RUT' },
    {
      key: 'age',
      label: 'Edad',
      render: (_, row) => {
        const age = calcAge(row.birthDate);
        if (age === null) return '—';
        return (
          <span>
            {age} años
            {age < 18 && <span style={{ marginLeft: 6, fontSize: 11, padding: '1px 8px', borderRadius: 8, background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>Menor</span>}
          </span>
        );
      }
    },
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
      key: 'actions',
      label: 'Acciones',
      sortable: false,
      render: (_, row) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setViewMember(row)} style={actionBtnStyle}>Ver</button>
          <button onClick={() => setEditMember(row)} style={actionBtnStyle}>Editar</button>
          <button onClick={() => handleDelete(row)} style={{ ...actionBtnStyle, color: '#ef4444', borderColor: '#fca5a5' }}>Eliminar</button>
        </div>
      )
    }
  ];

  const data = filtered.map((m) => ({ ...m, name: `${m.firstName} ${m.lastName}` }));

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        <div style={{ background: '#eff6ff', borderRadius: 12, padding: '12px 20px' }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Total socios</span>
          <span style={{ display: 'block', fontSize: 22, fontWeight: 700, color: '#1e40af' }}>{members.length}</span>
        </div>
        <div style={{ background: '#f0fdf4', borderRadius: 12, padding: '12px 20px' }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Activos</span>
          <span style={{ display: 'block', fontSize: 22, fontWeight: 700, color: '#059669' }}>{activeCount}</span>
        </div>
      </div>

      {/* Info */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: 14, marginBottom: 16, fontSize: 13, color: '#1e40af' }}>
        Para ser socio se requiere tener al menos 14 años de edad y residencia en la unidad vecinal respectiva.
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1e3a8a', margin: 0 }}>
          Miembros
        </h3>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input type="text" placeholder="Buscar por nombre o RUT..." value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, width: 260 }} />
          <button className="btn-primary" style={{ padding: '8px 16px', fontSize: 14 }} onClick={() => setShowAdd(true)}>
            + Agregar Miembro
          </button>
        </div>
      </div>

      <DataTable columns={columns} data={data} emptyMessage="No hay miembros registrados" />

      {/* Add Member Modal */}
      <MemberFormModal open={showAdd} onClose={() => setShowAdd(false)} orgId={org._id}
        onSaved={() => { setShowAdd(false); onRefresh(); }} addToast={addToast} />

      {/* Edit Member Modal */}
      <MemberFormModal open={!!editMember} onClose={() => setEditMember(null)} orgId={org._id}
        member={editMember} onSaved={() => { setEditMember(null); onRefresh(); }} addToast={addToast} />

      {/* View Member Modal */}
      <MemberProfileModal open={!!viewMember} onClose={() => setViewMember(null)} member={viewMember} org={org} />
    </div>
  );
}

const actionBtnStyle = {
  padding: '3px 10px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6,
  background: 'white', cursor: 'pointer', color: '#374151', fontWeight: 500
};

// ========== Member Form Modal (Add / Edit) ==========
function MemberFormModal({ open, onClose, orgId, member, onSaved, addToast }) {
  const isEdit = !!member;
  const [form, setForm] = useState({
    firstName: '', lastName: '', rut: '', phone: '', email: '', birthDate: '', address: ''
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Reset form when member changes
  useState(() => {
    if (member) {
      setForm({
        firstName: member.firstName || '',
        lastName: member.lastName || '',
        rut: member.rut || '',
        phone: member.phone || '',
        email: member.email || '',
        birthDate: member.birthDate ? member.birthDate.slice(0, 10) : '',
        address: member.address || ''
      });
    } else {
      setForm({ firstName: '', lastName: '', rut: '', phone: '', email: '', birthDate: '', address: '' });
    }
  }, [member]);

  // Also handle open state changes
  if (open && member && form.firstName === '' && member.firstName) {
    setForm({
      firstName: member.firstName || '',
      lastName: member.lastName || '',
      rut: member.rut || '',
      phone: member.phone || '',
      email: member.email || '',
      birthDate: member.birthDate ? member.birthDate.slice(0, 10) : '',
      address: member.address || ''
    });
  }

  function set(field) {
    return (e) => {
      let value = e.target.value;
      if (field === 'rut' && !isEdit) {
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
    if (!isEdit && !validateRut(form.rut)) errs.rut = 'RUT inválido';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      if (isEdit) {
        await apiService.updateOrganization(orgId, {
          updateMember: {
            rut: member.rut,
            firstName: form.firstName,
            lastName: form.lastName,
            phone: form.phone,
            email: form.email,
            birthDate: form.birthDate || undefined,
            address: form.address
          }
        });
        addToast('Miembro actualizado', 'success');
      } else {
        await apiService.updateOrganization(orgId, {
          addMember: {
            firstName: form.firstName,
            lastName: form.lastName,
            rut: form.rut,
            phone: form.phone,
            email: form.email,
            birthDate: form.birthDate || undefined,
            address: form.address
          }
        });
        addToast('Miembro agregado exitosamente', 'success');
      }
      setForm({ firstName: '', lastName: '', rut: '', phone: '', email: '', birthDate: '', address: '' });
      onSaved();
    } catch (error) {
      addToast(error.message || 'Error', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar Miembro' : 'Agregar Miembro'}>
      <form className="auth-form" onSubmit={handleSubmit}>
        <FormField label="Nombre *" id="m-fname" type="text" placeholder="Juan" value={form.firstName} onChange={set('firstName')} error={errors.firstName} />
        <FormField label="Apellido *" id="m-lname" type="text" placeholder="Pérez" value={form.lastName} onChange={set('lastName')} error={errors.lastName} />
        {!isEdit && <FormField label="RUT *" id="m-rut" type="text" placeholder="12.345.678-9" value={form.rut} onChange={set('rut')} error={errors.rut} />}
        <FormField label="Fecha de Nacimiento" id="m-birth" type="date" value={form.birthDate} onChange={set('birthDate')} />
        <FormField label="Teléfono" id="m-phone" type="tel" placeholder="+56 9 1234 5678" value={form.phone} onChange={set('phone')} />
        <FormField label="Email" id="m-email" type="email" placeholder="juan@email.cl" value={form.email} onChange={set('email')} />
        <FormField label="Dirección" id="m-address" type="text" placeholder="Calle 123" value={form.address} onChange={set('address')} />
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: 12, background: '#f3f4f6', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
            Cancelar
          </button>
          <button type="submit" className="btn-auth" style={{ flex: 1 }} disabled={submitting}>
            {submitting ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Agregar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ========== Member Profile Modal ==========
function MemberProfileModal({ open, onClose, member, org }) {
  if (!member) return null;

  const age = calcAge(member.birthDate);
  const dir = org?.provisionalDirectorio;
  let dirRole = null;
  if (dir) {
    const rut = member.rut;
    if (dir.president?.rut === rut) dirRole = 'Presidente';
    else if (dir.vicePresident?.rut === rut) dirRole = 'Vicepresidente';
    else if (dir.secretary?.rut === rut) dirRole = 'Secretario';
    else if (dir.treasurer?.rut === rut) dirRole = 'Tesorero';
    else if (dir.additionalMembers?.some((m) => m?.rut === rut)) dirRole = 'Director';
  }

  return (
    <Modal open={open} onClose={onClose} title="Perfil de Miembro">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', background: '#3b82f6', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700
        }}>
          {(member.firstName || '?')[0].toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1e3a8a' }}>{member.firstName} {member.lastName}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {dirRole && <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: '#dbeafe', color: '#1e40af' }}>{dirRole}</span>}
            <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: member.role === 'directivo' ? '#dbeafe' : '#f3f4f6', color: member.role === 'directivo' ? '#1e40af' : '#374151' }}>
              {member.role === 'directivo' ? 'Directivo' : 'Socio'}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <ProfileField label="RUT" value={member.rut} />
        <ProfileField label="Edad" value={age !== null ? `${age} años${age < 18 ? ' (Menor de edad)' : ''}` : '—'} />
        <ProfileField label="Fecha de Nacimiento" value={member.birthDate ? new Date(member.birthDate).toLocaleDateString('es-CL') : '—'} />
        <ProfileField label="Teléfono" value={member.phone || '—'} />
        <ProfileField label="Email" value={member.email || '—'} />
        <ProfileField label="Dirección" value={member.address || '—'} />
        <ProfileField label="Estado" value={member.status === 'inactive' ? 'Inactivo' : 'Activo'} />
        <ProfileField label="Fecha de Ingreso" value={member.joinDate ? new Date(member.joinDate).toLocaleDateString('es-CL') : '—'} />
      </div>
    </Modal>
  );
}

function ProfileField({ label, value }) {
  return (
    <div style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 12px' }}>
      <span style={{ fontSize: 11, color: '#6b7280', display: 'block' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>{value}</span>
    </div>
  );
}
