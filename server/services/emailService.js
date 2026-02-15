/**
 * emailService.js
 * Servicio de notificaciones por correo electrónico usando Nodemailer.
 * Soporta modo "dry run" cuando SMTP_HOST no está configurado.
 */

import nodemailer from 'nodemailer';

// ---------------------------------------------------------------------------
// Configuración SMTP desde variables de entorno
// ---------------------------------------------------------------------------
const DRY_RUN = !process.env.SMTP_HOST;

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT, 10) || 587;
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || 'noreply@comunidadrenca.cl';

if (DRY_RUN) {
  console.warn(
    '[emailService] SMTP_HOST no está configurado. El servicio operará en modo dry-run (los correos se imprimirán en consola).'
  );
}

// ---------------------------------------------------------------------------
// Transporter (solo se crea cuando hay configuración real)
// ---------------------------------------------------------------------------
let transporter = null;

if (!DRY_RUN) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: false,
    requireTLS: true,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

// ---------------------------------------------------------------------------
// Mapa de estados en español
// ---------------------------------------------------------------------------
const STATUS_LABELS = {
  draft: 'Borrador',
  waiting_ministro: 'Esperando Ministro de Fe',
  ministro_scheduled: 'Ministro Agendado',
  ministro_approved: 'Aprobado por Ministro',
  pending_review: 'Pendiente de Revisión',
  in_review: 'En Revisión',
  rejected: 'Requiere Correcciones',
  sent_registry: 'Enviado a Registro Civil',
  registry_observations: 'Observaciones de Registro',
  approved: 'Aprobada',
  dissolved: 'Disuelta',
};

// ---------------------------------------------------------------------------
// Helpers para plantillas HTML
// ---------------------------------------------------------------------------

/**
 * Genera el envoltorio HTML común que comparten todos los correos.
 *
 * @param {string} title   - Título mostrado en el header.
 * @param {string} bodyHtml - Contenido HTML del cuerpo.
 * @returns {string} Documento HTML completo.
 */
function buildEmailTemplate(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f4f6f8; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 24px 32px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 600; }
    .header p.subtitle { color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 13px; }
    .logo-area { color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: 1px; margin-bottom: 8px; }
    .body { padding: 32px; color: #333333; font-size: 15px; line-height: 1.6; }
    .body h2 { color: #3b82f6; font-size: 18px; margin-top: 0; }
    .status-badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; }
    .status-approved { background-color: #d4edda; color: #155724; }
    .status-rejected { background-color: #f8d7da; color: #721c24; }
    .status-info { background-color: #d1ecf1; color: #0c5460; }
    .status-warning { background-color: #fff3cd; color: #856404; }
    .info-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    .info-table td { padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 14px; }
    .info-table td:first-child { font-weight: 600; color: #555; width: 40%; }
    .corrections-list { background-color: #fff8f0; border-left: 4px solid #e67e22; padding: 12px 16px; margin: 16px 0; border-radius: 0 4px 4px 0; }
    .corrections-list li { margin-bottom: 6px; }
    .cta-button { display: inline-block; padding: 12px 28px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; margin-top: 16px; }
    .footer { background-color: #f4f6f8; padding: 20px 32px; text-align: center; font-size: 12px; color: #888888; border-top: 1px solid #e9ecef; }
    .footer p { margin: 4px 0; }
    .divider { height: 1px; background-color: #e9ecef; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="logo-area">Comunidad Renca</div>
      <h1>${title}</h1>
      <p class="subtitle">Municipalidad de Renca</p>
    </div>

    <!-- Body -->
    <div class="body">
      ${bodyHtml}
    </div>

    <!-- Footer -->
    <div class="footer">
      <p><strong>Comunidad Renca</strong> &mdash; Municipalidad de Renca</p>
      <p>Este correo fue generado automáticamente. Por favor no responda a este mensaje.</p>
      <p>&copy; ${new Date().getFullYear()} Municipalidad de Renca. Todos los derechos reservados.</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Devuelve la clase CSS del badge según el estado.
 */
function statusBadgeClass(status) {
  if (status === 'approved') return 'status-approved';
  if (status === 'rejected') return 'status-rejected';
  if (['dissolved'].includes(status)) return 'status-warning';
  return 'status-info';
}

// ---------------------------------------------------------------------------
// Servicio
// ---------------------------------------------------------------------------
const emailService = {
  // -----------------------------------------------------------------------
  // 1. Método central de envío
  // -----------------------------------------------------------------------

  /**
   * Envía un correo electrónico.
   * En modo dry-run simplemente registra la información en consola.
   *
   * @param {Object}  params
   * @param {string}  params.to      - Dirección de destino.
   * @param {string}  params.subject - Asunto del correo.
   * @param {string}  params.html    - Cuerpo HTML del correo.
   */
  async sendEmail({ to, subject, html }) {
    try {
      if (DRY_RUN) {
        console.log('[emailService] DRY RUN ─────────────────────────────');
        console.log(`  Para:   ${to}`);
        console.log(`  Asunto: ${subject}`);
        console.log('  HTML:   (omitido en consola)');
        console.log('──────────────────────────────────────────────────');
        return;
      }

      await transporter.sendMail({
        from: SMTP_FROM,
        to,
        subject,
        html,
      });

      console.log(`[emailService] Correo enviado a ${to}: "${subject}"`);
    } catch (error) {
      console.error(`[emailService] Error al enviar correo a ${to}:`, error.message);
    }
  },

  // -----------------------------------------------------------------------
  // 2. Notificación de cambio de estado
  // -----------------------------------------------------------------------

  /**
   * Notifica al usuario que el estado de su organización ha cambiado.
   *
   * @param {Object}  params
   * @param {string}  params.email     - Correo del destinatario.
   * @param {string}  params.userName  - Nombre del usuario.
   * @param {string}  params.orgName   - Nombre de la organización.
   * @param {string}  params.newStatus - Clave del nuevo estado.
   * @param {string}  [params.comment] - Comentario opcional.
   */
  async sendStatusChangeNotification({ email, userName, orgName, newStatus, comment }) {
    const statusLabel = STATUS_LABELS[newStatus] || newStatus;
    const badgeClass = statusBadgeClass(newStatus);

    const bodyHtml = `
      <h2>Actualización de estado</h2>
      <p>Hola <strong>${userName}</strong>,</p>
      <p>Le informamos que el estado de su organización ha sido actualizado:</p>

      <table class="info-table">
        <tr>
          <td>Organización</td>
          <td>${orgName}</td>
        </tr>
        <tr>
          <td>Nuevo estado</td>
          <td><span class="status-badge ${badgeClass}">${statusLabel}</span></td>
        </tr>
      </table>

      ${comment ? `
      <div class="divider"></div>
      <p><strong>Comentario:</strong></p>
      <p>${comment}</p>
      ` : ''}

      <p>Puede revisar el detalle de su solicitud ingresando a la plataforma.</p>
    `;

    const subject = `Estado actualizado: ${orgName} — ${statusLabel}`;
    const html = buildEmailTemplate('Cambio de Estado', bodyHtml);

    await this.sendEmail({ to: email, subject, html });
  },

  // -----------------------------------------------------------------------
  // 3. Notificación de asignación de Ministro de Fe
  // -----------------------------------------------------------------------

  /**
   * Notifica al dueño de la organización que un Ministro de Fe fue asignado.
   *
   * @param {Object}  params
   * @param {string}  params.email          - Correo del destinatario.
   * @param {string}  params.userName       - Nombre del usuario.
   * @param {string}  params.orgName        - Nombre de la organización.
   * @param {string}  params.ministroName   - Nombre del Ministro de Fe.
   * @param {string}  [params.scheduledDate] - Fecha de la visita.
   * @param {string}  [params.scheduledTime] - Hora de la visita.
   * @param {string}  [params.location]      - Lugar de la visita.
   */
  async sendMinistroAssignmentNotification({
    email,
    userName,
    orgName,
    ministroName,
    scheduledDate,
    scheduledTime,
    location,
  }) {
    const bodyHtml = `
      <h2>Ministro de Fe Asignado</h2>
      <p>Hola <strong>${userName}</strong>,</p>
      <p>Le informamos que se ha asignado un <strong>Ministro de Fe</strong> para la constitución de su organización:</p>

      <table class="info-table">
        <tr>
          <td>Organización</td>
          <td>${orgName}</td>
        </tr>
        <tr>
          <td>Ministro de Fe</td>
          <td>${ministroName}</td>
        </tr>
        ${scheduledDate ? `
        <tr>
          <td>Fecha programada</td>
          <td>${scheduledDate}</td>
        </tr>` : ''}
        ${scheduledTime ? `
        <tr>
          <td>Hora</td>
          <td>${scheduledTime}</td>
        </tr>` : ''}
        ${location ? `
        <tr>
          <td>Lugar</td>
          <td>${location}</td>
        </tr>` : ''}
      </table>

      <p>Por favor asegúrese de que todo esté preparado para la fecha indicada. Si necesita reagendar, comuníquese con nosotros a través de la plataforma.</p>
    `;

    const subject = `Ministro de Fe asignado: ${orgName}`;
    const html = buildEmailTemplate('Asignación de Ministro de Fe', bodyHtml);

    await this.sendEmail({ to: email, subject, html });
  },

  // -----------------------------------------------------------------------
  // 4. Notificación de aprobación
  // -----------------------------------------------------------------------

  /**
   * Envía correo de felicitación cuando la organización es aprobada.
   *
   * @param {Object}  params
   * @param {string}  params.email       - Correo del destinatario.
   * @param {string}  params.userName    - Nombre del usuario.
   * @param {string}  params.orgName     - Nombre de la organización.
   * @param {string}  [params.certNumber] - Número de certificado.
   */
  async sendApprovalNotification({ email, userName, orgName, certNumber }) {
    const bodyHtml = `
      <h2>¡Felicitaciones!</h2>
      <p>Hola <strong>${userName}</strong>,</p>
      <p>Nos complace informarle que su organización ha sido <strong>aprobada</strong> exitosamente.</p>

      <table class="info-table">
        <tr>
          <td>Organización</td>
          <td>${orgName}</td>
        </tr>
        <tr>
          <td>Estado</td>
          <td><span class="status-badge status-approved">Aprobada</span></td>
        </tr>
        ${certNumber ? `
        <tr>
          <td>N° Certificado</td>
          <td><strong>${certNumber}</strong></td>
        </tr>` : ''}
      </table>

      <div class="divider"></div>

      <p>Su organización comunitaria ha completado satisfactoriamente todos los requisitos establecidos por la <strong>Ley 19.418</strong> sobre Juntas de Vecinos y demás Organizaciones Comunitarias.</p>
      <p>Puede descargar su certificado y documentación ingresando a la plataforma.</p>
    `;

    const subject = `¡Organización aprobada! — ${orgName}`;
    const html = buildEmailTemplate('Organización Aprobada', bodyHtml);

    await this.sendEmail({ to: email, subject, html });
  },

  // -----------------------------------------------------------------------
  // 5. Notificación de rechazo
  // -----------------------------------------------------------------------

  /**
   * Notifica sobre el rechazo de la solicitud con detalles de correcciones.
   *
   * @param {Object}   params
   * @param {string}   params.email       - Correo del destinatario.
   * @param {string}   params.userName    - Nombre del usuario.
   * @param {string}   params.orgName     - Nombre de la organización.
   * @param {string[]} [params.corrections] - Lista de correcciones requeridas.
   * @param {string}   [params.comment]    - Comentario adicional del revisor.
   */
  async sendRejectionNotification({ email, userName, orgName, corrections, comment }) {
    const correctionsList =
      corrections && corrections.length > 0
        ? `
      <div class="corrections-list">
        <strong>Correcciones requeridas:</strong>
        <ul>
          ${corrections.map((c) => `<li>${c}</li>`).join('\n          ')}
        </ul>
      </div>`
        : '';

    const bodyHtml = `
      <h2>Correcciones Requeridas</h2>
      <p>Hola <strong>${userName}</strong>,</p>
      <p>Lamentamos informarle que su solicitud necesita correcciones antes de poder continuar con el proceso:</p>

      <table class="info-table">
        <tr>
          <td>Organización</td>
          <td>${orgName}</td>
        </tr>
        <tr>
          <td>Estado</td>
          <td><span class="status-badge status-rejected">Requiere Correcciones</span></td>
        </tr>
      </table>

      ${correctionsList}

      ${comment ? `
      <div class="divider"></div>
      <p><strong>Comentario del revisor:</strong></p>
      <p>${comment}</p>
      ` : ''}

      <p>Por favor realice las correcciones indicadas y vuelva a enviar su solicitud a través de la plataforma.</p>
    `;

    const subject = `Correcciones requeridas: ${orgName}`;
    const html = buildEmailTemplate('Correcciones Requeridas', bodyHtml);

    await this.sendEmail({ to: email, subject, html });
  },

  // -----------------------------------------------------------------------
  // 6. Advertencia de plazo legal
  // -----------------------------------------------------------------------

  /**
   * Advierte sobre un plazo legal próximo a vencer (Ley 19.418).
   *
   * @param {Object}  params
   * @param {string}  params.email         - Correo del destinatario.
   * @param {string}  params.userName      - Nombre del usuario.
   * @param {string}  params.orgName       - Nombre de la organización.
   * @param {string}  params.deadlineType  - Tipo de plazo.
   * @param {number}  params.daysRemaining - Días restantes.
   * @param {string}  params.description   - Descripción del plazo.
   */
  async sendLegalDeadlineWarning({ email, userName, orgName, deadlineType, daysRemaining, description }) {
    const urgencyClass = daysRemaining <= 7 ? 'status-rejected' : 'status-warning';
    const urgencyLabel = daysRemaining <= 7 ? 'Urgente' : 'Próximo a vencer';

    const bodyHtml = `
      <h2>Aviso de Plazo Legal</h2>
      <p>Hola <strong>${userName}</strong>,</p>
      <p>Le informamos que se aproxima un plazo legal importante para su organización según la <strong>Ley 19.418</strong>:</p>

      <table class="info-table">
        <tr>
          <td>Organización</td>
          <td>${orgName}</td>
        </tr>
        <tr>
          <td>Tipo de plazo</td>
          <td>${deadlineType}</td>
        </tr>
        <tr>
          <td>Días restantes</td>
          <td><span class="status-badge ${urgencyClass}">${daysRemaining} días — ${urgencyLabel}</span></td>
        </tr>
      </table>

      <div class="divider"></div>

      <p><strong>Detalle:</strong></p>
      <p>${description}</p>

      <p>Le recomendamos tomar las acciones necesarias lo antes posible para cumplir con los plazos establecidos por la ley.</p>
    `;

    const subject = `⚠ Plazo legal próximo: ${deadlineType} — ${orgName}`;
    const html = buildEmailTemplate('Aviso de Plazo Legal', bodyHtml);

    await this.sendEmail({ to: email, subject, html });
  },

  // -----------------------------------------------------------------------
  // 7. Correo de bienvenida para miembros
  // -----------------------------------------------------------------------

  /**
   * Envía un correo de bienvenida a un miembro creado automáticamente.
   *
   * @param {Object}  params
   * @param {string}  params.email        - Correo del destinatario.
   * @param {string}  params.userName     - Nombre del usuario.
   * @param {string}  params.orgName      - Nombre de la organización.
   * @param {string}  params.tempPassword - Contraseña temporal.
   */
  async sendWelcomeMemberEmail({ email, userName, orgName, tempPassword }) {
    const bodyHtml = `
      <h2>¡Bienvenido/a a Comunidad Renca!</h2>
      <p>Hola <strong>${userName}</strong>,</p>
      <p>Se ha creado una cuenta para usted como miembro de la organización <strong>${orgName}</strong> en la plataforma Comunidad Renca.</p>

      <table class="info-table">
        <tr>
          <td>Correo electrónico</td>
          <td>${email}</td>
        </tr>
        <tr>
          <td>Organización</td>
          <td>${orgName}</td>
        </tr>
        <tr>
          <td>Contraseña temporal</td>
          <td><strong>${tempPassword}</strong></td>
        </tr>
      </table>

      <div class="divider"></div>

      <p><strong>Importante:</strong> Por seguridad, le recomendamos cambiar su contraseña temporal la primera vez que inicie sesión en la plataforma.</p>

      <p>Si tiene alguna consulta, no dude en contactarse con el administrador de su organización.</p>
    `;

    const subject = `Bienvenido/a a ${orgName} — Comunidad Renca`;
    const html = buildEmailTemplate('Bienvenida', bodyHtml);

    await this.sendEmail({ to: email, subject, html });
  },
};

export { emailService };
