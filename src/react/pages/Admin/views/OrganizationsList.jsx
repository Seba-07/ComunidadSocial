import { useState, useMemo } from 'react';
import { useAdminStore } from '../../../stores/adminStore';
import { useUiStore } from '../../../stores/uiStore';
import { ORG_STATUS_LABELS, ORG_STATUS_COLORS, localeDateString } from '../../../utils/formatters';
import FilterChips from '../../../components/ui/FilterChips';
import SearchBar from '../../../components/ui/SearchBar';
import StatsGrid from '../../../components/ui/StatsGrid';
import StatusBadge from '../../../components/ui/StatusBadge';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import OrgReviewModal from './OrgReviewModal';

const QUORUM_MINIMUMS = { JUNTA_VECINOS: 50 };
const DEFAULT_MINIMUM = 15;
function getMinMembers(orgType) {
  return QUORUM_MINIMUMS[orgType] || DEFAULT_MINIMUM;
}
function isGhostOrg(org) {
  if (org.status !== 'approved') return false;
  const activeMembers = org.activeMemberCount ?? org.memberCount ?? 0;
  const min = getMinMembers(org.organizationType || org.type);
  return activeMembers < min;
}

const STATUS_FILTERS = [
  { key: 'all', label: 'Todas' },
  { key: 'pending_review', label: 'Pendientes', color: '#f59e0b' },
  { key: 'in_review', label: 'En Revisión', color: '#8b5cf6' },
  { key: 'waiting_ministro', label: 'Esperando Ministro', color: '#f59e0b' },
  { key: 'ministro_scheduled', label: 'Ministro Agendado', color: '#3b82f6' },
  { key: 'ministro_approved', label: 'Aprobada Ministro', color: '#06b6d4' },
  { key: 'approved', label: 'Aprobadas', color: '#10b981' },
  { key: 'rejected', label: 'Rechazadas', color: '#ef4444' },
  { key: 'dissolved', label: 'Disueltas', color: '#6b7280' },
  { key: 'fantasma', label: 'Fantasmas', color: '#dc2626' },
  { key: 'draft', label: 'Borradores', color: '#6b7280' }
];

export default function OrganizationsList() {
  const {
    organizations, isLoading, currentFilter, searchQuery,
    setFilter, setSearchQuery, fetchAllOrganizations, selectedOrg, setSelectedOrg
  } = useAdminStore();
  const addToast = useUiStore(s => s.addToast);
  const [showReview, setShowReview] = useState(false);

  const ghostCount = useMemo(() => organizations.filter(isGhostOrg).length, [organizations]);

  const filtersWithCounts = useMemo(() =>
    STATUS_FILTERS.map(f => ({
      ...f,
      count: f.key === 'all'
        ? organizations.filter(o => o.status !== 'draft').length
        : f.key === 'fantasma'
        ? ghostCount
        : organizations.filter(o => o.status === f.key).length
    })), [organizations, ghostCount]);

  const filtered = useMemo(() => {
    let result = organizations;
    if (currentFilter === 'all') {
      result = result.filter(o => o.status !== 'draft');
    } else if (currentFilter === 'fantasma') {
      result = result.filter(isGhostOrg);
    } else {
      result = result.filter(o => o.status === currentFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(o =>
        (o.organizationName || o.name || '').toLowerCase().includes(q) ||
        (o.organizationType || o.type || '').toLowerCase().includes(q) ||
        (o.comuna || o.commune || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [organizations, currentFilter, searchQuery]);

  const stats = useMemo(() => [
    { icon: '\uD83C\uDFE2', label: 'Total', value: organizations.filter(o => o.status !== 'draft').length, color: '#2563eb' },
    { icon: '\u23F3', label: 'Pendientes', value: organizations.filter(o => o.status === 'pending_review').length, color: '#f59e0b' },
    { icon: '\u2705', label: 'Aprobadas', value: organizations.filter(o => o.status === 'approved').length, color: '#10b981' },
    { icon: '\u274C', label: 'Rechazadas', value: organizations.filter(o => o.status === 'rejected').length, color: '#ef4444' },
    { icon: '\uD83D\uDC7B', label: 'Fantasmas', value: ghostCount, color: '#dc2626' }
  ], [organizations, ghostCount]);

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
    <div className="admin-orgs-page" style={{ padding: 24 }}>
      <div className="r-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
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

      <div style={{ marginBottom: 20 }}>
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
              className="org-list-card"
              style={{
                background: 'white', border: '1px solid #e5e7eb', borderRadius: 12,
                padding: 20, cursor: 'pointer', transition: 'box-shadow 0.15s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>
                  {org.organizationName || org.name || 'Sin nombre'}
                </span>
                <StatusBadge status={org.status} />
                {isGhostOrg(org) && (
                  <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 10, fontWeight: 700, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                    Quórum Insuficiente
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, color: '#6b7280', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <span>{(org.organizationType || org.type || 'Sin tipo').replace(/_/g, ' ')}</span>
                {(org.comuna || org.commune) && <span>{org.comuna || org.commune}</span>}
                {org.memberCount != null && (
                  <span style={{ color: isGhostOrg(org) ? '#dc2626' : undefined, fontWeight: isGhostOrg(org) ? 600 : undefined }}>
                    {org.activeMemberCount ?? org.memberCount}/{getMinMembers(org.organizationType || org.type)} socios
                  </span>
                )}
                {org.createdAt && (
                  <span>{localeDateString(org.createdAt)}</span>
                )}
              </div>
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
