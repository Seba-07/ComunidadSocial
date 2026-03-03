import express from 'express';
import User from '../models/User.js';
import Consent from '../models/Consent.js';
import Organization from '../models/Organization.js';
import AuditLog from '../models/AuditLog.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { storeDocument, deleteDocument } from '../services/storageService.js';

const router = express.Router();

// Get all users (Admin only)
router.get('/', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const users = await User.find({ role: 'ORGANIZADOR' }).sort({ createdAt: -1 });

    // Log PII access
    AuditLog.logAction({
      userId: req.userId,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userRole: req.user.role,
      action: 'ACCESS_PII',
      resource: 'USER',
      details: { type: 'list_all_users', count: users.length },
      ipAddress: req.ip
    });

    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// ============================================
// RUTAS /me/* - DEBEN IR ANTES DE /:id
// ============================================

// Obtener timbre y firma del usuario actual
router.get('/me/timbre-firma', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({
      timbreVirtual: user.timbreVirtual || { imagen: null, activo: false },
      firmaDigital: user.firmaDigital || { imagen: null, activo: false }
    });
  } catch (error) {
    console.error('Get timbre/firma error:', error);
    res.status(500).json({ error: 'Error al obtener timbre/firma' });
  }
});

// Subir timbre virtual
router.post('/me/timbre-virtual', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const { imagen } = req.body;

    if (!imagen) {
      return res.status(400).json({ error: 'La imagen del timbre es requerida' });
    }

    // Validar que sea base64 de imagen
    if (!imagen.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Formato de imagen inválido' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const result = await storeDocument(imagen, { type: 'timbre', memberId: req.userId });
    user.timbreVirtual = {
      imagen: result.stored === 's3' ? `s3:${result.s3Key}` : imagen,
      fechaSubida: new Date(),
      activo: true
    };

    await user.save();

    res.json({
      message: 'Timbre virtual guardado correctamente',
      timbreVirtual: user.timbreVirtual
    });
  } catch (error) {
    console.error('Upload timbre error:', error);
    res.status(500).json({ error: 'Error al guardar timbre virtual' });
  }
});

// Subir firma digital
router.post('/me/firma-digital', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const { imagen } = req.body;

    if (!imagen) {
      return res.status(400).json({ error: 'La imagen de la firma es requerida' });
    }

    if (!imagen.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Formato de imagen inválido' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const result = await storeDocument(imagen, { type: 'firma', memberId: req.userId });
    user.firmaDigital = {
      imagen: result.stored === 's3' ? `s3:${result.s3Key}` : imagen,
      fechaSubida: new Date(),
      activo: true
    };

    await user.save();

    res.json({
      message: 'Firma digital guardada correctamente',
      firmaDigital: user.firmaDigital
    });
  } catch (error) {
    console.error('Upload firma error:', error);
    res.status(500).json({ error: 'Error al guardar firma digital' });
  }
});

// Eliminar timbre virtual
router.delete('/me/timbre-virtual', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    user.timbreVirtual = {
      imagen: null,
      fechaSubida: null,
      activo: false
    };

    await user.save();

    res.json({ message: 'Timbre virtual eliminado' });
  } catch (error) {
    console.error('Delete timbre error:', error);
    res.status(500).json({ error: 'Error al eliminar timbre' });
  }
});

// Eliminar firma digital
router.delete('/me/firma-digital', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    user.firmaDigital = {
      imagen: null,
      fechaSubida: null,
      activo: false
    };

    await user.save();

    res.json({ message: 'Firma digital eliminada' });
  } catch (error) {
    console.error('Delete firma error:', error);
    res.status(500).json({ error: 'Error al eliminar firma' });
  }
});

// Toggle activar/desactivar timbre
router.post('/me/timbre-virtual/toggle', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (!user.timbreVirtual?.imagen) {
      return res.status(400).json({ error: 'No hay timbre configurado' });
    }

    user.timbreVirtual.activo = !user.timbreVirtual.activo;
    await user.save();

    res.json({
      message: user.timbreVirtual.activo ? 'Timbre activado' : 'Timbre desactivado',
      activo: user.timbreVirtual.activo
    });
  } catch (error) {
    console.error('Toggle timbre error:', error);
    res.status(500).json({ error: 'Error al cambiar estado del timbre' });
  }
});

// ============================================
// RUTAS DE PRIVACIDAD /me/* (Ley 21.719)
// ============================================

// Get user's consent preferences
router.get('/me/consents', authenticate, async (req, res) => {
  try {
    const consents = await Consent.find({ userId: req.userId }).lean();
    // Return all purposes with their current state
    const purposes = ['essential', 'notifications_email', 'data_sharing_municipality'];
    const result = purposes.map(purpose => {
      const existing = consents.find(c => c.purpose === purpose);
      return {
        purpose,
        granted: existing?.granted || false,
        grantedAt: existing?.grantedAt || null,
        withdrawnAt: existing?.withdrawnAt || null,
        version: existing?.version || '1.0'
      };
    });
    res.json({ consents: result });
  } catch (error) {
    console.error('Get consents error:', error);
    res.status(500).json({ error: 'Error al obtener consentimientos' });
  }
});

// Update user's consent preferences
router.put('/me/consents', authenticate, async (req, res) => {
  try {
    const { consents } = req.body;
    if (!consents || !Array.isArray(consents)) {
      return res.status(400).json({ error: 'Formato de consentimientos inválido' });
    }

    const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const updatable = ['notifications_email', 'data_sharing_municipality'];
    const results = [];

    for (const item of consents) {
      if (!updatable.includes(item.purpose)) continue;

      const update = {
        granted: !!item.granted,
        version: '1.0',
        ipAddress: clientIp
      };

      if (item.granted) {
        update.grantedAt = new Date();
        update.withdrawnAt = null;
      } else {
        update.withdrawnAt = new Date();
      }

      const consent = await Consent.findOneAndUpdate(
        { userId: req.userId, purpose: item.purpose },
        { $set: update },
        { upsert: true, new: true }
      );
      results.push(consent);
    }

    // Audit log
    await AuditLog.logAction({
      userId: req.userId,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userRole: req.user.role,
      action: 'UPDATE',
      resource: 'USER',
      resourceId: req.userId,
      details: { type: 'consent_update', consents: consents.map(c => ({ purpose: c.purpose, granted: c.granted })) },
      ipAddress: clientIp
    });

    res.json({ message: 'Consentimientos actualizados', consents: results });
  } catch (error) {
    console.error('Update consents error:', error);
    res.status(500).json({ error: 'Error al actualizar consentimientos' });
  }
});

// Export user's personal data (JSON or CSV)
router.get('/me/export', authenticate, async (req, res) => {
  try {
    const format = req.query.format || 'json';
    const user = await User.findById(req.userId).select('-password -timbreVirtual -firmaDigital').lean();
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const consents = await Consent.find({ userId: req.userId }).select('-__v').lean();

    // Gather organization memberships
    const orgIds = user.organizationIds || [];
    if (user.organizationId) orgIds.push(user.organizationId);
    const organizations = await Organization.find({ _id: { $in: orgIds } })
      .select('organizationName organizationType status')
      .lean();

    const exportData = {
      datosPersonales: {
        nombre: user.firstName,
        apellido: user.lastName,
        rut: user.rut,
        email: user.email,
        telefono: user.phone || '',
        direccion: user.address || '',
        region: user.region || '',
        comuna: user.commune || '',
        rol: user.role,
        cuentaActiva: user.active,
        fechaRegistro: user.createdAt,
        privacidadAceptada: user.privacyAcceptedAt,
        versionPolitica: user.privacyPolicyVersion
      },
      consentimientos: consents.map(c => ({
        proposito: c.purpose,
        otorgado: c.granted,
        fechaOtorgamiento: c.grantedAt,
        fechaRetiro: c.withdrawnAt,
        version: c.version
      })),
      organizaciones: organizations.map(o => ({
        nombre: o.organizationName,
        tipo: o.organizationType,
        estado: o.status
      })),
      exportadoEn: new Date().toISOString()
    };

    // Audit log
    await AuditLog.logAction({
      userId: req.userId,
      userName: `${user.firstName} ${user.lastName}`,
      userRole: user.role,
      action: 'EXPORT',
      resource: 'USER',
      resourceId: req.userId,
      details: { type: 'personal_data_export', format },
      ipAddress: req.ip
    });

    if (format === 'csv') {
      const lines = [
        'Campo,Valor',
        `Nombre,"${exportData.datosPersonales.nombre}"`,
        `Apellido,"${exportData.datosPersonales.apellido}"`,
        `RUT,"${exportData.datosPersonales.rut}"`,
        `Email,"${exportData.datosPersonales.email}"`,
        `Teléfono,"${exportData.datosPersonales.telefono}"`,
        `Dirección,"${exportData.datosPersonales.direccion}"`,
        `Región,"${exportData.datosPersonales.region}"`,
        `Comuna,"${exportData.datosPersonales.comuna}"`,
        `Rol,"${exportData.datosPersonales.rol}"`,
        `Cuenta Activa,"${exportData.datosPersonales.cuentaActiva}"`,
        `Fecha Registro,"${exportData.datosPersonales.fechaRegistro}"`,
        `Privacidad Aceptada,"${exportData.datosPersonales.privacidadAceptada}"`,
        '',
        'Consentimiento,Otorgado,Fecha',
        ...exportData.consentimientos.map(c =>
          `"${c.proposito}","${c.otorgado}","${c.fechaOtorgamiento || ''}"`
        ),
        '',
        'Organización,Tipo,Estado',
        ...exportData.organizaciones.map(o =>
          `"${o.nombre}","${o.tipo}","${o.estado}"`
        )
      ];
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=mis_datos.csv');
      return res.send('\uFEFF' + lines.join('\n'));
    }

    res.json(exportData);
  } catch (error) {
    console.error('Export data error:', error);
    res.status(500).json({ error: 'Error al exportar datos' });
  }
});

// Oppose data processing for a specific purpose (ARCOP - Oposición)
router.post('/me/oppose', authenticate, async (req, res) => {
  try {
    const { purpose, reason } = req.body;
    if (!purpose) {
      return res.status(400).json({ error: 'Debe indicar el propósito al que se opone' });
    }
    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({ error: 'Debe proporcionar una justificación (mínimo 5 caracteres)' });
    }

    // Cannot oppose essential processing
    if (purpose === 'essential') {
      return res.status(400).json({
        error: 'No puede oponerse al tratamiento esencial. Los datos esenciales son necesarios conforme a la Ley 19.418 para el funcionamiento de la plataforma.'
      });
    }

    const validPurposes = ['notifications_email', 'data_sharing_municipality'];
    if (!validPurposes.includes(purpose)) {
      return res.status(400).json({ error: 'Propósito no válido' });
    }

    const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';

    // Withdraw consent for the purpose
    await Consent.findOneAndUpdate(
      { userId: req.userId, purpose },
      { $set: { granted: false, withdrawnAt: new Date(), version: '1.0', ipAddress: clientIp } },
      { upsert: true }
    );

    // Audit log with opposition details
    await AuditLog.logAction({
      userId: req.userId,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userRole: req.user.role,
      action: 'OPPOSE',
      resource: 'USER',
      resourceId: req.userId,
      details: {
        type: 'arcop_opposition',
        purpose,
        reason: reason.trim(),
        result: 'accepted'
      },
      ipAddress: clientIp
    });

    res.json({
      message: 'Oposición registrada exitosamente. El tratamiento de datos para este propósito ha sido suspendido.',
      purpose,
      granted: false
    });
  } catch (error) {
    console.error('Oppose error:', error);
    res.status(500).json({ error: 'Error al registrar oposición' });
  }
});

// Get ARCOP request history
router.get('/me/arcop-history', authenticate, async (req, res) => {
  try {
    const history = await AuditLog.find({
      userId: req.userId,
      resource: 'USER',
      action: { $in: ['EXPORT', 'DELETE', 'OPPOSE', 'UPDATE'] },
      'details.type': { $in: ['personal_data_export', 'account_deletion_request', 'arcop_opposition', 'consent_update'] }
    })
    .sort({ timestamp: -1 })
    .limit(50)
    .select('action details timestamp ipAddress')
    .lean();

    const formatted = history.map(entry => ({
      action: entry.action,
      type: entry.details?.type || entry.action,
      details: entry.details,
      date: entry.timestamp,
      ip: entry.ipAddress
    }));

    res.json({ history: formatted });
  } catch (error) {
    console.error('ARCOP history error:', error);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

// Delete (anonymize) user account
router.delete('/me/account', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Don't allow admin account deletion through this endpoint
    if (user.role === 'MUNICIPALIDAD') {
      return res.status(403).json({ error: 'Las cuentas de administración no pueden eliminarse por esta vía' });
    }

    const reason = req.body?.reason || 'Solicitud del usuario';

    // Audit log before anonymization
    await AuditLog.logAction({
      userId: req.userId,
      userName: `${user.firstName} ${user.lastName}`,
      userRole: user.role,
      action: 'DELETE',
      resource: 'USER',
      resourceId: req.userId,
      details: { type: 'account_deletion_request', reason },
      ipAddress: req.ip
    });

    // Anonymize user data instead of hard delete
    user.firstName = 'Usuario';
    user.lastName = 'Eliminado';
    user.email = `deleted_${user._id}@removed.local`;
    user.rut = `00.000.000-0`;
    user.phone = '';
    user.address = '';
    user.region = '';
    user.commune = '';
    user.active = false;
    user.password = 'ACCOUNT_DELETED_' + Date.now();

    await user.save();

    // Remove consent records
    await Consent.deleteMany({ userId: req.userId });

    res.json({ message: 'Cuenta eliminada exitosamente. Tus datos han sido anonimizados.' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Error al eliminar cuenta' });
  }
});

// ============================================
// RUTAS CON /:id - DESPUÉS DE /me/*
// ============================================

// Get user by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    // Only self or admin can view
    if (req.params.id !== req.userId.toString() && req.user.role !== 'MUNICIPALIDAD') {
      return res.status(403).json({ error: 'No tienes permisos' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Log PII access when admin views another user
    if (req.params.id !== req.userId.toString()) {
      AuditLog.logAction({
        userId: req.userId,
        userName: `${req.user.firstName} ${req.user.lastName}`,
        userRole: req.user.role,
        action: 'ACCESS_PII',
        resource: 'USER',
        resourceId: user._id,
        resourceName: `${user.firstName} ${user.lastName}`,
        details: { type: 'view_user_detail' },
        ipAddress: req.ip
      });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
});

// Update user profile
router.put('/:id', authenticate, async (req, res) => {
  try {
    // Only self or admin can update
    if (req.params.id !== req.userId.toString() && req.user.role !== 'MUNICIPALIDAD') {
      return res.status(403).json({ error: 'No tienes permisos' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Don't allow changing role unless admin
    if (req.body.role && req.user.role !== 'MUNICIPALIDAD') {
      delete req.body.role;
    }

    // Don't update password through this endpoint
    delete req.body.password;

    Object.assign(user, req.body);
    await user.save();

    res.json(user);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// Toggle user active status (Admin only)
router.post('/:id/toggle-active', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    user.active = !user.active;
    await user.save();

    res.json(user);
  } catch (error) {
    console.error('Toggle active error:', error);
    res.status(500).json({ error: 'Error al cambiar estado' });
  }
});

// Delete user (Admin only)
router.delete('/:id', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const result = await User.deleteOne({ _id: req.params.id, role: 'ORGANIZADOR' });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

// Get statistics (Admin only)
router.get('/stats/counts', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const total = await User.countDocuments({ role: 'ORGANIZADOR' });
    const active = await User.countDocuments({ role: 'ORGANIZADOR', active: true });

    res.json({
      total,
      active,
      inactive: total - active
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// Get data processing registry (Admin only - Ley 21.719)
router.get('/stats/data-processing-registry', authenticate, requireRole('MUNICIPALIDAD'), async (req, res) => {
  try {
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const registry = require('../data/data-processing-registry.json');
    res.json(registry);
  } catch (error) {
    console.error('Get registry error:', error);
    res.status(500).json({ error: 'Error al obtener registro de tratamiento' });
  }
});

export default router;
