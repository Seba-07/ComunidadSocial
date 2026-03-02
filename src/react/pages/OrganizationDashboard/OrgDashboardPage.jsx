import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOrganizationStore } from '../../stores/organizationStore';
import { useAuthStore } from '../../stores/authStore';
import SharedHeader from '../../components/layout/SharedHeader';
import SharedSidebar from '../../components/layout/SharedSidebar';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import OrgOverview from './OrgOverview';
import OrgMembers from './OrgMembers';
import OrgDirectorio from './OrgDirectorio';
import OrgAsambleas from './OrgAsambleas';
import OrgDocumentos from './OrgDocumentos';
import OrgFinanzas from './OrgFinanzas';
import OrgComunicaciones from './OrgComunicaciones';
import OrgElecciones from './OrgElecciones';
import OrgProyectos from './OrgProyectos';
import OrgActividades from './OrgActividades';

// Org-specific menu items (shown when an org is selected)
const ORG_MENU_ITEMS = [
  { key: 'overview', label: 'Resumen', icon: '📊' },
  { key: 'members', label: 'Socios', icon: '👥' },
  { key: 'directorio', label: 'Directorio', icon: '👤' },
  { key: 'asambleas', label: 'Asambleas', icon: '🗣️' },
  { key: 'elecciones', label: 'Elecciones', icon: '✅' },
  { key: 'comunicaciones', label: 'Comunicaciones', icon: '✉️' },
  { key: 'finanzas', label: 'Finanzas', icon: '💰' },
  { key: 'proyectos', label: 'Proyectos', icon: '📁' },
  { key: 'documentos', label: 'Documentos', icon: '📄' },
  { key: 'actividades', label: 'Actividades', icon: '📅' },
];

// Secondary items (always shown, below org section)
const SECONDARY_MENU_ITEMS = [
  { key: 'crear-org', label: 'Crear Organización', icon: '🏠' },
  { key: 'guia', label: 'Guía', icon: '📑' },
  { key: 'biblioteca', label: 'Biblioteca', icon: '📚' },
  { key: 'noticias', label: 'Noticias', icon: '📰' },
];

export default function OrgDashboardPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const { organizations, activeOrg, isLoading, error, fetchMyOrganizations, setActiveOrg, refreshActiveOrg } = useOrganizationStore();
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

  const sidebarTitle = 'Mi Organización';
  const hasMultipleOrgs = organizations.length > 1;

  // Handle tab clicks - some navigate away
  function handleTabClick(key) {
    if (key === 'crear-org') {
      navigate('/wizard');
      return;
    }
    if (key === 'guia') {
      window.location.href = '/?page=guia-constitucion';
      return;
    }
    if (key === 'biblioteca') {
      window.location.href = '/?page=biblioteca';
      return;
    }
    if (key === 'noticias') {
      window.location.href = '/?page=noticias';
      return;
    }
    setActiveTab(key);
  }

  // Org selector in sidebar header
  const orgSelectorHeader = hasMultipleOrgs ? (
    <div className="unified-sidebar__org-container">
      <span className="unified-sidebar__org-label">Organización</span>
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

  // Sidebar sections: org items + secondary items
  const sidebarSections = [
    { items: ORG_MENU_ITEMS },
    { items: SECONDARY_MENU_ITEMS },
  ];

  return (
    <>
      <SharedHeader />
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb', paddingTop: 'var(--header-height, 72px)' }}>
        <SharedSidebar
          title={sidebarTitle}
          sections={sidebarSections}
          activeKey={activeTab}
          onItemClick={handleTabClick}
          header={orgSelectorHeader}
        />
        <main style={{ flex: 1, overflow: 'auto', marginLeft: 260, padding: 24, maxWidth: 1200 }}>
          {activeTab === 'overview' && <OrgOverview org={activeOrg} onNavigateTab={setActiveTab} />}
          {activeTab === 'members' && <OrgMembers org={activeOrg} onRefresh={refreshActiveOrg} />}
          {activeTab === 'directorio' && <OrgDirectorio org={activeOrg} />}
          {activeTab === 'asambleas' && <OrgAsambleas org={activeOrg} onRefresh={refreshActiveOrg} />}
          {activeTab === 'elecciones' && <OrgElecciones org={activeOrg} />}
          {activeTab === 'comunicaciones' && <OrgComunicaciones org={activeOrg} onRefresh={refreshActiveOrg} />}
          {activeTab === 'finanzas' && <OrgFinanzas org={activeOrg} onRefresh={refreshActiveOrg} />}
          {activeTab === 'proyectos' && <OrgProyectos org={activeOrg} />}
          {activeTab === 'documentos' && <OrgDocumentos org={activeOrg} onRefresh={refreshActiveOrg} />}
          {activeTab === 'actividades' && <OrgActividades org={activeOrg} />}
        </main>
      </div>
    </>
  );
}
