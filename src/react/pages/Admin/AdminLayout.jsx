import SharedHeader from '../../components/layout/SharedHeader';
import SharedSidebar from '../../components/layout/SharedSidebar';

const ADMIN_SECTIONS = [
  {
    label: 'Principal',
    items: [
      { key: 'overview', label: 'Dashboard Municipal', icon: '📊' },
      { key: 'organizations', label: 'Organizaciones', icon: '🏢' },
      { key: 'mesa-ayuda', label: 'Mesa de Ayuda', icon: '📋' },
    ]
  },
  {
    label: 'Operaciones',
    items: [
      { key: 'ministros', label: 'Ministros de Fe', icon: '⚖️' },
      { key: 'schedule', label: 'Horarios', icon: '📅' },
      { key: 'calendar', label: 'Calendario', icon: '🗓️' },
      { key: 'unidades', label: 'Unidades Vecinales', icon: '🗺️' },
    ]
  },
  {
    label: 'Contenido',
    items: [
      { key: 'estatutos', label: 'Estatutos', icon: '📜' },
      { key: 'plantillas-docs', label: 'Plantillas Docs', icon: '📄' },
      { key: 'noticias', label: 'Noticias', icon: '📰' },
      { key: 'comunicados', label: 'Anuncios', icon: '📢' },
    ]
  },
  {
    label: 'Administración',
    items: [
      { key: 'users', label: 'Usuarios', icon: '👥' },
      { key: 'audit', label: 'Historial', icon: '🕒' },
      { key: 'export', label: 'Exportación de Datos', icon: '📥' },
      { key: 'seguridad', label: 'Incidentes', icon: '🛡️' },
      { key: 'soporte', label: 'Soporte Técnico', icon: '🎧' },
    ]
  },
  {
    label: 'Legal y Sistema',
    items: [
      { key: 'privacidad', label: 'Privacidad (ARCOP)', icon: '🔒' },
      { key: 'reg-datos', label: 'Registro de Datos', icon: '📑' },
      { key: 'configuracion', label: 'Configuración', icon: '⚙️' },
    ]
  },
];

export { ADMIN_SECTIONS };

export default function AdminLayout({ activeView, onViewChange, children, orgCounts }) {
  // Inject badge into organizations item
  const sections = ADMIN_SECTIONS.map(section => ({
    ...section,
    items: section.items.map(item => {
      if (item.key === 'organizations' && orgCounts?.total > 0) {
        return { ...item, badge: orgCounts.total };
      }
      return item;
    })
  }));

  return (
    <>
      <SharedHeader />
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f3f4f6', paddingTop: 'var(--header-height, 60px)' }}>
        <SharedSidebar
          title="Panel Admin"
          subtitle="Secretario Municipal"
          sections={sections}
          activeKey={activeView}
          onItemClick={onViewChange}
        />
        <main className="r-main-content" style={{ flex: 1, overflow: 'auto', marginLeft: 'var(--sidebar-width, 260px)', transition: 'margin-left 0.25s ease' }}>
          {children}
        </main>
      </div>
    </>
  );
}
