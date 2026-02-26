import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useOrganizationStore } from '../../stores/organizationStore';
import { useAuthStore } from '../../stores/authStore';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import OrgOverview from './OrgOverview';
import OrgMembers from './OrgMembers';
import OrgDirectorio from './OrgDirectorio';
import OrgAsambleas from './OrgAsambleas';
import OrgDocumentos from './OrgDocumentos';
import OrgFinanzas from './OrgFinanzas';
import OrgComunicaciones from './OrgComunicaciones';

const TABS = [
  { id: 'overview', label: 'Resumen' },
  { id: 'members', label: 'Miembros' },
  { id: 'directorio', label: 'Directorio' },
  { id: 'asambleas', label: 'Asambleas' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'finanzas', label: 'Finanzas' },
  { id: 'comunicaciones', label: 'Comunicaciones' }
];

export default function OrgDashboardPage() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState('overview');
  const { activeOrg, isLoading, error, fetchMyOrganizations, setActiveOrg, refreshActiveOrg } = useOrganizationStore();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    fetchMyOrganizations().then((orgs) => {
      if (!orgs?.length) return;
      if (id && id !== 'auto') {
        setActiveOrg(id);
      } else {
        // Auto-select first (or only) org
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

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      {/* Header */}
      <header style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
        color: 'white',
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/icons/logo_renca.png" alt="Logo" style={{ width: 40, height: 'auto' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{activeOrg.organizationName}</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Panel de Organización</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
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
        overflowX: 'auto'
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
