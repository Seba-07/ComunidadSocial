import { useAuthStore } from '../../stores/authStore';
import NotificationBell from '../ui/NotificationBell';
import tenant from '../../../config/tenant.js';

/**
 * SharedHeader - Minimal top bar beside the sidebar.
 * Clean design: notifications bell + user info + logout on the right.
 */
export default function SharedHeader() {
  const { user, logout } = useAuthStore();

  const initials = user
    ? `${(user.firstName || 'U')[0]}${(user.lastName || 'S')[0]}`.toUpperCase()
    : 'US';

  async function handleLogout() {
    try {
      await logout();
    } catch { /* ignore */ }
    localStorage.removeItem('currentUser');
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('currentMinistro');
    localStorage.removeItem('isMinistroAuthenticated');
    localStorage.removeItem('user_organizations');
    window.location.href = '/app/login';
  }

  function openMobileSidebar() {
    document.dispatchEvent(new CustomEvent('open-mobile-sidebar'));
  }

  return (
    <header
      className="app-header"
      role="banner"
      style={{ left: 'var(--sidebar-width, 260px)', transition: 'left 0.25s ease' }}
    >
      <div className="header-content">
        {/* Hamburger button (mobile only) */}
        <button
          className="menu-btn"
          onClick={openMobileSidebar}
          aria-label="Abrir menú"
        >
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        {/* Left side - breadcrumb / title area */}
        <div className="header-left">
          <span className="header-welcome">{tenant.platformName}</span>
        </div>

        {/* Right side - notifications + user info */}
        <div className="user-info" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <NotificationBell />
          <div className="header-avatar">
            <span>{initials}</span>
          </div>
          <span className="user-name r-hide-mobile">{user?.firstName} {user?.lastName}</span>
          <button className="btn-secondary-sm r-hide-mobile" onClick={handleLogout}>
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
