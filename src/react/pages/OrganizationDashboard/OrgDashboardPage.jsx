import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
import OrgMisOrganizaciones from './OrgMisOrganizaciones';
import OrgPrivacy from './OrgPrivacy';
import OrgGuia from './OrgGuia';
import OrgBiblioteca from './OrgBiblioteca';
import OrgNoticias from './OrgNoticias';
import OrgTramites from './OrgTramites';
import SettingsPage from '../Settings/SettingsPage';
import EmailVerificationBanner from '../../components/ui/EmailVerificationBanner';

// Org-specific menu items (shown when an org is selected)
const ORG_MENU_ITEMS = [
  { key: 'overview', label: 'Resumen', icon: '📊' },
  { key: 'members', label: 'Socios', icon: '🤝' },
  { key: 'directorio', label: 'Directorio', icon: '📇' },
  { key: 'asambleas', label: 'Asambleas', icon: '📢' },
  { key: 'elecciones', label: 'Elecciones', icon: '✅' },
  { key: 'comunicaciones', label: 'Comunicaciones', icon: '💬' },
  { key: 'finanzas', label: 'Finanzas', icon: '💰' },
  { key: 'proyectos', label: 'Proyectos', icon: '📁' },
  { key: 'documentos', label: 'Archivo Histórico', icon: '📄' },
  { key: 'actividades', label: 'Actividades', icon: '📅' },
  { key: 'tramites', label: 'Solicitudes', icon: '📋' },
];

// Tabs visible per access level
const DIRECTIVO_TABS = new Set(['overview', 'members', 'directorio', 'asambleas', 'elecciones', 'comunicaciones', 'finanzas', 'documentos', 'proyectos', 'actividades', 'tramites']);
const SOCIO_TABS = new Set(['overview', 'directorio', 'comunicaciones']);

/**
 * Checks if user is a directivo member of the org (frontend mirror of backend logic).
 */
function isDirectivoOfOrg(org, user) {
  if (!user?.rut || !org?.provisionalDirectorio) return false;
  const clean = (rut) => (rut || '').replace(/\./g, '').replace(/-/g, '').toUpperCase();
  const userRut = clean(user.rut);
  const prov = org.provisionalDirectorio;
  if (prov.president && clean(prov.president.rut) === userRut) return true;
  if (prov.vicePresident && clean(prov.vicePresident.rut) === userRut) return true;
  if (prov.secretary && clean(prov.secretary.rut) === userRut) return true;
  if (prov.treasurer && clean(prov.treasurer.rut) === userRut) return true;
  if (prov.additionalMembers?.some(m => m && clean(m.rut) === userRut)) return true;
  return false;
}

/**
 * Returns the filtered org menu items based on user's access level.
 */
function getVisibleOrgTabs(org, user) {
  // Admin or owner sees everything
  if (user?.role === 'MUNICIPALIDAD' || org?.userId === user?._id) {
    return ORG_MENU_ITEMS;
  }
  // Directivo member sees operational tabs
  if (isDirectivoOfOrg(org, user)) {
    return ORG_MENU_ITEMS.filter(item => DIRECTIVO_TABS.has(item.key));
  }
  // Regular socio sees read-only basics
  return ORG_MENU_ITEMS.filter(item => SOCIO_TABS.has(item.key));
}

// Secondary items (always shown, below org section)
const SECONDARY_MENU_ITEMS = [
  { key: 'mis-org', label: 'Mis Organizaciones', icon: '🏠' },
  { key: 'guia', label: 'Guía', icon: '📑' },
  { key: 'biblioteca', label: 'Biblioteca', icon: '📚' },
  { key: 'noticias', label: 'Noticias', icon: '📰' },
  { key: 'privacidad', label: 'Privacidad', icon: '🔒' },
  { key: 'configuracion', label: 'Configuración', icon: '⚙️' },
];

const APPROVED_STATUSES = new Set(['approved', 'APPROVED', 'ACTIVE']);

export default function OrgDashboardPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'mis-org';
  const [activeTab, setActiveTab] = useState(initialTab);
  const { organizations, activeOrg, isLoading, error, fetchMyOrganizations, setActiveOrg, refreshActiveOrg } = useOrganizationStore();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    fetchMyOrganizations().then((orgs) => {
      if (!orgs?.length) return;
      if (id && id !== 'auto') {
        setActiveOrg(id);
      } else {
        const approved = orgs.find(o => APPROVED_STATUSES.has(o.status));
        setActiveOrg(approved ? approved._id : orgs[0]._id);
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

  // If no active org or org not approved, force mis-org for org-specific tabs
  const SECONDARY_KEYS = new Set(['mis-org', 'guia', 'biblioteca', 'noticias', 'privacidad', 'configuracion']);
  const isOrgApproved = activeOrg && APPROVED_STATUSES.has(activeOrg.status);
  let effectiveTab = (!activeOrg || !isOrgApproved) && !SECONDARY_KEYS.has(activeTab) ? 'mis-org' : activeTab;

  // If user tries to access a tab they don't have permission to, fallback to overview or mis-org
  const allowedOrgKeys = isOrgApproved ? new Set(getVisibleOrgTabs(activeOrg, user).map(t => t.key)) : new Set();
  if (!SECONDARY_KEYS.has(effectiveTab) && isOrgApproved && !allowedOrgKeys.has(effectiveTab)) {
    effectiveTab = allowedOrgKeys.has('overview') ? 'overview' : 'mis-org';
  }

  const sidebarTitle = 'Mi Organización';
  const sidebarSubtitle = user?.role === 'MUNICIPALIDAD' ? 'Secretario Municipal'
    : (activeOrg && isDirectivoOfOrg(activeOrg, user)) ? 'Miembro Directivo'
    : 'Dirigente Social';
  const hasMultipleOrgs = organizations.length > 1;

  function handleTabClick(key) {
    setActiveTab(key);
  }

  // Org selector in sidebar header
  const orgSelectorHeader = hasMultipleOrgs ? (
    <div className="unified-sidebar__org-container">
      <span className="unified-sidebar__org-label">Organización</span>
      <select
        className="unified-sidebar__org-selector"
        value={activeOrg?._id || ''}
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

  // Filter org tabs by user access level
  const visibleOrgTabs = isOrgApproved ? getVisibleOrgTabs(activeOrg, user) : [];
  const visibleOrgKeys = new Set(visibleOrgTabs.map(t => t.key));

  // Sidebar sections: only show org items when an approved org is active
  const sidebarSections = isOrgApproved
    ? [
        { label: activeOrg.organizationName, items: visibleOrgTabs },
        { items: SECONDARY_MENU_ITEMS },
      ]
    : [
        { items: SECONDARY_MENU_ITEMS },
      ];

  return (
    <>
      <SharedHeader />
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb', paddingTop: 'var(--header-height, 60px)' }}>
        <SharedSidebar
          title={sidebarTitle}
          subtitle={sidebarSubtitle}
          sections={sidebarSections}
          activeKey={effectiveTab}
          onItemClick={handleTabClick}
          header={orgSelectorHeader}
        />
        <main className="r-main-content" style={{ flex: 1, overflow: 'auto', marginLeft: 'var(--sidebar-width, 260px)', transition: 'margin-left 0.25s ease', padding: 24, maxWidth: 1200 }}>
          <EmailVerificationBanner />
          {effectiveTab === 'mis-org' && <OrgMisOrganizaciones onNavigateTab={setActiveTab} />}
          {effectiveTab === 'guia' && <OrgGuia />}
          {effectiveTab === 'biblioteca' && <OrgBiblioteca />}
          {effectiveTab === 'noticias' && <OrgNoticias />}
          {effectiveTab === 'privacidad' && <OrgPrivacy />}
          {effectiveTab === 'configuracion' && <SettingsPage />}
          {effectiveTab === 'overview' && activeOrg && <OrgOverview org={activeOrg} onNavigateTab={setActiveTab} onRefresh={refreshActiveOrg} />}
          {effectiveTab === 'members' && activeOrg && <OrgMembers org={activeOrg} onRefresh={refreshActiveOrg} />}
          {effectiveTab === 'directorio' && activeOrg && <OrgDirectorio org={activeOrg} onRefresh={refreshActiveOrg} />}
          {effectiveTab === 'asambleas' && activeOrg && <OrgAsambleas org={activeOrg} onRefresh={refreshActiveOrg} />}
          {effectiveTab === 'elecciones' && activeOrg && <OrgElecciones org={activeOrg} onRefresh={refreshActiveOrg} />}
          {effectiveTab === 'comunicaciones' && activeOrg && <OrgComunicaciones org={activeOrg} onRefresh={refreshActiveOrg} />}
          {effectiveTab === 'finanzas' && activeOrg && <OrgFinanzas org={activeOrg} onRefresh={refreshActiveOrg} />}
          {effectiveTab === 'proyectos' && activeOrg && <OrgProyectos org={activeOrg} />}
          {effectiveTab === 'documentos' && activeOrg && <OrgDocumentos org={activeOrg} onRefresh={refreshActiveOrg} />}
          {effectiveTab === 'actividades' && activeOrg && <OrgActividades org={activeOrg} />}
          {effectiveTab === 'tramites' && activeOrg && <OrgTramites org={activeOrg} />}
        </main>
      </div>
    </>
  );
}
