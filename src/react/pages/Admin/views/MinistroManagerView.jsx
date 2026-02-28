import { useState, useEffect } from 'react';
import { useMinistrosStore } from '../../../stores/ministrosStore';
import { useUiStore } from '../../../stores/uiStore';
import Modal from '../../../components/ui/Modal';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import SearchBar from '../../../components/ui/SearchBar';
import FilterChips from '../../../components/ui/FilterChips';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { formatRut } from '../../../utils/validators';

const EMPTY_FORM = {
  firstName: '', lastName: '', rut: '', email: '', phone: '',
  address: '', specialty: 'general', password: '', isActive: true
};

const SPECIALTIES = [
  { value: 'general', label: 'General' },
  { value: 'constitutiva', label: 'Asamblea Constitutiva' },
  { value: 'electoral', label: 'Proceso Electoral' },
  { value: 'extraordinaria', label: 'Asamblea Extraordinaria' }
];

export default function MinistroManagerView() {
  const { ministros, isLoading, fetchMinistros, createMinistro, updateMinistro, toggleActive, deleteMinistro } = useMinistrosStore();
  const addToast = useUiStore(s => s.addToast);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [credentials, setCredentials] = useState(null);

  useEffect(() => { fetchMinistros().catch(err => addToast(err.message, 'error')); }, []);

  const filtered = ministros.filter(m => {
    if (filter === 'active' && m.isActive === false) return false;
    if (filter === 'inactive' && m.isActive !== false) return false;
    if (search) {
      const q = search.toLowerCase();
      return `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) ||
        (m.rut || '').includes(q) || (m.email || '').toLowerCase().includes(q);
    }
    return true;
  });

  function openCreate() {
    setForm({ ...EMPTY_FORM });
    setEditId(null);
    setShowModal(true);
  }

  function openEdit(m) {
    setForm({
      firstName: m.firstName || '', lastName: m.lastName || '', rut: m.rut || '',
      email: m.email || '', phone: m.phone || '', address: m.address || '',
      specialty: m.specialty || 'general', password: '', isActive: m.isActive !== false
    });
    setEditId(m._id);
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.firstName || !form.lastName || !form.email) {
      addToast('Completa los campos requeridos', 'error');
      return;
    }
    if (!editId && !form.password) {
      addToast('Ingresa una contraseña', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        const { password, ...updates } = form;
        await updateMinistro(editId, updates);
        addToast('Ministro actualizado', 'success');
      } else {
        const data = await createMinistro(form);
        addToast('Ministro creado', 'success');
        setCredentials({ email: form.email, password: form.password });
      }
      setShowModal(false);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(m) {
    try {
      await toggleActive(m._id);
      addToast(`Ministro ${m.isActive !== false ? 'desactivado' : 'activado'}`, 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMinistro(deleteTarget._id);
      addToast('Ministro eliminado', 'success');
      setDeleteTarget(null);
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  if (isLoading && ministros.length === 0) return <LoadingSpinner text="Cargando ministros..." />;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#111827' }}>
          Ministros de Fe
        </h1>
        <button onClick={openCreate} style={{
          padding: '10px 20px', border: 'none', borderRadius: 10,
          background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white',
          fontSize: 14, fontWeight: 600, cursor: 'pointer'
        }}>
          Agregar Ministro
        </button>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ maxWidth: 300, flex: 1 }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Buscar ministro..." />
        </div>
        <FilterChips
          filters={[
            { key: 'all', label: 'Todos', count: ministros.length },
            { key: 'active', label: 'Activos', color: '#10b981', count: ministros.filter(m => m.isActive !== false).length },
            { key: 'inactive', label: 'Inactivos', color: '#ef4444', count: ministros.filter(m => m.isActive === false).length }
          ]}
          active={filter}
          onChange={setFilter}
        />
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}>No se encontraron ministros</p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {filtered.map(m => (
            <div key={m._id} style={{
              background: 'white', border: '1px solid #e5e7eb', borderRadius: 12,
              padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: m.isActive !== false ? '#2563eb' : '#9ca3af',
                  color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 16
                }}>
                  {(m.firstName || '?')[0]}{(m.lastName || '?')[0]}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: '#111827' }}>
                    {m.firstName} {m.lastName}
                  </div>
                  <div style={{ fontSize: 13, color: '#6b7280', display: 'flex', gap: 12 }}>
                    <span>{m.rut}</span>
                    <span>{m.email}</span>
                    <span>{SPECIALTIES.find(s => s.value === m.specialty)?.label || m.specialty}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{
                  padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                  background: m.isActive !== false ? '#d1fae5' : '#fee2e2',
                  color: m.isActive !== false ? '#065f46' : '#991b1b'
                }}>
                  {m.isActive !== false ? 'Activo' : 'Inactivo'}
                </span>
                <button onClick={() => handleToggle(m)} style={smallBtn}>{m.isActive !== false ? 'Desactivar' : 'Activar'}</button>
                <button onClick={() => openEdit(m)} style={smallBtn}>Editar</button>
                <button onClick={() => setDeleteTarget(m)} style={{ ...smallBtn, color: '#ef4444' }}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? 'Editar Ministro' : 'Nuevo Ministro'}>
        <div style={{ display: 'grid', gap: 14 }}>
          {[
            { key: 'firstName', label: 'Nombre', required: true },
            { key: 'lastName', label: 'Apellido', required: true },
            { key: 'rut', label: 'RUT', placeholder: '12.345.678-9' },
            { key: 'email', label: 'Email', type: 'email', required: true },
            { key: 'phone', label: 'Teléfono' },
            { key: 'address', label: 'Dirección' }
          ].map(f => (
            <div key={f.key}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                {f.label}{f.required && ' *'}
              </label>
              <input
                type={f.type || 'text'}
                value={form[f.key]}
                onChange={e => {
                  let val = e.target.value;
                  if (f.key === 'rut') val = formatRut(val);
                  setForm(p => ({ ...p, [f.key]: val }));
                }}
                placeholder={f.placeholder || ''}
                style={{
                  width: '100%', padding: 10, border: '1px solid #d1d5db',
                  borderRadius: 8, fontSize: 14
                }}
              />
            </div>
          ))}
          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Especialidad</label>
            <select value={form.specialty} onChange={e => setForm(p => ({ ...p, specialty: e.target.value }))}
              style={{ width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}>
              {SPECIALTIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          {!editId && (
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Contraseña *</label>
              <input type="password" value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                style={{ width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}
              />
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={() => setShowModal(false)} style={{ padding: '10px 20px', border: '1px solid #d1d5db', borderRadius: 10, background: 'white', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '10px 20px', border: 'none', borderRadius: 10, background: '#2563eb',
            color: 'white', fontSize: 14, fontWeight: 600, cursor: saving ? 'wait' : 'pointer'
          }}>{saving ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar Ministro"
        message={`¿Estás seguro de eliminar a ${deleteTarget?.firstName} ${deleteTarget?.lastName}?`}
      />

      {/* Credentials Modal */}
      <Modal open={!!credentials} onClose={() => setCredentials(null)} title="Credenciales Creadas">
        {credentials && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 16 }}>
            <p style={{ margin: '0 0 8px', fontSize: 14 }}><strong>Email:</strong> {credentials.email}</p>
            <p style={{ margin: 0, fontSize: 14 }}><strong>Contraseña:</strong> {credentials.password}</p>
          </div>
        )}
        <button onClick={() => setCredentials(null)} style={{
          marginTop: 16, padding: '10px 20px', border: 'none', borderRadius: 10,
          background: '#2563eb', color: 'white', fontSize: 14, cursor: 'pointer'
        }}>Cerrar</button>
      </Modal>
    </div>
  );
}

const smallBtn = {
  padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: 6,
  background: 'white', fontSize: 12, cursor: 'pointer', color: '#374151'
};
