import { useState, useEffect } from 'react';
import { useOrganizationStore } from '../../stores/organizationStore';
import { useAuthStore } from '../../stores/authStore';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import OrgInfo from './OrgInfo';
import MembersList from './MembersList';
import MemberDirectorio from './MemberDirectorio';
import AssemblyList from './AssemblyList';
import MemberDocuments from './MemberDocuments';
import MemberPassword from './MemberPassword';

const TABS = [
  { id: 'overview', label: 'Resumen' },
  { id: 'directorio', label: 'Directorio' },
  { id: 'members', label: 'Miembros' },
  { id: 'assemblies', label: 'Asambleas' },
  { id: 'documents', label: 'Documentos' },
  { id: 'password', label: 'Contraseña' }
];

export default function MemberDashboardPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const { organizations, activeOrg, isLoading, error, fetchMemberOrganization, refreshActiveOrg, setActiveOrg } = useOrganizationStore();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    fetchMemberOrganization();
  }, []);

  if (isLoading && !activeOrg) {
    return <LoadingSpinner text="Cargando organización..." />;
  }

  if (error) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <p style={{ color: '#ef4444', fontSize: 16 }}>Error: {error}</p>
        <button className="btn-auth" style={{ maxWidth: 200, margin: '16px auto' }} onClick={() => fetchMemberOrganization()}>
          Reintentar
        </button>
      </div>
    );
  }

  if (!activeOrg) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <p style={{ color: '#6b7280', fontSize: 16 }}>No perteneces a ninguna organización.</p>
      </div>
    );
  }

  const hasMultipleOrgs = organizations.length > 1;

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      {/* Header */}
      <header style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
        color: 'white',
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/icons/logo_renca.png" alt="Logo" style={{ width: 40, height: 'auto' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Comunidad Renca</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Panel de Socio</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {hasMultipleOrgs && (
            <select
              value={activeOrg._id}
              onChange={(e) => setActiveOrg(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              {organizations.map((org) => (
                <option key={org._id} value={org._id} style={{ color: '#1e3a8a' }}>
                  {org.organizationName}
                </option>
              ))}
            </select>
          )}
          <span style={{ fontSize: 14 }}>{user?.firstName} {user?.lastName}</span>
          <button
            onClick={() => { logout(); window.location.href = '/app/login'; }}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            Cerrar Sesión
          </button>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav style={{
        background: 'white',
        borderBottom: '1px solid #e5e7eb',
        padding: '0 24px',
        display: 'flex',
        gap: 0,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch'
      }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '14px 20px',
              border: 'none',
              borderBottom: activeTab === tab.id ? '3px solid #2563eb' : '3px solid transparent',
              background: 'transparent',
              color: activeTab === tab.id ? '#2563eb' : '#6b7280',
              fontWeight: activeTab === tab.id ? 600 : 400,
              fontSize: 14,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
        {activeTab === 'overview' && <OrgInfo org={activeOrg} />}
        {activeTab === 'directorio' && <MemberDirectorio org={activeOrg} />}
        {activeTab === 'members' && <MembersList members={activeOrg.members} />}
        {activeTab === 'assemblies' && (
          <AssemblyList
            assemblies={activeOrg.assemblies || []}
            orgId={activeOrg._id}
            currentUser={user}
            onRefresh={refreshActiveOrg}
          />
        )}
        {activeTab === 'documents' && <MemberDocuments org={activeOrg} />}
        {activeTab === 'password' && <MemberPassword />}
      </main>
    </div>
  );
}
