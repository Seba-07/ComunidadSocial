import { Router } from 'express';
import Bulletin from '../models/Bulletin.js';
import Organization from '../models/Organization.js';
import AuditLog from '../models/AuditLog.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate, createBulletinSchema, updateBulletinSchema } from '../middleware/validation.js';

const router = Router();

// POST /api/bulletins — Create bulletin (admin only)
router.post('/', authenticate, requireRole('MUNICIPALIDAD'), validate(createBulletinSchema), async (req, res) => {
  try {
    const { title, content, targetAudience } = req.body;

    const bulletin = await Bulletin.create({
      title: title.trim(),
      content: content.trim(),
      targetAudience: targetAudience || 'TODAS',
      author: req.user._id
    });

    await bulletin.populate('author', 'firstName lastName');

    AuditLog.logAction({
      userId: req.user._id,
      userName: req.user.firstName,
      userRole: req.user.role,
      action: 'CREATE',
      resource: 'SYSTEM',
      resourceId: bulletin._id,
      resourceName: title,
      detail: `Anuncio oficial enviado a: ${targetAudience || 'TODAS'}`,
      ipAddress: req.ip
    }).catch(() => {});

    res.status(201).json({ message: 'Anuncio creado exitosamente', data: bulletin });
  } catch (error) {
    console.error('Error creating bulletin:', error.message);
    res.status(500).json({ error: 'Error al crear el anuncio' });
  }
});

// GET /api/bulletins/admin — List all bulletins with pagination
router.get('/admin', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const skip = (page - 1) * limit;

    const [bulletins, total] = await Promise.all([
      Bulletin.find()
        .populate('author', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Bulletin.countDocuments()
    ]);

    res.json({
      data: bulletins,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching bulletins:', error.message);
    res.status(500).json({ error: 'Error al obtener anuncios' });
  }
});

// PUT /api/bulletins/:id — Update bulletin (admin only)
router.put('/:id', authenticate, requireRole('MUNICIPALIDAD'), validate(updateBulletinSchema), async (req, res) => {
  try {
    const bulletin = await Bulletin.findById(req.params.id);
    if (!bulletin) return res.status(404).json({ error: 'Anuncio no encontrado' });

    const { title, content, targetAudience } = req.body;
    if (title !== undefined) bulletin.title = title.trim();
    if (content !== undefined) bulletin.content = content.trim();
    if (targetAudience !== undefined) bulletin.targetAudience = targetAudience;

    await bulletin.save();
    await bulletin.populate('author', 'firstName lastName');

    AuditLog.logAction({
      userId: req.user._id,
      userName: req.user.firstName,
      userRole: req.user.role,
      action: 'UPDATE',
      resource: 'SYSTEM',
      resourceId: bulletin._id,
      resourceName: bulletin.title,
      detail: 'Anuncio oficial actualizado',
      ipAddress: req.ip
    }).catch(() => {});

    res.json({ message: 'Anuncio actualizado', data: bulletin });
  } catch (error) {
    console.error('Error updating bulletin:', error.message);
    res.status(500).json({ error: 'Error al actualizar el anuncio' });
  }
});

// DELETE /api/bulletins/:id — Delete bulletin (admin only)
router.delete('/:id', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const bulletin = await Bulletin.findByIdAndDelete(req.params.id);
    if (!bulletin) return res.status(404).json({ error: 'Anuncio no encontrado' });

    AuditLog.logAction({
      userId: req.user._id,
      userName: req.user.firstName,
      userRole: req.user.role,
      action: 'DELETE',
      resource: 'SYSTEM',
      resourceId: bulletin._id,
      resourceName: bulletin.title,
      detail: 'Anuncio oficial eliminado',
      ipAddress: req.ip
    }).catch(() => {});

    res.json({ message: 'Anuncio eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar el anuncio' });
  }
});

// GET /api/organizations/:id/bulletins — Bulletins relevant to this org
router.get('/:id/bulletins', authenticate, async (req, res) => {
  try {
    const org = await Organization.findById(req.params.id).select('organizationType boardStatus').lean();
    if (!org) return res.status(404).json({ error: 'Organización no encontrada' });

    const audiences = ['TODAS'];
    if (org.organizationType) audiences.push(org.organizationType);
    if (org.boardStatus === 'VENCIDA') audiences.push('DIRECTIVAS_VENCIDAS');

    const bulletins = await Bulletin.find({ targetAudience: { $in: audiences } })
      .populate('author', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({ data: bulletins });
  } catch (error) {
    console.error('Error fetching org bulletins:', error.message);
    res.status(500).json({ error: 'Error al obtener anuncios' });
  }
});

export default router;
