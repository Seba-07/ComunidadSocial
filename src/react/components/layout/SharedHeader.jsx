import { useAuthStore } from '../../stores/authStore';

/**
 * SharedHeader - Matches the vanilla JS .app-header from index.html.
 * Used in all React pages so they have the same header as the vanilla JS app.
 */
export default function SharedHeader() {
  const { user, logout } = useAuthStore();

  const initials = user
    ? `${(user.firstName || 'U')[0]}${(user.lastName || 'S')[0]}`.toUpperCase()
    : 'US';

  return (
    <header className="app-header sidebar-offset" role="banner">
      <div className="header-content">
        {/* Logo */}
        <a href="/" className="header-logo">
          <img src="/icons/logo_renca.png" alt="Logo Renca" className="logo-img" />
          <div className="header-info">
            <h1 className="header-title">Comunidad Renca</h1>
            <p className="header-subtitle">Bienvenido/a</p>
          </div>
        </a>

        {/* User info */}
        <div className="user-info" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="header-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span>{initials}</span>
          </div>
          <span className="user-name">{user?.firstName} {user?.lastName}</span>
          <button className="btn-secondary-sm" onClick={() => { logout(); window.location.href = '/app/login'; }}>
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
