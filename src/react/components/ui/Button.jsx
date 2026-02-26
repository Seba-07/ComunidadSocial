export default function Button({
  children,
  variant = 'primary',
  loading,
  disabled,
  className = '',
  ...props
}) {
  const variantClass = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    auth: 'btn-auth',
    danger: 'btn-danger'
  }[variant] || 'btn-primary';

  return (
    <button
      className={`${variantClass} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? 'Cargando...' : children}
    </button>
  );
}
