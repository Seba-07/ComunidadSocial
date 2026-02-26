export default function AuthLayout({ children }) {
  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-left">
          <div className="auth-logo">
            <img src="/icons/logo_renca.png" alt="Logo Renca" />
            <h1>Comunidad Renca</h1>
          </div>
          <div className="auth-hero">
            <h2>Digitaliza tu organizaci&oacute;n comunitaria</h2>
            <p>Simplifica el proceso de constituci&oacute;n de Juntas de Vecinos y organizaciones funcionales seg&uacute;n la Ley 19.418</p>
          </div>
        </div>
        <div className="auth-right">
          {children}
        </div>
      </div>
    </div>
  );
}
