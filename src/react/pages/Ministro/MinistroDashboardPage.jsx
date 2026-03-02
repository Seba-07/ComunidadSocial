import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useAssignmentsStore } from '../../stores/assignmentsStore';
import { useUiStore } from '../../stores/uiStore';
import SharedHeader from '../../components/layout/SharedHeader';
import SharedSidebar from '../../components/layout/SharedSidebar';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import StatsGrid from '../../components/ui/StatsGrid';
import AssignmentCard from './AssignmentCard';
import ValidationWizard from './ValidationWizard';

const MINISTRO_MENU_ITEMS = [
  { key: 'pending', label: 'Asignaciones', icon: '📋' },
  { key: 'completed', label: 'Completadas', icon: '✅' }
];

export default function MinistroDashboardPage() {
  const { user } = useAuthStore();
  const { myPending, assignments, fetchMyPending, fetchMinistroAssignments } = useAssignmentsStore();
  const addToast = useUiStore(s => s.addToast);
  const [isLoading, setIsLoading] = useState(true);
  const [activeAssignment, setActiveAssignment] = useState(null);
  const [showWizard, setShowWizard] = useState(false);
  const [activeView, setActiveView] = useState('pending');

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

  const stats = [
    { icon: '📋', label: 'Pendientes', value: myPending.length, color: '#f59e0b' },
    { icon: '✅', label: 'Completadas', value: completedAssignments.length, color: '#10b981' },
    { icon: '📅', label: 'Total', value: assignments.length, color: '#2563eb' }
  ];

  const menuItems = MINISTRO_MENU_ITEMS.map(item => {
    if (item.key === 'pending' && myPending.length > 0) {
      return { ...item, badge: myPending.length };
    }
    if (item.key === 'completed' && completedAssignments.length > 0) {
      return { ...item, badge: completedAssignments.length };
    }
    return item;
  });

  function openValidation(assignment) {
    setActiveAssignment(assignment);
    setShowWizard(true);
  }

  function closeValidation() {
    setShowWizard(false);
    setActiveAssignment(null);
    fetchMyPending().catch(() => {});
  }

  if (isLoading) return <LoadingSpinner text="Cargando asignaciones..." />;

  if (showWizard && activeAssignment) {
    return <ValidationWizard assignment={activeAssignment} onClose={closeValidation} />;
  }

  return (
    <>
      <SharedHeader />
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f3f4f6', paddingTop: 'var(--header-height, 72px)' }}>
        <SharedSidebar
          title="Ministro de Fe"
          menuItems={menuItems}
          activeKey={activeView}
          onItemClick={setActiveView}
        />
        <main style={{ flex: 1, overflow: 'auto', marginLeft: 260 }}>
          <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
            <StatsGrid stats={stats} />

            {activeView === 'pending' && (
              <>
                <h2 style={{ margin: '24px 0 16px', fontSize: 18, fontWeight: 600, color: '#111827' }}>
                  Asignaciones Pendientes
                </h2>
                {myPending.length === 0 ? (
                  <div style={{ background: 'white', borderRadius: 12, padding: 40, textAlign: 'center', border: '1px solid #e5e7eb' }}>
                    <p style={{ color: '#6b7280', fontSize: 16 }}>No tienes asignaciones pendientes</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 12 }}>
                    {myPending.map(a => (
                      <AssignmentCard key={a._id} assignment={a} onValidate={() => openValidation(a)} />
                    ))}
                  </div>
                )}
              </>
            )}

            {activeView === 'completed' && (
              <>
                <h2 style={{ margin: '24px 0 16px', fontSize: 18, fontWeight: 600, color: '#111827' }}>
                  Completadas
                </h2>
                {completedAssignments.length === 0 ? (
                  <div style={{ background: 'white', borderRadius: 12, padding: 40, textAlign: 'center', border: '1px solid #e5e7eb' }}>
                    <p style={{ color: '#6b7280', fontSize: 16 }}>No hay asignaciones completadas</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 12 }}>
                    {completedAssignments.map(a => (
                      <AssignmentCard key={a._id} assignment={a} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
