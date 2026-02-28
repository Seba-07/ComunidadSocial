import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useAssignmentsStore } from '../../stores/assignmentsStore';
import { useUiStore } from '../../stores/uiStore';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import StatsGrid from '../../components/ui/StatsGrid';
import AssignmentCard from './AssignmentCard';
import ValidationWizard from './ValidationWizard';

export default function MinistroDashboardPage() {
  const { user, logout } = useAuthStore();
  const { myPending, assignments, fetchMyPending, fetchMinistroAssignments } = useAssignmentsStore();
  const addToast = useUiStore(s => s.addToast);
  const [isLoading, setIsLoading] = useState(true);
  const [activeAssignment, setActiveAssignment] = useState(null);
  const [showWizard, setShowWizard] = useState(false);

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

  const stats = [
    { icon: '\uD83D\uDCCB', label: 'Pendientes', value: myPending.length, color: '#f59e0b' },
    { icon: '\u2705', label: 'Completadas', value: assignments.filter(a => a.status === 'completed').length, color: '#10b981' },
    { icon: '\uD83D\uDCC5', label: 'Total', value: assignments.length, color: '#2563eb' }
  ];

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
    <div style={{ minHeight: '100vh', background: '#f3f4f6' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
        color: 'white', padding: '20px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Ministro de Fe</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, opacity: 0.8 }}>
            {user?.firstName} {user?.lastName}
          </p>
        </div>
        <button onClick={logout} style={{
          padding: '8px 16px', border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: 8, background: 'transparent', color: 'white',
          fontSize: 13, cursor: 'pointer'
        }}>Cerrar sesión</button>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
        <StatsGrid stats={stats} />

        <h2 style={{ margin: '24px 0 16px', fontSize: 18, fontWeight: 600, color: '#111827' }}>
          Asignaciones Pendientes
        </h2>

        {myPending.length === 0 ? (
          <div style={{
            background: 'white', borderRadius: 12, padding: 40, textAlign: 'center',
            border: '1px solid #e5e7eb'
          }}>
            <p style={{ color: '#6b7280', fontSize: 16 }}>No tienes asignaciones pendientes</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {myPending.map(a => (
              <AssignmentCard key={a._id} assignment={a} onValidate={() => openValidation(a)} />
            ))}
          </div>
        )}

        {assignments.filter(a => a.status === 'completed').length > 0 && (
          <>
            <h2 style={{ margin: '32px 0 16px', fontSize: 18, fontWeight: 600, color: '#111827' }}>
              Completadas
            </h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {assignments.filter(a => a.status === 'completed').map(a => (
                <AssignmentCard key={a._id} assignment={a} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
