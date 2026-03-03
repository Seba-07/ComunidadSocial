import { useAuthStore } from '../../stores/authStore';

/**
 * SharedHeader - Minimal top bar beside the sidebar.
 * Clean design: just user info + logout on the right.
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
    localStorage.removeItem('auth_token');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('currentMinistro');
    localStorage.removeItem('isMinistroAuthenticated');
    localStorage.removeItem('user_organizations');
    window.location.href = '/app/login';
  }

  return (
    <header
      className="app-header"
      role="banner"
      style={{ left: 'var(--sidebar-width, 260px)', transition: 'left 0.25s ease' }}
    >
      <div className="header-content">
        {/* Left side - breadcrumb / title area */}
        <div className="header-left">
          <span className="header-welcome">Comunidad Social Renca</span>
        </div>

        {/* Right side - user info */}
        <div className="user-info" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="header-avatar">
            <span>{initials}</span>
          </div>
          <span className="user-name">{user?.firstName} {user?.lastName}</span>
          <button className="btn-secondary-sm" onClick={handleLogout}>
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
