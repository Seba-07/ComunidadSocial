import { useState, useEffect, useMemo } from 'react';
import { apiService } from '@services/ApiService.js';
import { useUiStore } from '../../../stores/uiStore';
import Modal from '../../../components/ui/Modal';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import SearchBar from '../../../components/ui/SearchBar';
import StatsGrid from '../../../components/ui/StatsGrid';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';

const EMPTY_UV = {
  numero: '', idOficial: '', nombre: '', macrozona: '',
  poblaciones: [], calles: [], limites: { norte: '', sur: '', oriente: '', poniente: '' },
  notas: ''
};

export default function UnidadesVecinalesView() {
  const addToast = useUiStore(s => s.addToast);
  const [unidades, setUnidades] = useState([]);
  const [macrozonas, setMacrozonas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterMz, setFilterMz] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_UV });
  const [tagInput, setTagInput] = useState({ poblaciones: '', calles: '' });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function loadData() {
    setIsLoading(true);
    try {
      const [uvData, mzData] = await Promise.all([
        apiService.get('/unidades-vecinales'),
        apiService.get('/unidades-vecinales/macrozonas').catch(() => ({ macrozonas: [] }))
      ]);
      setUnidades(uvData.unidades || uvData || []);
      setMacrozonas(mzData.macrozonas || mzData || []);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    let result = unidades;
    if (filterMz) result = result.filter(u => u.macrozona === filterMz);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(u =>
        (u.numero || '').toLowerCase().includes(q) ||
        (u.nombre || '').toLowerCase().includes(q) ||
        (u.poblaciones || []).some(p => p.toLowerCase().includes(q)) ||
        (u.calles || []).some(c => c.toLowerCase().includes(q))
      );
    }
    return result;
  }, [unidades, filterMz, search]);

  const stats = useMemo(() => {
    const mzCounts = {};
    unidades.forEach(u => { mzCounts[u.macrozona || 'Sin MZ'] = (mzCounts[u.macrozona || 'Sin MZ'] || 0) + 1; });
    return [
      { icon: '\uD83D\uDDFA\uFE0F', label: 'Total UV', value: unidades.length, color: '#2563eb' },
      ...Object.entries(mzCounts).slice(0, 3).map(([mz, count]) => ({
        icon: '\uD83D\uDCCD', label: mz, value: count, color: '#8b5cf6'
      }))
    ];
  }, [unidades]);

  function openCreate() {
    setForm({ ...EMPTY_UV });
    setEditId(null);
    setShowModal(true);
  }

  function openEdit(uv) {
    setForm({
      numero: uv.numero || '', idOficial: uv.idOficial || '', nombre: uv.nombre || '',
      macrozona: uv.macrozona || '', poblaciones: uv.poblaciones || [],
      calles: uv.calles || [], limites: uv.limites || { norte: '', sur: '', oriente: '', poniente: '' },
      notas: uv.notas || ''
    });
    setEditId(uv._id);
    setShowModal(true);
  }

  function addTag(field) {
    const val = tagInput[field]?.trim();
    if (!val) return;
    setForm(f => ({ ...f, [field]: [...f[field], val] }));
    setTagInput(t => ({ ...t, [field]: '' }));
  }

  function removeTag(field, idx) {
    setForm(f => ({ ...f, [field]: f[field].filter((_, i) => i !== idx) }));
  }

  async function handleSave() {
    if (!form.numero || !form.idOficial) {
      addToast('Número e ID oficial son requeridos', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await apiService.put(`/unidades-vecinales/${editId}`, form);
        addToast('Unidad vecinal actualizada', 'success');
      } else {
        await apiService.post('/unidades-vecinales', form);
        addToast('Unidad vecinal creada', 'success');
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await apiService.delete(`/unidades-vecinales/${deleteTarget._id}`);
      addToast('Unidad vecinal eliminada', 'success');
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  if (isLoading) return <LoadingSpinner text="Cargando unidades vecinales..." />;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#111827' }}>Unidades Vecinales</h1>
        <button onClick={openCreate} style={{
          padding: '10px 20px', border: 'none', borderRadius: 10,
          background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white',
          fontSize: 14, fontWeight: 600, cursor: 'pointer'
        }}>Nueva Unidad</button>
      </div>

      <StatsGrid stats={stats} />

      <div style={{ display: 'flex', gap: 16, marginTop: 20, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ maxWidth: 300, flex: 1 }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Buscar UV..." />
        </div>
        {macrozonas.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => setFilterMz(null)} style={{
              padding: '5px 12px', borderRadius: 16, border: !filterMz ? '1px solid #2563eb' : '1px solid #d1d5db',
              background: !filterMz ? '#2563eb' : 'white', color: !filterMz ? 'white' : '#374151',
              fontSize: 12, cursor: 'pointer'
            }}>Todas</button>
            {macrozonas.map(mz => {
              const name = mz.macrozona || mz.name || mz;
              return (
                <button key={name} onClick={() => setFilterMz(name)} style={{
                  padding: '5px 12px', borderRadius: 16,
                  border: filterMz === name ? '1px solid #2563eb' : '1px solid #d1d5db',
                  background: filterMz === name ? '#2563eb' : 'white',
                  color: filterMz === name ? 'white' : '#374151',
                  fontSize: 12, cursor: 'pointer'
                }}>{name}</button>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {filtered.map(uv => (
          <div key={uv._id} style={{
            background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#2563eb' }}>UV {uv.numero}</h3>
              {uv.macrozona && <span style={{
                padding: '2px 8px', borderRadius: 10, background: '#ede9fe',
                color: '#7c3aed', fontSize: 11, fontWeight: 600
              }}>{uv.macrozona}</span>}
            </div>
            {uv.nombre && <p style={{ margin: '0 0 8px', fontSize: 14, color: '#374151' }}>{uv.nombre}</p>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              {(uv.poblaciones || []).slice(0, 3).map((p, i) => (
                <span key={i} style={{
                  padding: '2px 8px', borderRadius: 8, background: '#f3f4f6',
                  fontSize: 11, color: '#6b7280'
                }}>{p}</span>
              ))}
              {(uv.poblaciones || []).length > 3 && (
                <span style={{ fontSize: 11, color: '#6b7280' }}>+{uv.poblaciones.length - 3}</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => openEdit(uv)} style={smallBtn}>Editar</button>
              <button onClick={() => setDeleteTarget(uv)} style={{ ...smallBtn, color: '#ef4444' }}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Create/Edit */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? 'Editar UV' : 'Nueva UV'}>
        <div style={{ display: 'grid', gap: 14, maxHeight: '60vh', overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { key: 'numero', label: 'Número *' },
              { key: 'idOficial', label: 'ID Oficial *' },
              { key: 'nombre', label: 'Nombre' },
              { key: 'macrozona', label: 'Macrozona' }
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>{f.label}</label>
                <input value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
              </div>
            ))}
          </div>

          {['poblaciones', 'calles'].map(field => (
            <div key={field}>
              <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4, textTransform: 'capitalize' }}>
                {field}
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={tagInput[field]} onChange={e => setTagInput(t => ({ ...t, [field]: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag(field))}
                  placeholder={`Agregar ${field}...`}
                  style={{ flex: 1, padding: 8, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
                <button onClick={() => addTag(field)} style={{
                  padding: '8px 14px', border: 'none', borderRadius: 8, background: '#2563eb',
                  color: 'white', fontSize: 13, cursor: 'pointer'
                }}>+</button>
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                {form[field].map((tag, i) => (
                  <span key={i} style={{
                    padding: '3px 10px', borderRadius: 12, background: '#e5e7eb',
                    fontSize: 12, display: 'flex', alignItems: 'center', gap: 4
                  }}>
                    {tag}
                    <button onClick={() => removeTag(field, i)} style={{
                      background: 'none', border: 'none', cursor: 'pointer', fontSize: 14,
                      color: '#6b7280', lineHeight: 1, padding: 0
                    }}>&times;</button>
                  </span>
                ))}
              </div>
            </div>
          ))}

          <div>
            <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>Límites</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {['norte', 'sur', 'oriente', 'poniente'].map(dir => (
                <input key={dir} value={form.limites[dir]} placeholder={dir.charAt(0).toUpperCase() + dir.slice(1)}
                  onChange={e => setForm(f => ({ ...f, limites: { ...f.limites, [dir]: e.target.value } }))}
                  style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }} />
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 }}>Notas</label>
            <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
              rows={2} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, resize: 'vertical' }} />
          </div>
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
        title="Eliminar Unidad Vecinal"
        message={`¿Eliminar UV ${deleteTarget?.numero}? Las organizaciones asociadas no se verán afectadas.`}
      />
    </div>
  );
}

const smallBtn = {
  padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: 6,
  background: 'white', fontSize: 12, cursor: 'pointer', color: '#374151'
};
