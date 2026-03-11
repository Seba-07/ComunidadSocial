import express from 'express';
import tenant from '../config/tenant.js';

const router = express.Router();

// GET /api/tenant — Informacion publica de la municipalidad
// No requiere autenticacion (usado por el frontend para config dinamica)
router.get('/', (req, res) => {
  res.json({
    data: {
      communeName: tenant.communeName,
      municipalityName: tenant.municipalityName,
      municipalityFullName: tenant.municipalityFullName,
      platformName: tenant.platformName,
      platformShortName: tenant.platformShortName,
      website: tenant.website,
      address: tenant.address,
      phone: tenant.phone,
    }
  });
});

export default router;
