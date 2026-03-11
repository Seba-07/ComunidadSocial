import { useNavigate } from 'react-router-dom';
import tenant from '../../../config/tenant.js';

const sectionStyle = { marginBottom: 24 };
const h2Style = { fontSize: 18, fontWeight: 600, color: '#111827', margin: '24px 0 8px' };
const pStyle = { color: '#4b5563', lineHeight: 1.7, margin: '6px 0' };
const ulStyle = { color: '#4b5563', lineHeight: 1.7, paddingLeft: 24, margin: '6px 0' };

export default function TermsPage() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <header style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 14, color: '#374151' }}
        >
          Volver
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>{tenant.platformName}</h1>
      </header>

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '32px 40px' }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
            Términos de Uso
          </h1>
          <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 24 }}>
            Última actualización: 3 de marzo de 2026 | Versión 1.0
          </p>

          <div style={sectionStyle}>
            <h2 style={h2Style}>1. Aceptación de los Términos</h2>
            <p style={pStyle}>
              Al registrarse y utilizar la plataforma <strong>{tenant.platformName}</strong>, usted acepta estos
              Términos de Uso en su totalidad. Si no está de acuerdo con alguno de estos términos, no debe utilizar
              la plataforma.
            </p>
          </div>

          <div style={sectionStyle}>
            <h2 style={h2Style}>2. Descripción del Servicio</h2>
            <p style={pStyle}>
              {tenant.platformName} es una plataforma digital que facilita la constitución, registro y gestión
              de organizaciones comunitarias en la comuna de {tenant.communeName || 'la comuna'}, conforme a la <strong>Ley 19.418 sobre Juntas
              de Vecinos y demás Organizaciones Comunitarias</strong>. El servicio incluye:
            </p>
            <ul style={ulStyle}>
              <li>Registro y gestión de organizaciones comunitarias.</li>
              <li>Administración de socios, directorio y comisiones.</li>
              <li>Gestión de asambleas, votaciones y elecciones.</li>
              <li>Generación de documentos legales (actas constitutivas, estatutos).</li>
              <li>Coordinación con Ministros de Fe municipales.</li>
              <li>Comunicaciones y notificaciones organizacionales.</li>
            </ul>
          </div>

          <div style={sectionStyle}>
            <h2 style={h2Style}>3. Registro y Cuenta de Usuario</h2>
            <p style={pStyle}>Para utilizar la plataforma, usted se compromete a:</p>
            <ul style={ulStyle}>
              <li>Proporcionar información veraz, completa y actualizada.</li>
              <li>Mantener la confidencialidad de sus credenciales de acceso.</li>
              <li>Notificar inmediatamente cualquier uso no autorizado de su cuenta.</li>
              <li>No crear cuentas fraudulentas ni suplantar la identidad de terceros.</li>
            </ul>
            <p style={pStyle}>
              Usted es responsable de todas las actividades realizadas desde su cuenta.
            </p>
          </div>

          <div style={sectionStyle}>
            <h2 style={h2Style}>4. Uso Permitido</h2>
            <p style={pStyle}>La plataforma debe utilizarse exclusivamente para:</p>
            <ul style={ulStyle}>
              <li>Gestionar organizaciones comunitarias legítimas.</li>
              <li>Cumplir con los requisitos legales de la Ley 19.418.</li>
              <li>Comunicarse con otros miembros de su organización.</li>
              <li>Realizar trámites municipales relacionados.</li>
            </ul>
          </div>

          <div style={sectionStyle}>
            <h2 style={h2Style}>5. Uso Prohibido</h2>
            <p style={pStyle}>Queda expresamente prohibido:</p>
            <ul style={ulStyle}>
              <li>Utilizar la plataforma para actividades ilegales o fraudulentas.</li>
              <li>Intentar acceder a cuentas o datos de otros usuarios sin autorización.</li>
              <li>Realizar ingeniería inversa, descompilar o modificar el software.</li>
              <li>Transmitir contenido malicioso, virus o código dañino.</li>
              <li>Sobrecargar los servidores mediante solicitudes automatizadas masivas.</li>
              <li>Utilizar la información de otros usuarios para fines distintos a los autorizados.</li>
            </ul>
          </div>

          <div style={sectionStyle}>
            <h2 style={h2Style}>6. Propiedad Intelectual</h2>
            <p style={pStyle}>
              La plataforma, su diseño, código fuente, logotipos y contenido son propiedad de la {tenant.municipalityFullName} o sus licenciantes. Los documentos generados por los usuarios
              (actas, estatutos, etc.) son propiedad de las respectivas organizaciones comunitarias.
            </p>
          </div>

          <div style={sectionStyle}>
            <h2 style={h2Style}>7. Disponibilidad del Servicio</h2>
            <p style={pStyle}>
              Nos esforzamos por mantener la plataforma disponible de forma continua. Sin embargo, no garantizamos
              disponibilidad ininterrumpida y podemos realizar mantenimientos programados. No seremos responsables
              por interrupciones temporales del servicio.
            </p>
          </div>

          <div style={sectionStyle}>
            <h2 style={h2Style}>8. Limitación de Responsabilidad</h2>
            <p style={pStyle}>
              La plataforma se proporciona "tal cual". No nos hacemos responsables de:
            </p>
            <ul style={ulStyle}>
              <li>Errores u omisiones en la información proporcionada por los usuarios.</li>
              <li>Pérdida de datos por causas fuera de nuestro control.</li>
              <li>Decisiones tomadas con base en la información de la plataforma.</li>
              <li>Daños indirectos derivados del uso o imposibilidad de uso del servicio.</li>
            </ul>
          </div>

          <div style={sectionStyle}>
            <h2 style={h2Style}>9. Privacidad y Datos Personales</h2>
            <p style={pStyle}>
              El tratamiento de sus datos personales se rige por nuestra{' '}
              <a href="/app/privacy" style={{ color: '#2563eb', textDecoration: 'underline' }}>Política de Privacidad</a>,
              que forma parte integral de estos Términos de Uso.
            </p>
          </div>

          <div style={sectionStyle}>
            <h2 style={h2Style}>10. Suspensión y Terminación</h2>
            <p style={pStyle}>
              Nos reservamos el derecho de suspender o terminar su acceso a la plataforma en caso de:
            </p>
            <ul style={ulStyle}>
              <li>Incumplimiento de estos Términos de Uso.</li>
              <li>Uso fraudulento o abusivo de la plataforma.</li>
              <li>Solicitud de las autoridades competentes.</li>
            </ul>
            <p style={pStyle}>
              Usted puede eliminar su cuenta en cualquier momento desde la sección "Privacidad" de su panel de usuario.
            </p>
          </div>

          <div style={sectionStyle}>
            <h2 style={h2Style}>11. Legislación Aplicable</h2>
            <p style={pStyle}>
              Estos Términos de Uso se rigen por la legislación chilena. Cualquier controversia será sometida a los
              tribunales ordinarios de justicia con jurisdicción en la comuna de {tenant.communeName || 'la comuna'}, Región Metropolitana.
            </p>
          </div>

          <div style={sectionStyle}>
            <h2 style={h2Style}>12. Modificaciones</h2>
            <p style={pStyle}>
              Nos reservamos el derecho de modificar estos Términos de Uso. Los cambios serán notificados a través
              de la plataforma con al menos 30 días de anticipación. El uso continuado de la plataforma después de
              la notificación constituye aceptación de los nuevos términos.
            </p>
          </div>

          <div style={sectionStyle}>
            <h2 style={h2Style}>13. Contacto</h2>
            <p style={pStyle}>
              Para consultas sobre estos Términos de Uso, puede contactarnos a través de la plataforma o dirigirse
              a la {tenant.municipalityFullName}, {tenant.communeName || ''}, Región Metropolitana, Chile.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
