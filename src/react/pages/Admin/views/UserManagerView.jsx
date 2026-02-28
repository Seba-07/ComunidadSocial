import { useState, useEffect, useMemo } from 'react';
import { useUsersStore } from '../../../stores/usersStore';
import { useUiStore } from '../../../stores/uiStore';
import Modal from '../../../components/ui/Modal';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import SearchBar from '../../../components/ui/SearchBar';
import FilterChips from '../../../components/ui/FilterChips';
import StatsGrid from '../../../components/ui/StatsGrid';
import DataTable from '../../../components/ui/DataTable';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';

const ROLE_LABELS = {
  ORGANIZADOR: 'Organizador', MUNICIPALIDAD: 'Municipalidad',
  MINISTRO_FE: 'Ministro de Fe', MIEMBRO: 'Miembro'
};

const ROLE_COLORS = {
  ORGANIZADOR: '#2563eb', MUNICIPALIDAD: '#8b5cf6',
  MINISTRO_FE: '#f59e0b', MIEMBRO: '#22c55e'
};

export default function UserManagerView() {
  const { users, stats, isLoading, fetchUsers, toggleActive, deleteUser } = useUsersStore();
  const addToast = useUiStore(s => s.addToast);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => { fetchUsers().catch(err => addToast(err.message, 'error')); }, []);

  const filtered = useMemo(() => {
    let result = users;
    if (filter !== 'all') result = result.filter(u => u.role === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(u =>
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.rut || '').includes(q)
      );
    }
    return result;
  }, [users, filter, search]);

  const statsCards = useMemo(() => {
    if (!stats) return [];
    return [
      { icon: '\uD83D\uDC65', label: 'Total', value: stats.total, color: '#2563eb' },
      { icon: '\u2705', label: 'Activos', value: stats.active, color: '#10b981' },
      { icon: '\u26A0\uFE0F', label: 'Inactivos', value: stats.inactive, color: '#f59e0b' },
      { icon: '\uD83D\uDC64', label: 'Organizadores', value: stats.byRole?.ORGANIZADOR || 0, color: '#2563eb' }
    ];
  }, [stats]);

  async function handleToggle(user) {
    try {
      await toggleActive(user._id, user._isMinistro);
      addToast(`Usuario ${user.isActive !== false ? 'desactivado' : 'activado'}`, 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteUser(deleteTarget._id, deleteTarget._isMinistro);
      addToast('Usuario eliminado', 'success');
      setDeleteTarget(null);
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  const columns = [
    {
      key: 'firstName', label: 'Nombre', sortable: true,
      render: (_, row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: ROLE_COLORS[row.role] || '#6b7280',
            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, flexShrink: 0
          }}>
            {(row.firstName || '?')[0]}{(row.lastName || '?')[0]}
          </div>
          <span>{row.firstName} {row.lastName}</span>
        </div>
      )
    },
    { key: 'email', label: 'Email', sortable: true },
    {
      key: 'role', label: 'Rol', sortable: true,
      render: (val) => (
        <span style={{
          padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
          background: (ROLE_COLORS[val] || '#6b7280') + '20',
          color: ROLE_COLORS[val] || '#6b7280'
        }}>
          {ROLE_LABELS[val] || val}
        </span>
      )
    },
    {
      key: 'isActive', label: 'Estado',
      render: (val) => (
        <span style={{
          padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
          background: val !== false ? '#d1fae5' : '#fee2e2',
          color: val !== false ? '#065f46' : '#991b1b'
        }}>
          {val !== false ? 'Activo' : 'Inactivo'}
        </span>
      )
    },
    {
      key: 'actions', label: 'Acciones', sortable: false,
      render: (_, row) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={(e) => { e.stopPropagation(); handleToggle(row); }} style={smallBtn}>
            {row.isActive !== false ? 'Desactivar' : 'Activar'}
          </button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(row); }}
            style={{ ...smallBtn, color: '#ef4444' }}>Eliminar</button>
        </div>
      )
    }
  ];

  if (isLoading && users.length === 0) return <LoadingSpinner text="Cargando usuarios..." />;

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ margin: '0 0 20px', fontSize: 24, fontWeight: 700, color: '#111827' }}>Usuarios</h1>

      {statsCards.length > 0 && <StatsGrid stats={statsCards} />}

      <div style={{ display: 'flex', gap: 16, marginTop: 20, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ maxWidth: 300, flex: 1 }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Buscar usuario..." />
        </div>
        <FilterChips
          filters={[
            { key: 'all', label: 'Todos', count: users.length },
            ...Object.entries(ROLE_LABELS).map(([key, label]) => ({
              key, label, color: ROLE_COLORS[key],
              count: users.filter(u => u.role === key).length
            }))
          ]}
          active={filter}
          onChange={setFilter}
        />
      </div>

      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <DataTable columns={columns} data={filtered} emptyMessage="No se encontraron usuarios" />
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar Usuario"
        message={`¿Eliminar a ${deleteTarget?.firstName} ${deleteTarget?.lastName}?`}
      />
    </div>
  );
}

const smallBtn = {
  padding: '5px 10px', border: '1px solid #d1d5db', borderRadius: 6,
  background: 'white', fontSize: 12, cursor: 'pointer', color: '#374151'
};
