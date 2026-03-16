import express from 'express';
import SupportTicket from '../models/SupportTicket.js';
import { emailService } from '../services/emailService.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate, createSupportTicketSchema } from '../middleware/validation.js';
import tenant from '../config/tenant.js';

const router = express.Router();

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL_DESTINATION || process.env.TENANT_ADMIN_EMAIL || '';

/**
 * POST /api/support/ticket
 * Creates a support ticket. Works for both authenticated and anonymous users.
 * - Authenticated: reads name, rut, email from JWT token
 * - Anonymous: requires name, rut, email in body
 */
router.post('/ticket', optionalAuth, validate(createSupportTicketSchema), async (req, res) => {
  try {
    const { description } = req.body;

    // Build ticket data — prefer JWT user data if authenticated
    const ticketData = {
      description: description.trim(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || ''
    };

    if (req.user) {
      // Authenticated user — read from token
      ticketData.userId = req.userId;
      ticketData.name = `${req.user.firstName} ${req.user.lastName}`.trim();
      ticketData.rut = req.user.rut || '';
      ticketData.email = req.user.email || '';
      ticketData.role = req.user.role || '';
    } else {
      // Anonymous user — read from body
      const { name, rut, email } = req.body;
      if (!name || !email) {
        return res.status(400).json({ error: 'Nombre y email son requeridos para usuarios no autenticados' });
      }
      ticketData.name = name.trim();
      ticketData.rut = (rut || '').trim();
      ticketData.email = email.trim();
    }

    const ticket = await SupportTicket.create(ticketData);

    // Send email notification to support team
    if (SUPPORT_EMAIL) {
      await emailService.sendSupportTicketNotification({
        supportEmail: SUPPORT_EMAIL,
        ticketId: ticket._id,
        name: ticketData.name,
        rut: ticketData.rut,
        email: ticketData.email,
        role: ticketData.role,
        description: ticketData.description,
        createdAt: ticket.createdAt
      });
    }

    res.status(201).json({ message: 'Ticket de soporte creado exitosamente', data: { ticketId: ticket._id } });
  } catch (error) {
    console.error('Create support ticket error:', error);
    res.status(500).json({ error: 'Error al crear ticket de soporte' });
  }
});

/**
 * GET /api/support/tickets
 * Lists all support tickets (Admin only)
 */
router.get('/tickets', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const tickets = await SupportTicket.find()
      .sort({ createdAt: -1 })
      .lean();
    res.json(tickets);
  } catch (error) {
    console.error('List support tickets error:', error);
    res.status(500).json({ error: 'Error al obtener tickets' });
  }
});

/**
 * PUT /api/support/tickets/:id/status
 * Update ticket status (Admin only)
 */
router.put('/tickets/:id/status', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }
    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
    res.json({ message: 'Estado actualizado', ticket });
  } catch (error) {
    console.error('Update ticket status error:', error);
    res.status(500).json({ error: 'Error al actualizar ticket' });
  }
});

/**
 * Middleware that tries to authenticate but does NOT reject if no token.
 * Sets req.user and req.userId if valid JWT exists, otherwise continues.
 */
function optionalAuth(req, res, next) {
  // Try to extract token from cookie or Authorization header
  const cookieToken = req.cookies?.token;
  const headerToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  const token = cookieToken || headerToken;

  if (!token) {
    return next(); // No token — continue as anonymous
  }

  // Reuse the authenticate middleware but catch rejection
  authenticate(req, res, (err) => {
    // If authenticate calls next with error or sends response, ignore and continue as anonymous
    if (err) {
      req.user = null;
      req.userId = null;
    }
    next();
  });
}

export default router;
