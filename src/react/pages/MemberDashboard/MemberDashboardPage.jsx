import { useState, useEffect } from 'react';
import { useOrganizationStore } from '../../stores/organizationStore';
import { useAuthStore } from '../../stores/authStore';
import SharedHeader from '../../components/layout/SharedHeader';
import SharedSidebar from '../../components/layout/SharedSidebar';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import OrgInfo from './OrgInfo';
import MembersList from './MembersList';
import MemberDirectorio from './MemberDirectorio';
import AssemblyList from './AssemblyList';
import MemberDocuments from './MemberDocuments';
import MemberPassword from './MemberPassword';

const MEMBER_MENU_ITEMS = [
  { key: 'overview', label: 'Información', icon: '🏠' },
  { key: 'directorio', label: 'Directorio', icon: '📇' },
  { key: 'members', label: 'Miembros', icon: '🤝' },
  { key: 'assemblies', label: 'Asambleas', icon: '📢' },
  { key: 'documents', label: 'Documentos', icon: '📄' },
  { key: 'password', label: 'Contraseña', icon: '🔑' }
];

export default function MemberDashboardPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const { organizations, activeOrg, isLoading, error, fetchMemberOrganization, refreshActiveOrg, setActiveOrg } = useOrganizationStore();
  const user = useAuthStore((s) => s.user);

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
  const sidebarTitle = activeOrg.organizationName || 'Mi Organización';

  const orgSelectorHeader = hasMultipleOrgs ? (
    <div className="unified-sidebar__org-container">
      <span className="unified-sidebar__org-label">Mi Organización</span>
      <select
        className="unified-sidebar__org-selector"
        value={activeOrg._id}
        onChange={(e) => setActiveOrg(e.target.value)}
      >
        {organizations.map((org) => (
          <option key={org._id} value={org._id}>
            {org.organizationName}
          </option>
        ))}
      </select>
    </div>
  ) : null;

  return (
    <>
      <SharedHeader />
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb', paddingTop: 'var(--header-height, 60px)' }}>
        <SharedSidebar
          title={sidebarTitle}
          menuItems={MEMBER_MENU_ITEMS}
          activeKey={activeTab}
          onItemClick={setActiveTab}
          header={orgSelectorHeader}
        />
        <main style={{ flex: 1, overflow: 'auto', marginLeft: 'var(--sidebar-width, 260px)', transition: 'margin-left 0.25s ease', padding: 24, maxWidth: 1200 }}>
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
    </>
  );
}
