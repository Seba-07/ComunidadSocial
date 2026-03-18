import { Router } from 'express';
import Bulletin from '../models/Bulletin.js';
import Organization from '../models/Organization.js';
import AuditLog from '../models/AuditLog.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// POST /api/bulletins — Create bulletin (admin only)
router.post('/', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const { title, content, targetAudience } = req.body;

    if (!title?.trim()) return res.status(400).json({ error: 'El título es obligatorio' });
    if (!content?.trim()) return res.status(400).json({ error: 'El contenido es obligatorio' });

    const bulletin = await Bulletin.create({
      title: title.trim(),
      content: content.trim(),
      targetAudience: targetAudience || 'TODAS',
      authorId: req.user._id,
      authorName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email
    });

    // Audit log
    AuditLog.logAction({
      userId: req.user._id,
      userName: req.user.firstName,
      userRole: req.user.role,
      action: 'CREATE',
      resource: 'SYSTEM',
      resourceId: bulletin._id,
      resourceName: title,
      detail: `Comunicado oficial enviado a: ${targetAudience}`,
      ipAddress: req.ip
    }).catch(() => {});

    res.status(201).json({ message: 'Comunicado creado exitosamente', data: bulletin });
  } catch (error) {
    console.error('Error creating bulletin:', error.message);
    res.status(500).json({ error: 'Error al crear el comunicado' });
  }
});

// GET /api/bulletins/admin — List all bulletins for admin
router.get('/admin', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const bulletins = await Bulletin.find()
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    res.json({ data: bulletins });
  } catch (error) {
    console.error('Error fetching bulletins:', error.message);
    res.status(500).json({ error: 'Error al obtener comunicados' });
  }
});

// DELETE /api/bulletins/:id — Delete bulletin (admin only)
router.delete('/:id', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const bulletin = await Bulletin.findByIdAndDelete(req.params.id);
    if (!bulletin) return res.status(404).json({ error: 'Comunicado no encontrado' });

    AuditLog.logAction({
      userId: req.user._id,
      userName: req.user.firstName,
      userRole: req.user.role,
      action: 'DELETE',
      resource: 'SYSTEM',
      resourceId: bulletin._id,
      resourceName: bulletin.title,
      detail: 'Comunicado oficial eliminado',
      ipAddress: req.ip
    }).catch(() => {});

    res.json({ message: 'Comunicado eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar el comunicado' });
  }
});

// GET /api/organizations/:id/bulletins — Bulletins relevant to this org
router.get('/:id/bulletins', authenticate, async (req, res) => {
  try {
    const org = await Organization.findById(req.params.id).select('organizationType boardStatus').lean();
    if (!org) return res.status(404).json({ error: 'Organización no encontrada' });

    // Build audience filter: TODAS + org type + DIRECTIVAS_VENCIDAS if applicable
    const audiences = ['TODAS'];
    if (org.organizationType) audiences.push(org.organizationType);
    if (org.boardStatus === 'VENCIDA') audiences.push('DIRECTIVAS_VENCIDAS');

    const bulletins = await Bulletin.find({ targetAudience: { $in: audiences } })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({ data: bulletins });
  } catch (error) {
    console.error('Error fetching org bulletins:', error.message);
    res.status(500).json({ error: 'Error al obtener comunicados' });
  }
});

export default router;
