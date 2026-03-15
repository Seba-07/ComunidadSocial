import express from 'express';
import AdminPreference from '../models/AdminPreference.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// GET /api/admin-preferences - Get all admin preferences
router.get('/', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const prefs = await AdminPreference.find().lean();
    const result = {};
    for (const p of prefs) {
      result[p.key] = p.value;
    }
    res.json(result);
  } catch (error) {
    console.error('Get admin preferences error:', error);
    res.status(500).json({ error: 'Error al obtener preferencias' });
  }
});

// GET /api/admin-preferences/:key - Get a single preference (also available to MINISTRO_FE)
router.get('/:key', authenticate, async (req, res) => {
  try {
    const pref = await AdminPreference.findOne({ key: req.params.key }).lean();
    res.json({ key: req.params.key, value: pref ? pref.value : null });
  } catch (error) {
    console.error('Get admin preference error:', error);
    res.status(500).json({ error: 'Error al obtener preferencia' });
  }
});

// PUT /api/admin-preferences/:key - Set a preference
router.put('/:key', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const { value } = req.body;
    if (value === undefined) {
      return res.status(400).json({ error: 'value es requerido' });
    }

    const pref = await AdminPreference.findOneAndUpdate(
      { key: req.params.key },
      { value, updatedBy: req.userId },
      { upsert: true, new: true }
    );

    res.json({ key: pref.key, value: pref.value });
  } catch (error) {
    console.error('Set admin preference error:', error);
    res.status(500).json({ error: 'Error al guardar preferencia' });
  }
});

export default router;
