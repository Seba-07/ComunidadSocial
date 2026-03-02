import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import '../../../shared/styles/sidebar.css';

/**
 * SharedSidebar - Unified sidebar component for all React-based roles.
 *
 * Props:
 *   title       - Sidebar header title (e.g. "Panel Admin", "Ministro de Fe")
 *   menuItems   - Array of { key, label, icon, badge? }
 *   activeKey   - Currently active item key
 *   onItemClick - Callback(key) when an item is clicked
 *   header      - Optional React node rendered between title and nav (e.g. org selector)
 *   sections    - Optional array of { label?, items: menuItems[] } for grouped items with separators
 */
export default function SharedSidebar({ title, menuItems, activeKey, onItemClick, header, sections }) {
  const { user, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close on ESC
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape' && mobileOpen) setMobileOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [mobileOpen]);

  function handleItemClick(key) {
    onItemClick(key);
    setMobileOpen(false);
  }

  function renderItem(item) {
    const isActive = activeKey === item.key;
    return (
      <button
        key={item.key}
        className={`unified-sidebar__item${isActive ? ' unified-sidebar__item--active' : ''}`}
        onClick={() => handleItemClick(item.key)}
      >
        <span className="unified-sidebar__item-icon">{item.icon}</span>
        <span className="unified-sidebar__item-label">{item.label}</span>
        {item.badge != null && (
          <span className="unified-sidebar__badge">{item.badge}</span>
        )}
      </button>
    );
  }

  const renderItems = sections ? (
    sections.map((section, i) => (
      <div key={i} className={i > 0 ? 'unified-sidebar__section' : undefined}>
        {section.items.map(renderItem)}
      </div>
    ))
  ) : (
    menuItems?.map(renderItem)
  );

  return (
    <>
      {/* Mobile hamburger trigger */}
      <button
        className="unified-sidebar__mobile-trigger"
        onClick={() => setMobileOpen(true)}
        style={{
          display: 'none', position: 'fixed', top: 12, left: 12, zIndex: 1048,
          background: '#1e3a8a', color: 'white', border: 'none', borderRadius: 8,
          padding: '8px 12px', cursor: 'pointer', fontSize: 20
        }}
      >
        ☰
      </button>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          className="unified-sidebar-overlay active"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`unified-sidebar${mobileOpen ? ' open' : ''}`}>
        {/* Close button (mobile) */}
        <button
          className="unified-sidebar__close-btn"
          onClick={() => setMobileOpen(false)}
          aria-label="Cerrar menú"
        >
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Header */}
        <div className="unified-sidebar__header">
          <h2 className="unified-sidebar__title">{title}</h2>
          <p className="unified-sidebar__subtitle">
            {user?.firstName} {user?.lastName}
          </p>
        </div>

        {/* Optional extra header content (org selector, etc.) */}
        {header}

        {/* Nav items */}
        <nav className="unified-sidebar__nav">
          {renderItems}
        </nav>

        {/* Footer - Logout */}
        <div className="unified-sidebar__footer">
          <button className="unified-sidebar__logout" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}
