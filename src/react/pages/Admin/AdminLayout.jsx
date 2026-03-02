import SharedHeader from '../../components/layout/SharedHeader';
import SharedSidebar from '../../components/layout/SharedSidebar';

const MENU_ITEMS = [
  { key: 'organizations', label: 'Organizaciones', icon: '🏢' },
  { key: 'schedule', label: 'Horarios', icon: '📅' },
  { key: 'calendar', label: 'Calendario', icon: '🗓️' },
  { key: 'ministros', label: 'Ministros de Fe', icon: '⚖️' },
  { key: 'users', label: 'Usuarios', icon: '🤝' },
  { key: 'unidades', label: 'Unidades Vecinales', icon: '🗺️' },
  { key: 'estatutos', label: 'Estatutos', icon: '📜' },
  { key: 'metrics', label: 'Métricas', icon: '📊' },
  { key: 'audit', label: 'Historial', icon: '📋' },
  { key: 'timbre', label: 'Timbre/Firma', icon: '✅' },
  { key: 'export', label: 'Exportar', icon: '📥' }
];

export { MENU_ITEMS };

export default function AdminLayout({ activeView, onViewChange, children, orgCounts }) {
  const items = MENU_ITEMS.map(item => {
    if (item.key === 'organizations' && orgCounts?.total > 0) {
      return { ...item, badge: orgCounts.total };
    }
    return item;
  });

  return (
    <>
      <SharedHeader />
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f3f4f6', paddingTop: 'var(--header-height, 60px)' }}>
        <SharedSidebar
          title="Panel Admin"
          menuItems={items}
          activeKey={activeView}
          onItemClick={onViewChange}
        />
        <main style={{ flex: 1, overflow: 'auto', marginLeft: 'var(--sidebar-width, 260px)', transition: 'margin-left 0.25s ease' }}>
          {children}
        </main>
      </div>
    </>
  );
}
