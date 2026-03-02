import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useOrganizationStore } from '../../stores/organizationStore';
import { useAuthStore } from '../../stores/authStore';
import SharedSidebar from '../../components/layout/SharedSidebar';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import OrgOverview from './OrgOverview';
import OrgMembers from './OrgMembers';
import OrgDirectorio from './OrgDirectorio';
import OrgAsambleas from './OrgAsambleas';
import OrgDocumentos from './OrgDocumentos';
import OrgFinanzas from './OrgFinanzas';
import OrgComunicaciones from './OrgComunicaciones';

const ORG_MENU_ITEMS = [
  { key: 'overview', label: 'Resumen', icon: '📊' },
  { key: 'members', label: 'Miembros', icon: '👥' },
  { key: 'directorio', label: 'Directorio', icon: '👤' },
  { key: 'asambleas', label: 'Asambleas', icon: '🗣️' },
  { key: 'documentos', label: 'Documentos', icon: '📄' },
  { key: 'finanzas', label: 'Finanzas', icon: '💰' },
  { key: 'comunicaciones', label: 'Comunicaciones', icon: '✉️' },
];

export default function OrgDashboardPage() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState('overview');
  const { activeOrg, isLoading, error, fetchMyOrganizations, setActiveOrg, refreshActiveOrg } = useOrganizationStore();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    fetchMyOrganizations().then((orgs) => {
      if (!orgs?.length) return;
      if (id && id !== 'auto') {
        setActiveOrg(id);
      } else {
        setActiveOrg(orgs[0]._id);
      }
    });
  }, [id]);

  if (isLoading && !activeOrg) {
    return <LoadingSpinner text="Cargando organización..." />;
  }

  if (error) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <p style={{ color: '#ef4444', fontSize: 16 }}>Error: {error}</p>
        <button className="btn-auth" style={{ maxWidth: 200, margin: '16px auto' }} onClick={() => fetchMyOrganizations()}>
          Reintentar
        </button>
      </div>
    );
  }

  if (!activeOrg) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <p style={{ color: '#6b7280', fontSize: 16 }}>No se encontró la organización.</p>
      </div>
    );
  }

  const sidebarTitle = activeOrg.organizationName || 'Mi Organización';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb' }}>
      <SharedSidebar
        title={sidebarTitle}
        menuItems={ORG_MENU_ITEMS}
        activeKey={activeTab}
        onItemClick={setActiveTab}
      />

      {/* Main content - offset for fixed sidebar */}
      <main style={{ flex: 1, overflow: 'auto', marginLeft: 260, padding: 24, maxWidth: 1200 }}>
        {activeTab === 'overview' && <OrgOverview org={activeOrg} onNavigateTab={setActiveTab} />}
        {activeTab === 'members' && <OrgMembers org={activeOrg} onRefresh={refreshActiveOrg} />}
        {activeTab === 'directorio' && <OrgDirectorio org={activeOrg} />}
        {activeTab === 'asambleas' && <OrgAsambleas org={activeOrg} onRefresh={refreshActiveOrg} />}
        {activeTab === 'documentos' && <OrgDocumentos org={activeOrg} onRefresh={refreshActiveOrg} />}
        {activeTab === 'finanzas' && <OrgFinanzas org={activeOrg} onRefresh={refreshActiveOrg} />}
        {activeTab === 'comunicaciones' && <OrgComunicaciones org={activeOrg} onRefresh={refreshActiveOrg} />}
      </main>
    </div>
  );
}
