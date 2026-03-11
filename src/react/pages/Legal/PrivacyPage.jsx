import { useNavigate } from 'react-router-dom';
import tenant from '../../../config/tenant.js';

const sectionStyle = { marginBottom: 24 };
const h2Style = { fontSize: 18, fontWeight: 600, color: '#111827', margin: '24px 0 8px' };
const h3Style = { fontSize: 15, fontWeight: 600, color: '#374151', margin: '16px 0 6px' };
const pStyle = { color: '#4b5563', lineHeight: 1.7, margin: '6px 0' };
const ulStyle = { color: '#4b5563', lineHeight: 1.7, paddingLeft: 24, margin: '6px 0' };

export default function PrivacyPage() {
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
            Política de Privacidad
          </h1>
          <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 24 }}>
            Última actualización: 3 de marzo de 2026 | Versión 1.0
          </p>

          <div style={sectionStyle}>
            <h2 style={h2Style}>1. Responsable del Tratamiento</h2>
            <p style={pStyle}>
              La plataforma <strong>{tenant.platformName}</strong> es operada por la {tenant.municipalityFullName},
              con domicilio en {tenant.communeName || ''}, Región Metropolitana, Chile. En calidad de responsable del tratamiento de datos
              personales, nos comprometemos a proteger la privacidad de nuestros usuarios conforme a la
              <strong> Ley 19.628 sobre Protección de la Vida Privada</strong> y la <strong>Ley 21.719 sobre Protección
              de Datos Personales</strong>.
            </p>
          </div>

          <div style={sectionStyle}>
            <h2 style={h2Style}>2. Datos Personales que Recopilamos</h2>
            <p style={pStyle}>Recopilamos los siguientes datos personales:</p>
            <h3 style={h3Style}>2.1. Datos de identificación</h3>
            <ul style={ulStyle}>
              <li>Nombre y apellido</li>
              <li>RUT (Rol Único Tributario)</li>
              <li>Correo electrónico</li>
              <li>Número de teléfono (opcional)</li>
              <li>Dirección, comuna y región (opcional)</li>
            </ul>
            <h3 style={h3Style}>2.2. Datos de la organización</h3>
            <ul style={ulStyle}>
              <li>Nombre y tipo de organización comunitaria</li>
              <li>Dirección de la organización</li>
              <li>Datos de los miembros (nombre, RUT, fecha de nacimiento, cargo)</li>
              <li>Actas, estatutos y documentos constitutivos</li>
            </ul>
            <h3 style={h3Style}>2.3. Datos técnicos</h3>
            <ul style={ulStyle}>
              <li>Dirección IP</li>
              <li>Datos de sesión y autenticación</li>
              <li>Registros de actividad (logs de auditoría)</li>
            </ul>
          </div>

          <div style={sectionStyle}>
            <h2 style={h2Style}>3. Finalidades del Tratamiento</h2>
            <p style={pStyle}>Sus datos personales son tratados para las siguientes finalidades:</p>
            <ul style={ulStyle}>
              <li><strong>Esencial:</strong> Gestión de su cuenta de usuario, autenticación y funcionamiento de la plataforma.</li>
              <li><strong>Gestión organizacional:</strong> Constitución, registro y administración de organizaciones comunitarias conforme a la Ley 19.418.</li>
              <li><strong>Comunicaciones:</strong> Envío de notificaciones sobre el estado de sus trámites y organizaciones (con su consentimiento).</li>
              <li><strong>Compartir con Municipalidad:</strong> Transmisión de datos a la {tenant.municipalityFullName} para fines de registro y fiscalización (con su consentimiento).</li>
              <li><strong>Cumplimiento legal:</strong> Cumplimiento de obligaciones legales, incluyendo la Ley 19.418 sobre Juntas de Vecinos y demás Organizaciones Comunitarias.</li>
            </ul>
          </div>

          <div style={sectionStyle}>
            <h2 style={h2Style}>4. Base Legal del Tratamiento</h2>
            <p style={pStyle}>El tratamiento de sus datos se fundamenta en:</p>
            <ul style={ulStyle}>
              <li><strong>Consentimiento:</strong> Para el envío de comunicaciones y compartir datos con la municipalidad.</li>
              <li><strong>Ejecución de contrato:</strong> Para la prestación del servicio de la plataforma.</li>
              <li><strong>Cumplimiento legal:</strong> Para las obligaciones derivadas de la Ley 19.418 y normativa aplicable.</li>
              <li><strong>Interés legítimo:</strong> Para la seguridad de la plataforma y prevención de fraudes.</li>
            </ul>
          </div>

          <div style={sectionStyle}>
            <h2 style={h2Style}>5. Derechos ARCOP</h2>
            <p style={pStyle}>
              Conforme a la legislación chilena, usted tiene los siguientes derechos sobre sus datos personales:
            </p>
            <ul style={ulStyle}>
              <li><strong>Acceso:</strong> Conocer qué datos personales suyos están siendo tratados.</li>
              <li><strong>Rectificación:</strong> Solicitar la corrección de datos inexactos o incompletos.</li>
              <li><strong>Cancelación (Supresión):</strong> Solicitar la eliminación de sus datos cuando ya no sean necesarios.</li>
              <li><strong>Oposición:</strong> Oponerse al tratamiento de sus datos para determinadas finalidades.</li>
              <li><strong>Portabilidad:</strong> Obtener una copia de sus datos en formato estructurado y de uso común.</li>
            </ul>
            <p style={pStyle}>
              Puede ejercer estos derechos desde la sección <strong>"Privacidad"</strong> en el menú lateral de su cuenta,
              o contactándonos a través de los medios indicados en la sección 9.
            </p>
          </div>

          <div style={sectionStyle}>
            <h2 style={h2Style}>6. Conservación de Datos</h2>
            <p style={pStyle}>
              Sus datos personales serán conservados durante el tiempo necesario para cumplir con las finalidades
              para las que fueron recopilados. En particular:
            </p>
            <ul style={ulStyle}>
              <li>Datos de cuenta: mientras su cuenta esté activa.</li>
              <li>Datos organizacionales: conforme a los plazos legales de la Ley 19.418.</li>
              <li>Logs de auditoría: 365 días.</li>
              <li>En caso de eliminación de cuenta, sus datos serán anonimizados.</li>
            </ul>
          </div>

          <div style={sectionStyle}>
            <h2 style={h2Style}>7. Seguridad de los Datos</h2>
            <p style={pStyle}>
              Implementamos medidas técnicas y organizativas para proteger sus datos personales, incluyendo:
            </p>
            <ul style={ulStyle}>
              <li>Cifrado de contraseñas mediante algoritmos seguros (bcrypt).</li>
              <li>Comunicaciones cifradas mediante HTTPS/TLS.</li>
              <li>Autenticación basada en tokens seguros (cookies HttpOnly).</li>
              <li>Limitación de intentos de acceso (rate limiting).</li>
              <li>Registro de auditoría de acciones sensibles.</li>
            </ul>
          </div>

          <div style={sectionStyle}>
            <h2 style={h2Style}>8. Transferencia de Datos</h2>
            <p style={pStyle}>
              Sus datos pueden ser compartidos con:
            </p>
            <ul style={ulStyle}>
              <li>La {tenant.municipalityFullName}, para fines de registro y fiscalización de organizaciones comunitarias (solo con su consentimiento explícito).</li>
              <li>Proveedores de infraestructura tecnológica (hosting, base de datos) que actúan como encargados del tratamiento bajo contratos de confidencialidad.</li>
            </ul>
            <p style={pStyle}>No vendemos ni compartimos sus datos personales con terceros para fines comerciales.</p>
          </div>

          <div style={sectionStyle}>
            <h2 style={h2Style}>9. Contacto</h2>
            <p style={pStyle}>
              Para consultas sobre esta política de privacidad o para ejercer sus derechos, puede contactarnos a través de:
            </p>
            <ul style={ulStyle}>
              <li>Plataforma: Sección "Privacidad" en su panel de usuario.</li>
              <li>Dirección: {tenant.municipalityFullName}, {tenant.communeName || ''}, Región Metropolitana, Chile.</li>
            </ul>
          </div>

          <div style={sectionStyle}>
            <h2 style={h2Style}>10. Modificaciones</h2>
            <p style={pStyle}>
              Nos reservamos el derecho de modificar esta política de privacidad. Cualquier cambio será notificado
              a través de la plataforma. La versión vigente siempre estará disponible en esta página.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
