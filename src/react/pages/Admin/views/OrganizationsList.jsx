import { useState, useMemo } from 'react';
import { useAdminStore } from '../../../stores/adminStore';
import { useUiStore } from '../../../stores/uiStore';
import { ORG_STATUS_LABELS, ORG_STATUS_COLORS } from '../../../utils/formatters';
import FilterChips from '../../../components/ui/FilterChips';
import SearchBar from '../../../components/ui/SearchBar';
import StatsGrid from '../../../components/ui/StatsGrid';
import StatusBadge from '../../../components/ui/StatusBadge';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import OrgReviewModal from './OrgReviewModal';

const STATUS_FILTERS = [
  { key: 'all', label: 'Todas' },
  { key: 'pending_review', label: 'Pendientes', color: '#f59e0b' },
  { key: 'in_review', label: 'En Revisión', color: '#8b5cf6' },
  { key: 'waiting_ministro', label: 'Esperando Ministro', color: '#f59e0b' },
  { key: 'ministro_scheduled', label: 'Ministro Agendado', color: '#3b82f6' },
  { key: 'ministro_approved', label: 'Aprobada Ministro', color: '#06b6d4' },
  { key: 'approved', label: 'Aprobadas', color: '#10b981' },
  { key: 'rejected', label: 'Rechazadas', color: '#ef4444' },
  { key: 'draft', label: 'Borradores', color: '#6b7280' }
];

export default function OrganizationsList() {
  const {
    organizations, isLoading, currentFilter, searchQuery,
    setFilter, setSearchQuery, fetchAllOrganizations, selectedOrg, setSelectedOrg
  } = useAdminStore();
  const addToast = useUiStore(s => s.addToast);
  const [showReview, setShowReview] = useState(false);

  const filtersWithCounts = useMemo(() =>
    STATUS_FILTERS.map(f => ({
      ...f,
      count: f.key === 'all'
        ? organizations.length
        : organizations.filter(o => o.status === f.key).length
    })), [organizations]);

  const filtered = useMemo(() => {
    let result = organizations;
    if (currentFilter !== 'all') {
      result = result.filter(o => o.status === currentFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(o =>
        (o.name || '').toLowerCase().includes(q) ||
        (o.type || '').toLowerCase().includes(q) ||
        (o.commune || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [organizations, currentFilter, searchQuery]);

  const stats = useMemo(() => [
    { icon: '\uD83C\uDFE2', label: 'Total', value: organizations.length, color: '#2563eb' },
    { icon: '\u23F3', label: 'Pendientes', value: organizations.filter(o => o.status === 'pending_review').length, color: '#f59e0b' },
    { icon: '\u2705', label: 'Aprobadas', value: organizations.filter(o => o.status === 'approved').length, color: '#10b981' },
    { icon: '\u274C', label: 'Rechazadas', value: organizations.filter(o => o.status === 'rejected').length, color: '#ef4444' }
  ], [organizations]);

  function openReview(org) {
    setSelectedOrg(org);
    setShowReview(true);
  }

  function handleCloseReview() {
    setShowReview(false);
    setSelectedOrg(null);
  }

  async function handleRefresh() {
    try {
      await fetchAllOrganizations();
      addToast('Lista actualizada', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  if (isLoading && organizations.length === 0) {
    return <LoadingSpinner text="Cargando organizaciones..." />;
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#111827' }}>
          Organizaciones
        </h1>
        <button onClick={handleRefresh} style={{
          padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 8,
          background: 'white', fontSize: 13, cursor: 'pointer', color: '#374151'
        }}>
          Actualizar
        </button>
      </div>

      <StatsGrid stats={stats} />

      <div style={{ marginTop: 20, marginBottom: 16 }}>
        <FilterChips filters={filtersWithCounts} active={currentFilter} onChange={setFilter} />
      </div>

      <div style={{ marginBottom: 20, maxWidth: 400 }}>
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Buscar por nombre, tipo o comuna..."
        />
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}>
          No se encontraron organizaciones
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {filtered.map(org => (
            <div
              key={org._id}
              onClick={() => openReview(org)}
              style={{
                background: 'white', border: '1px solid #e5e7eb', borderRadius: 12,
                padding: 20, cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', transition: 'box-shadow 0.15s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 18, fontWeight: 600, color: '#111827' }}>
                    {org.name || 'Sin nombre'}
                  </span>
                  <StatusBadge status={org.status} />
                </div>
                <div style={{ fontSize: 13, color: '#6b7280', display: 'flex', gap: 16 }}>
                  <span>{org.type || 'Sin tipo'}</span>
                  {org.commune && <span>{org.commune}</span>}
                  {org.members && <span>{org.members.length} miembros</span>}
                  {org.createdAt && (
                    <span>{new Date(org.createdAt).toLocaleDateString('es-CL')}</span>
                  )}
                </div>
              </div>
              <span style={{ color: '#9ca3af', fontSize: 20 }}>&rsaquo;</span>
            </div>
          ))}
        </div>
      )}

      {showReview && selectedOrg && (
        <OrgReviewModal
          org={selectedOrg}
          onClose={handleCloseReview}
        />
      )}
    </div>
  );
}
