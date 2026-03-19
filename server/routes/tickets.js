import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { createTicketSchema, updateTicketStatusSchema } from '../middleware/validation.js';
import Ticket from '../models/Ticket.js';
import Organization from '../models/Organization.js';
import AuditLog from '../models/AuditLog.js';

const router = Router();

/**
 * POST / — Usuario crea un ticket para su organización
 */
router.post('/', authenticate, validate(createTicketSchema), async (req, res) => {
  try {
    const { title, description, category, organizationId } = req.body;

    // SEGURIDAD: Verificar que el usuario pertenece a la organización
    if (req.user.role !== 'MUNICIPALIDAD') {
      const org = await Organization.findById(organizationId).select('userId members provisionalDirectorio').lean();
      if (!org) {
        return res.status(404).json({ error: 'Organización no encontrada' });
      }

      const isOwner = org.userId?.toString() === req.user._id.toString();
      const cleanRut = (rut) => (rut || '').replace(/\./g, '').replace(/-/g, '').toUpperCase();
      const userRut = cleanRut(req.user.rut);
      const isMember = (org.members || []).some(m => cleanRut(m.rut) === userRut);
      const prov = org.provisionalDirectorio;
      const isDirectivo = prov && (
        (prov.president && cleanRut(prov.president.rut) === userRut) ||
        (prov.secretary && cleanRut(prov.secretary.rut) === userRut) ||
        (prov.treasurer && cleanRut(prov.treasurer.rut) === userRut) ||
        (prov.vicePresident && cleanRut(prov.vicePresident.rut) === userRut) ||
        (prov.additionalMembers || []).some(m => m && cleanRut(m.rut) === userRut)
      );

      if (!isOwner && !isMember && !isDirectivo) {
        return res.status(403).json({ error: 'No perteneces a esta organización' });
      }
    }

    const ticket = new Ticket({
      title,
      description,
      category,
      organizationId,
      createdBy: req.user._id
    });

    await ticket.save();

    await ticket.populate('organizationId', 'organizationName');
    await ticket.populate('createdBy', 'firstName lastName');

    res.status(201).json({
      message: 'Solicitud creada exitosamente',
      data: ticket
    });
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({ error: 'Error al crear la solicitud' });
  }
});

/**
 * GET /org/:orgId — Usuario ve tickets de su organización
 */
router.get('/org/:orgId', authenticate, async (req, res) => {
  try {
    const tickets = await Ticket.find({ organizationId: req.params.orgId })
      .sort({ createdAt: -1 })
      .populate('createdBy', 'firstName lastName')
      .populate('resolvedBy', 'firstName lastName')
      .lean();

    res.json({ data: tickets });
  } catch (error) {
    console.error('Error fetching org tickets:', error);
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
});

/**
 * GET /admin/all — Admin ve todos los tickets del sistema
 */
router.get('/admin/all', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'MUNICIPALIDAD') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const tickets = await Ticket.find()
      .sort({ createdAt: -1 })
      .populate('organizationId', 'organizationName')
      .populate('createdBy', 'firstName lastName')
      .populate('resolvedBy', 'firstName lastName')
      .lean();

    res.json({ data: tickets });
  } catch (error) {
    console.error('Error fetching all tickets:', error);
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
});

/**
 * PUT /admin/:id/status — Admin actualiza estado + nota de resolución
 */
router.put('/admin/:id/status', authenticate, validate(updateTicketStatusSchema), async (req, res) => {
  try {
    if (req.user.role !== 'MUNICIPALIDAD') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const { status, resolutionNote } = req.body;
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    const previousStatus = ticket.status;
    ticket.status = status;

    if (resolutionNote !== undefined) {
      ticket.resolutionNote = resolutionNote;
    }

    if (status === 'RESUELTO' || status === 'RECHAZADO') {
      ticket.resolvedBy = req.user._id;
      ticket.resolvedAt = new Date();
    }

    await ticket.save();

    // Audit log
    await AuditLog.logAction({
      userId: req.user._id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userRole: req.user.role,
      action: 'STATUS_CHANGE',
      resource: 'TICKET',
      resourceId: ticket._id,
      resourceName: ticket.title,
      details: {
        previousStatus,
        newStatus: status,
        resolutionNote: resolutionNote || null
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    await ticket.populate('organizationId', 'organizationName');
    await ticket.populate('createdBy', 'firstName lastName');
    await ticket.populate('resolvedBy', 'firstName lastName');

    res.json({
      message: 'Estado actualizado',
      data: ticket
    });
  } catch (error) {
    console.error('Error updating ticket status:', error);
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
});

export default router;
