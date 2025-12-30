import express from 'express';
import GuiaConstitucion from '../models/GuiaConstitucion.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/guia-constitucion
 * Obtener la guía de constitución (público)
 */
router.get('/', async (req, res) => {
  try {
    const guia = await GuiaConstitucion.getOrCreate();
    res.json({
      contentHTML: guia.contentHTML,
      isPublished: guia.isPublished,
      updatedAt: guia.updatedAt
    });
  } catch (error) {
    console.error('Error al obtener guía:', error);
    res.status(500).json({ error: 'Error al obtener la guía de constitución' });
  }
});

/**
 * PUT /api/guia-constitucion
 * Actualizar la guía de constitución (solo MUNICIPALIDAD)
 */
router.put('/', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const { contentHTML, isPublished } = req.body;

    const guia = await GuiaConstitucion.getOrCreate();

    if (contentHTML !== undefined) {
      guia.contentHTML = contentHTML;
    }
    if (isPublished !== undefined) {
      guia.isPublished = isPublished;
    }
    guia.lastUpdatedBy = req.user._id;

    await guia.save();

    res.json({
      message: 'Guía actualizada correctamente',
      guia: {
        contentHTML: guia.contentHTML,
        isPublished: guia.isPublished,
        updatedAt: guia.updatedAt
      }
    });
  } catch (error) {
    console.error('Error al actualizar guía:', error);
    res.status(500).json({ error: 'Error al actualizar la guía de constitución' });
  }
});

export default router;
