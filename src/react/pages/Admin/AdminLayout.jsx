import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';

const MENU_ITEMS = [
  { key: 'organizations', label: 'Organizaciones', icon: '\uD83C\uDFE2' },
  { key: 'schedule', label: 'Horarios', icon: '\uD83D\uDCC5' },
  { key: 'calendar', label: 'Calendario', icon: '\uD83D\uDDD3\uFE0F' },
  { key: 'ministros', label: 'Ministros de Fe', icon: '\uD83D\uDC64' },
  { key: 'users', label: 'Usuarios', icon: '\uD83D\uDC65' },
  { key: 'unidades', label: 'Unidades Vecinales', icon: '\uD83D\uDDFA\uFE0F' },
  { key: 'estatutos', label: 'Estatutos', icon: '\uD83D\uDCDC' },
  { key: 'metrics', label: 'Métricas', icon: '\uD83D\uDCCA' },
  { key: 'audit', label: 'Historial', icon: '\uD83D\uDCCB' },
  { key: 'timbre', label: 'Timbre/Firma', icon: '\u2705' },
  { key: 'export', label: 'Exportar', icon: '\uD83D\uDCE5' }
];

export { MENU_ITEMS };

export default function AdminLayout({ activeView, onViewChange, children, orgCounts }) {
  const { user, logout } = useAuthStore();

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f3f4f6' }}>
      {/* Sidebar */}
      <aside style={{
        width: 260, background: 'linear-gradient(180deg, #1e3a8a 0%, #1e40af 100%)',
        color: 'white', display: 'flex', flexDirection: 'column', flexShrink: 0
      }}>
        <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Panel Admin</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.7 }}>
            {user?.firstName} {user?.lastName}
          </p>
        </div>

        <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
          {MENU_ITEMS.map(item => {
            const isActive = activeView === item.key;
            const count = item.key === 'organizations' ? null : undefined;
            return (
              <button
                key={item.key}
                onClick={() => onViewChange(item.key)}
                style={{
                  width: '100%',
                  padding: '10px 20px',
                  border: 'none',
                  background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                  color: 'white',
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  textAlign: 'left',
                  transition: 'background 0.15s',
                  borderLeft: isActive ? '3px solid white' : '3px solid transparent'
                }}
              >
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {orgCounts && item.key === 'organizations' && orgCounts.total > 0 && (
                  <span style={{
                    background: 'rgba(255,255,255,0.2)',
                    padding: '2px 8px', borderRadius: 10, fontSize: 11
                  }}>
                    {orgCounts.total}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button
            onClick={logout}
            style={{
              width: '100%', padding: '10px', border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 8, background: 'transparent', color: 'white',
              fontSize: 13, cursor: 'pointer'
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
