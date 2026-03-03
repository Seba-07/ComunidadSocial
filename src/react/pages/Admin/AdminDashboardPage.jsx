import { useState, useEffect, lazy, Suspense } from 'react';
import { useAdminStore } from '../../stores/adminStore';
import { useUiStore } from '../../stores/uiStore';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import AdminLayout from './AdminLayout';
import OrganizationsList from './views/OrganizationsList';

// Lazy load manager views
const MinistroManagerView = lazy(() => import('./views/MinistroManagerView'));
const UserManagerView = lazy(() => import('./views/UserManagerView'));
const ScheduleManagerView = lazy(() => import('./views/ScheduleManagerView'));
const CalendarManagerView = lazy(() => import('./views/CalendarManagerView'));
const UnidadesVecinalesView = lazy(() => import('./views/UnidadesVecinalesView'));
const EstatutosManagerView = lazy(() => import('./views/EstatutosManagerView'));
const MetricsDashboardView = lazy(() => import('./views/MetricsDashboardView'));
const AuditLogView = lazy(() => import('./views/AuditLogView'));
const TimbreFirmaView = lazy(() => import('./views/TimbreFirmaView'));
const ExportView = lazy(() => import('./views/ExportView'));
const OrgPrivacy = lazy(() => import('../OrganizationDashboard/OrgPrivacy'));
const SecurityIncidentsView = lazy(() => import('./views/SecurityIncidentsView'));
const DataRegistryView = lazy(() => import('./views/DataRegistryView'));
const SettingsPage = lazy(() => import('../Settings/SettingsPage'));

const VIEW_MAP = {
  organizations: OrganizationsList,
  ministros: MinistroManagerView,
  users: UserManagerView,
  schedule: ScheduleManagerView,
  calendar: CalendarManagerView,
  unidades: UnidadesVecinalesView,
  estatutos: EstatutosManagerView,
  metrics: MetricsDashboardView,
  audit: AuditLogView,
  timbre: TimbreFirmaView,
  export: ExportView,
  privacidad: OrgPrivacy,
  seguridad: SecurityIncidentsView,
  'reg-datos': DataRegistryView,
  configuracion: SettingsPage
};

export default function AdminDashboardPage() {
  const [activeView, setActiveView] = useState('organizations');
  const { organizations, fetchAllOrganizations, fetchStats, stats } = useAdminStore();
  const addToast = useUiStore(s => s.addToast);

  useEffect(() => {
    fetchAllOrganizations().catch(err => addToast(err.message, 'error'));
    fetchStats().catch(() => {});
  }, []);

  const orgCounts = {
    total: organizations.length,
    byStatus: organizations.reduce((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {})
  };

  const ViewComponent = VIEW_MAP[activeView] || OrganizationsList;
  const isLazy = activeView !== 'organizations';

  return (
    <AdminLayout
      activeView={activeView}
      onViewChange={setActiveView}
      orgCounts={orgCounts}
    >
      {isLazy ? (
        <Suspense fallback={<LoadingSpinner text="Cargando vista..." />}>
          <ViewComponent />
        </Suspense>
      ) : (
        <ViewComponent />
      )}
    </AdminLayout>
  );
}
