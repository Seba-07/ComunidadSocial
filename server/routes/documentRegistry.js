import express from 'express';
import DocumentRegistry, { DOCUMENT_TYPE_LABELS } from '../models/DocumentRegistry.js';
import Organization from '../models/Organization.js';

const router = express.Router();

/**
 * GET /api/documents/verify/:folio
 * Endpoint PÚBLICO — verifica autenticidad de un documento por folio
 */
router.get('/verify/:folio', async (req, res) => {
  try {
    const { folio } = req.params;

    if (!folio || folio.length < 8) {
      return res.status(400).json({ error: 'Folio inválido' });
    }

    const record = await DocumentRegistry.findOne({ folio }).lean();

    if (!record) {
      return res.status(404).json({
        valid: false,
        error: 'Documento no encontrado. Verifique el folio ingresado.'
      });
    }

    if (record.status === 'REVOKED') {
      return res.json({
        valid: false,
        status: 'REVOKED',
        folio: record.folio,
        revokedAt: record.revokedAt,
        revokedReason: record.revokedReason,
        message: 'Este documento ha sido revocado y ya no tiene validez.'
      });
    }

    // Fetch org name
    const org = await Organization.findById(record.organizationId)
      .select('organizationName organizationType comuna')
      .lean();

    res.json({
      valid: true,
      status: 'VALID',
      folio: record.folio,
      documentType: record.documentType,
      documentTypeLabel: DOCUMENT_TYPE_LABELS[record.documentType] || record.documentType,
      documentTitle: record.documentTitle,
      issueDate: record.issueDate,
      organization: org ? {
        name: org.organizationName,
        type: org.organizationType,
        comuna: org.comuna
      } : null,
      fileHash: record.fileHash || null
    });
  } catch (error) {
    console.error('Error verifying document:', error);
    res.status(500).json({ error: 'Error al verificar documento' });
  }
});

export default router;
