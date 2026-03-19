import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useAssignmentsStore } from '../../stores/assignmentsStore';
import { useUiStore } from '../../stores/uiStore';
import SharedHeader from '../../components/layout/SharedHeader';
import SharedSidebar from '../../components/layout/SharedSidebar';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import StatsGrid from '../../components/ui/StatsGrid';
import AssignmentCard from './AssignmentCard';
import AssignmentDetail from './AssignmentDetail';
import ValidationWizard from './ValidationWizard';
import OrgPrivacy from '../OrganizationDashboard/OrgPrivacy';
import SettingsPage from '../Settings/SettingsPage';
import MiHorario from './MiHorario';

const MINISTRO_MENU_ITEMS = [
  { key: 'pending', label: 'Asignaciones', icon: '\uD83D\uDCCB' },
  { key: 'completed', label: 'Completadas', icon: '\u2705' },
  { key: 'horario', label: 'Mi Horario', icon: '\uD83D\uDCC5' },
  { key: 'privacidad', label: 'Privacidad', icon: '\uD83D\uDD12' },
  { key: 'configuracion', label: 'Configuracion', icon: '\u2699\uFE0F' }
];

export default function MinistroDashboardPage() {
  const { user } = useAuthStore();
  const { myPending, assignments, fetchMyPending, fetchMinistroAssignments } = useAssignmentsStore();
  const addToast = useUiStore(s => s.addToast);
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState('pending');
  // Detail + wizard states
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardOrg, setWizardOrg] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        await fetchMyPending();
        if (user?._id) await fetchMinistroAssignments(user._id);
      } catch (err) {
        addToast(err.message, 'error');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const completedAssignments = assignments.filter(a => a.status === 'completed');

  // Separate today vs upcoming — compare YYYY-MM-DD strings to avoid timezone issues
  const todayISO = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local timezone
  function getDateISO(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-CA');
  }
  const todayAssignments = myPending.filter(a => a.scheduledDate && getDateISO(a.scheduledDate) === todayISO);
  const upcomingAssignments = myPending.filter(a => !a.scheduledDate || getDateISO(a.scheduledDate) !== todayISO);

  const stats = [
    { icon: '\uD83D\uDCC5', label: 'Hoy', value: todayAssignments.length, color: '#2563eb' },
    { icon: '\uD83D\uDCCB', label: 'Pendientes', value: myPending.length, color: '#f59e0b' },
    { icon: '\u2705', label: 'Completadas', value: completedAssignments.length, color: '#10b981' },
  ];

  const menuItems = MINISTRO_MENU_ITEMS.map(item => {
    if (item.key === 'pending' && myPending.length > 0) return { ...item, badge: myPending.length };
    if (item.key === 'completed' && completedAssignments.length > 0) return { ...item, badge: completedAssignments.length };
    return item;
  });

  function handleSelectAssignment(a) {
    setSelectedAssignment(a);
  }

  function handleStartAssembly(a, org) {
    setWizardOrg(org);
    setShowWizard(true);
  }

  function handleCloseWizard() {
    setShowWizard(false);
    setWizardOrg(null);
    setSelectedAssignment(null);
    fetchMyPending().catch(() => {});
    if (user?._id) fetchMinistroAssignments(user._id).catch(() => {});
  }

  if (isLoading) return <LoadingSpinner text="Cargando asignaciones..." />;

  // Wizard mode — fullscreen
  if (showWizard && selectedAssignment) {
    return <ValidationWizard assignment={selectedAssignment} org={wizardOrg} onClose={handleCloseWizard} />;
  }

  // Detail mode
  if (selectedAssignment) {
    return (
      <>
        <SharedHeader />
        <div style={{ minHeight: '100vh', background: '#f3f4f6', paddingTop: 'var(--header-height, 60px)' }}>
          <AssignmentDetail
            assignment={selectedAssignment}
            onBack={() => setSelectedAssignment(null)}
            onStartAssembly={handleStartAssembly}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <SharedHeader />
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f3f4f6', paddingTop: 'var(--header-height, 60px)' }}>
        <SharedSidebar
          title="Ministro de Fe"
          subtitle="Validacion de Actos"
          menuItems={menuItems}
          activeKey={activeView}
          onItemClick={setActiveView}
        />
        <main className="r-main-content" style={{ flex: 1, overflow: 'auto', marginLeft: 'var(--sidebar-width, 260px)', transition: 'margin-left 0.25s ease' }}>
          <div style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(12px, 3vw, 24px)' }}>
            <StatsGrid stats={stats} />

            {activeView === 'pending' && (
              <>
                {/* Today's assemblies — highlighted */}
                {todayAssignments.length > 0 && (
                  <>
                    <h2 style={{ margin: '24px 0 12px', fontSize: 18, fontWeight: 700, color: '#2563eb' }}>
                      Asambleas de Hoy ({todayAssignments.length})
                    </h2>
                    <div style={{ display: 'grid', gap: 10 }}>
                      {todayAssignments.map(a => (
                        <AssignmentCard key={a._id} assignment={a} onSelect={handleSelectAssignment} />
                      ))}
                    </div>
                  </>
                )}

                {/* Upcoming */}
                <h2 style={{ margin: '24px 0 12px', fontSize: 18, fontWeight: 600, color: '#111827' }}>
                  {todayAssignments.length > 0 ? 'Proximas' : 'Asignaciones Pendientes'} ({upcomingAssignments.length})
                </h2>
                {upcomingAssignments.length === 0 && todayAssignments.length === 0 ? (
                  <div style={{ background: 'white', borderRadius: 12, padding: 40, textAlign: 'center', border: '1px solid #e5e7eb' }}>
                    <p style={{ color: '#6b7280', fontSize: 16, margin: 0 }}>No tienes asignaciones pendientes</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {upcomingAssignments.map(a => (
                      <AssignmentCard key={a._id} assignment={a} onSelect={handleSelectAssignment} />
                    ))}
                  </div>
                )}
              </>
            )}

            {activeView === 'completed' && (
              <>
                <h2 style={{ margin: '24px 0 12px', fontSize: 18, fontWeight: 600, color: '#111827' }}>
                  Completadas ({completedAssignments.length})
                </h2>
                {completedAssignments.length === 0 ? (
                  <div style={{ background: 'white', borderRadius: 12, padding: 40, textAlign: 'center', border: '1px solid #e5e7eb' }}>
                    <p style={{ color: '#6b7280', fontSize: 16, margin: 0 }}>No hay asignaciones completadas</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {completedAssignments.map(a => (
                      <AssignmentCard key={a._id} assignment={a} onSelect={handleSelectAssignment} />
                    ))}
                  </div>
                )}
              </>
            )}

            {activeView === 'horario' && <MiHorario />}
            {activeView === 'privacidad' && <OrgPrivacy />}
            {activeView === 'configuracion' && <SettingsPage />}
          </div>
        </main>
      </div>
    </>
  );
}
