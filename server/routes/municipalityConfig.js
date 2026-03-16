import express from 'express';
import AdminPreference from '../models/AdminPreference.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import tenant from '../config/tenant.js';

const router = express.Router();

const PREF_KEY = 'municipalityConfig';

// GET / — public, no auth required
router.get('/', async (req, res) => {
  try {
    const pref = await AdminPreference.findOne({ key: PREF_KEY });

    if (pref) {
      return res.json({ data: pref.value });
    }

    // Return empty defaults with fallback from tenant config
    res.json({
      data: {
        officialName: tenant.communeName || '',
        rut: '',
        address: '',
        region: tenant.region || '',
        comuna: tenant.communeName || ''
      }
    });
  } catch (error) {
    console.error('Error fetching municipality config:', error);
    res.status(500).json({ error: 'Error al obtener configuración municipal' });
  }
});

// PUT / — MUNICIPALIDAD only
router.put('/', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const { officialName, rut, address, region, comuna } = req.body;

    if (!officialName || !officialName.trim()) {
      return res.status(400).json({ error: 'El nombre oficial es obligatorio' });
    }

    const value = {
      officialName: officialName.trim(),
      rut: rut?.trim() || '',
      address: address?.trim() || '',
      region: region?.trim() || '',
      comuna: comuna?.trim() || ''
    };

    const pref = await AdminPreference.findOneAndUpdate(
      { key: PREF_KEY },
      { value, updatedBy: req.user._id },
      { upsert: true, new: true }
    );

    res.json({ message: 'Configuración municipal actualizada', data: pref.value });
  } catch (error) {
    console.error('Error updating municipality config:', error);
    res.status(500).json({ error: 'Error al actualizar configuración municipal' });
  }
});

export default router;
