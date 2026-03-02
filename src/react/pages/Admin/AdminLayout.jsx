import SharedSidebar from '../../components/layout/SharedSidebar';

const MENU_ITEMS = [
  { key: 'organizations', label: 'Organizaciones', icon: '🏢' },
  { key: 'schedule', label: 'Horarios', icon: '📅' },
  { key: 'calendar', label: 'Calendario', icon: '🗓️' },
  { key: 'ministros', label: 'Ministros de Fe', icon: '👤' },
  { key: 'users', label: 'Usuarios', icon: '👥' },
  { key: 'unidades', label: 'Unidades Vecinales', icon: '🗺️' },
  { key: 'estatutos', label: 'Estatutos', icon: '📜' },
  { key: 'metrics', label: 'Métricas', icon: '📊' },
  { key: 'audit', label: 'Historial', icon: '📋' },
  { key: 'timbre', label: 'Timbre/Firma', icon: '✅' },
  { key: 'export', label: 'Exportar', icon: '📥' }
];

export { MENU_ITEMS };

export default function AdminLayout({ activeView, onViewChange, children, orgCounts }) {
  // Add badge to organizations item if orgCounts is provided
  const items = MENU_ITEMS.map(item => {
    if (item.key === 'organizations' && orgCounts?.total > 0) {
      return { ...item, badge: orgCounts.total };
    }
    return item;
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f3f4f6' }}>
      <SharedSidebar
        title="Panel Admin"
        menuItems={items}
        activeKey={activeView}
        onItemClick={onViewChange}
      />

      {/* Main content - offset for fixed sidebar */}
      <main style={{ flex: 1, overflow: 'auto', marginLeft: 260 }}>
        {children}
      </main>
    </div>
  );
}
