import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../stores/authStore';
import '../../../shared/styles/sidebar.css';

const STORAGE_KEY = 'sidebar-collapsed';
const SECTIONS_KEY = 'sidebar-sections-collapsed';

function getInitialCollapsed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function getInitialSectionsCollapsed() {
  try {
    const stored = localStorage.getItem(SECTIONS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * SharedSidebar - Clean dark sidebar (Selltron-inspired).
 * Supports collapse/expand, sections with labels, and badges.
 */
export default function SharedSidebar({ title, subtitle, menuItems, activeKey, onItemClick, header, sections }) {
  const { user } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(getInitialCollapsed);
  const [sectionsCollapsed, setSectionsCollapsed] = useState(getInitialSectionsCollapsed);

  useEffect(() => {
    const width = collapsed ? '72px' : '260px';
    document.documentElement.style.setProperty('--sidebar-width', width);
    document.body.classList.add('has-unified-sidebar');
    return () => {
      document.documentElement.style.setProperty('--sidebar-width', '260px');
      document.body.classList.remove('has-unified-sidebar');
    };
  }, [collapsed]);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape' && mobileOpen) setMobileOpen(false);
    }
    function handleOpenSidebar() {
      setMobileOpen(true);
    }
    document.addEventListener('keydown', handleKey);
    document.addEventListener('open-mobile-sidebar', handleOpenSidebar);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('open-mobile-sidebar', handleOpenSidebar);
    };
  }, [mobileOpen]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch {}
      return next;
    });
  }, []);

  const toggleSection = useCallback((label) => {
    setSectionsCollapsed((prev) => {
      const next = { ...prev, [label]: !prev[label] };
      try { localStorage.setItem(SECTIONS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

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
        title={collapsed ? item.label : undefined}
      >
        <span className="unified-sidebar__item-icon">{item.icon}</span>
        <span className="unified-sidebar__item-label">{item.label}</span>
        {item.badge != null && (
          <span className="unified-sidebar__badge">{item.badge}</span>
        )}
        {collapsed && (
          <span className="unified-sidebar__tooltip">{item.label}</span>
        )}
      </button>
    );
  }

  // Auto-expand section when active item is inside a collapsed section
  useEffect(() => {
    if (!sections) return;
    for (const section of sections) {
      if (section.label && sectionsCollapsed[section.label]) {
        const hasActive = section.items.some(item => item.key === activeKey);
        if (hasActive) {
          setSectionsCollapsed(prev => {
            const next = { ...prev, [section.label]: false };
            try { localStorage.setItem(SECTIONS_KEY, JSON.stringify(next)); } catch {}
            return next;
          });
          break;
        }
      }
    }
  }, [activeKey]);

  const renderItems = sections ? (
    sections.map((section, i) => {
      const isCollapsedSection = section.label && sectionsCollapsed[section.label];
      return (
        <div key={i} className={i > 0 ? 'unified-sidebar__section' : undefined}>
          {section.label && (
            <button
              className="unified-sidebar__section-label"
              onClick={() => toggleSection(section.label)}
              aria-expanded={!isCollapsedSection}
              title={collapsed ? section.label : undefined}
            >
              <span className="unified-sidebar__section-label-text">{section.label}</span>
              <svg
                className={`unified-sidebar__section-chevron${isCollapsedSection ? ' unified-sidebar__section-chevron--collapsed' : ''}`}
                width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          )}
          <div className={`unified-sidebar__section-items${isCollapsedSection ? ' unified-sidebar__section-items--collapsed' : ''}`}>
            {section.items.map(renderItem)}
          </div>
        </div>
      );
    })
  ) : (
    menuItems?.map(renderItem)
  );

  // Build initials for collapsed title
  const titleInitials = title
    ? title.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
    : '';

  const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
  const showUserName = subtitle && fullName !== subtitle;

  const sidebarClasses = [
    'unified-sidebar',
    mobileOpen && 'open',
    collapsed && 'unified-sidebar--collapsed',
  ].filter(Boolean).join(' ');

  return (
    <>
      {mobileOpen && (
        <div
          className="unified-sidebar-overlay active"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={sidebarClasses}>
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

        {/* Header with logo */}
        <div className="unified-sidebar__header">
          <img src="/icons/logo_renca.png" alt="" className="unified-sidebar__logo" />
          <div className="unified-sidebar__header-text">
            <h2 className="unified-sidebar__title">
              {collapsed ? titleInitials : title}
            </h2>
            {subtitle && (
              <p className="unified-sidebar__subtitle">{subtitle}</p>
            )}
            {showUserName && (
              <p className="unified-sidebar__user-name">{fullName}</p>
            )}
          </div>
        </div>

        {/* Optional extra header content (org selector, etc.) */}
        {header}

        {/* Nav items */}
        <nav className="unified-sidebar__nav">
          {renderItems}
        </nav>

        {/* Footer */}
        <div className="unified-sidebar__footer">
          <button
            className="unified-sidebar__toggle-btn"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span className="unified-sidebar__toggle-label">
              {collapsed ? '' : 'Colapsar'}
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}
