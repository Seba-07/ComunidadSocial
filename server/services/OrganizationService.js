/**
 * OrganizationService
 * Servicio para manejar organizaciones con soporte para ambos formatos:
 * - Formato embebido (v1): members[], electoralCommission[] con Base64 directamente
 * - Formato normalizado (v2): memberIds[], documentIds[] con referencias
 *
 * Este servicio abstrae la lógica de acceso a datos para que el resto
 * de la aplicación no necesite saber qué formato usa cada organización.
 */

import Organization from '../models/Organization.js';
import Member from '../models/Member.js';
import Document from '../models/Document.js';

/**
 * Obtiene una organización con sus miembros
 * Soporta ambos formatos (embebido y normalizado)
 *
 * @param {string} orgId - ID de la organización
 * @param {Object} options - Opciones de consulta
 * @param {boolean} options.includeSignatures - Incluir firmas Base64 (default: false)
 * @param {boolean} options.includeCertificates - Incluir certificados (default: false)
 * @returns {Object} Organización con miembros
 */
export async function getOrganizationWithMembers(orgId, options = {}) {
  const { includeSignatures = false, includeCertificates = false } = options;

  const org = await Organization.findById(orgId).lean();
  if (!org) return null;

  // Si está normalizada, obtener miembros de la colección Member
  if (org.isNormalized && org.memberIds?.length > 0) {
    const members = await Member.find({ _id: { $in: org.memberIds } }).lean();

    // Si se solicitan firmas/certificados, obtener documentos
    if (includeSignatures || includeCertificates) {
      const docQuery = { memberId: { $in: org.memberIds } };
      const docTypes = [];
      if (includeSignatures) docTypes.push('signature');
      if (includeCertificates) docTypes.push('certificate');
      docQuery.type = { $in: docTypes };

      const documents = await Document.find(docQuery).lean();

      // Mapear documentos a miembros
      const docsByMember = {};
      documents.forEach(doc => {
        if (!docsByMember[doc.memberId]) docsByMember[doc.memberId] = {};
        docsByMember[doc.memberId][doc.type] = doc.content;
      });

      // Agregar documentos a miembros
      members.forEach(m => {
        const memberDocs = docsByMember[m._id] || {};
        if (includeSignatures) m.signature = memberDocs.signature || null;
        if (includeCertificates) m.certificate = memberDocs.certificate || null;
      });
    }

    // Reemplazar members con los normalizados
    org.members = members;

    // Separar comisión electoral si existe
    org.electoralCommission = members.filter(m => m.isElectoralCommission);
  }

  return org;
}

/**
 * Obtiene los miembros de una organización
 * Soporta ambos formatos
 *
 * @param {string} orgId - ID de la organización
 * @param {Object} options - Opciones
 * @returns {Array} Lista de miembros
 */
export async function getOrganizationMembers(orgId, options = {}) {
  const org = await Organization.findById(orgId).select('isNormalized memberIds members').lean();
  if (!org) return [];

  if (org.isNormalized && org.memberIds?.length > 0) {
    return Member.find({ _id: { $in: org.memberIds } }).lean();
  }

  return org.members || [];
}

/**
 * Obtiene la comisión electoral de una organización
 *
 * @param {string} orgId - ID de la organización
 * @returns {Array} Lista de miembros de comisión electoral
 */
export async function getElectoralCommission(orgId) {
  const org = await Organization.findById(orgId)
    .select('isNormalized memberIds electoralCommission')
    .lean();

  if (!org) return [];

  if (org.isNormalized && org.memberIds?.length > 0) {
    return Member.find({
      _id: { $in: org.memberIds },
      isElectoralCommission: true
    }).lean();
  }

  return org.electoralCommission || [];
}

/**
 * Obtiene el directorio provisorio
 *
 * @param {string} orgId - ID de la organización
 * @returns {Object} Directorio provisorio
 */
export async function getProvisionalBoard(orgId) {
  const org = await Organization.findById(orgId)
    .select('isNormalized memberIds provisionalDirectorio')
    .lean();

  if (!org) return null;

  if (org.isNormalized && org.memberIds?.length > 0) {
    const boardMembers = await Member.find({
      _id: { $in: org.memberIds },
      isProvisionalBoard: true
    }).lean();

    // Reconstruir estructura de provisionalDirectorio
    const board = { president: null, secretary: null, treasurer: null };
    boardMembers.forEach(m => {
      if (m.provisionalRole === 'president') board.president = m;
      else if (m.provisionalRole === 'secretary') board.secretary = m;
      else if (m.provisionalRole === 'treasurer') board.treasurer = m;
    });

    return board;
  }

  return org.provisionalDirectorio || null;
}

/**
 * Obtiene una firma específica
 *
 * @param {string} orgId - ID de la organización
 * @param {string} signatureKey - Clave de la firma (ej: 'president', 'ministro')
 * @returns {string|null} Firma en Base64
 */
export async function getSignature(orgId, signatureKey) {
  const org = await Organization.findById(orgId)
    .select('isNormalized documentIds validationData ministroSignature')
    .lean();

  if (!org) return null;

  // Para firma del ministro
  if (signatureKey === 'ministro') {
    if (org.isNormalized && org.documentIds?.length > 0) {
      const doc = await Document.findOne({
        organizationId: orgId,
        type: 'ministro_signature'
      }).lean();
      return doc?.content || null;
    }
    return org.ministroSignature || org.validationData?.ministroSignature || null;
  }

  // Para otras firmas (del wizard de validación)
  if (org.isNormalized && org.documentIds?.length > 0) {
    const doc = await Document.findOne({
      organizationId: orgId,
      type: 'signature',
      originalPath: { $regex: signatureKey }
    }).lean();
    return doc?.content || null;
  }

  return org.validationData?.signatures?.[signatureKey] || null;
}

/**
 * Calcula el tamaño aproximado de documentos Base64 de una organización
 * Útil para monitorear el crecimiento de documentos
 *
 * @param {string} orgId - ID de la organización
 * @returns {Object} Estadísticas de tamaño
 */
export async function getOrganizationDocumentStats(orgId) {
  const org = await Organization.findById(orgId).lean();
  if (!org) return null;

  let totalSize = 0;
  let signatureCount = 0;
  let certificateCount = 0;

  if (org.isNormalized && org.documentIds?.length > 0) {
    // Contar desde colección Document
    const docs = await Document.find({
      _id: { $in: org.documentIds }
    }).select('type size').lean();

    docs.forEach(doc => {
      totalSize += doc.size || 0;
      if (doc.type === 'signature') signatureCount++;
      if (doc.type === 'certificate') certificateCount++;
    });
  } else {
    // Calcular desde formato embebido
    const calculateBase64Size = (str) => {
      if (!str || typeof str !== 'string') return 0;
      return Math.round((str.length * 3) / 4);
    };

    // Members
    (org.members || []).forEach(m => {
      if (m.signature) {
        totalSize += calculateBase64Size(m.signature);
        signatureCount++;
      }
      if (m.certificate) {
        totalSize += calculateBase64Size(m.certificate);
        certificateCount++;
      }
    });

    // Electoral Commission
    (org.electoralCommission || []).forEach(ec => {
      if (ec.signature) {
        totalSize += calculateBase64Size(ec.signature);
        signatureCount++;
      }
    });

    // Ministro signature
    if (org.ministroSignature) {
      totalSize += calculateBase64Size(org.ministroSignature);
      signatureCount++;
    }

    // Validation data signatures
    if (org.validationData?.signatures) {
      Object.values(org.validationData.signatures).forEach(sig => {
        if (sig && typeof sig === 'string') {
          totalSize += calculateBase64Size(sig);
          signatureCount++;
        }
      });
    }
  }

  return {
    totalSizeBytes: totalSize,
    totalSizeKB: Math.round(totalSize / 1024),
    totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
    signatureCount,
    certificateCount,
    documentCount: signatureCount + certificateCount,
    isNormalized: org.isNormalized || false,
    schemaVersion: org.schemaVersion || 1
  };
}

export default {
  getOrganizationWithMembers,
  getOrganizationMembers,
  getElectoralCommission,
  getProvisionalBoard,
  getSignature,
  getOrganizationDocumentStats
};
