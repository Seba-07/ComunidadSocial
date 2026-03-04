/**
 * Assembly Service - Abstraction layer for reading/writing assemblies.
 * Supports both embedded (Organization.assemblies[]) and normalized (Assembly collection) modes.
 * Controlled by USE_NORMALIZED_ASSEMBLIES env var.
 *
 * Dual-write operations use MongoDB transactions to guarantee atomicity.
 */

import Assembly from '../models/Assembly.js';
import { withTransactionFallback } from '../utils/withTransaction.js';

const USE_NORMALIZED = () => process.env.USE_NORMALIZED_ASSEMBLIES === 'true';

/**
 * Get all assemblies for an organization.
 */
export async function getAssemblies(org) {
  if (USE_NORMALIZED()) {
    const assemblies = await Assembly.find({ organizationId: org._id }).sort({ createdAt: -1 }).lean();
    // Map _id to id for frontend compat
    return assemblies.map(a => ({ ...a, id: a.legacyId || a._id.toString() }));
  }
  return org.assemblies || [];
}

/**
 * Find a single assembly by its id (legacyId or embedded id).
 */
export async function findAssembly(org, assemblyId) {
  if (USE_NORMALIZED()) {
    const assembly = await Assembly.findOne({
      organizationId: org._id,
      $or: [{ legacyId: assemblyId }, { _id: assemblyId }]
    });
    return assembly;
  }
  return (org.assemblies || []).find(a => a.id === assemblyId) || null;
}

/**
 * Create a new assembly.
 * Dual-writes to both normalized collection and embedded array within a transaction.
 */
export async function createAssembly(org, data) {
  const legacyId = 'assembly_' + Date.now();
  const assemblyData = {
    id: legacyId,
    type: data.type || 'ordinaria',
    date: data.date,
    time: data.time,
    title: data.title,
    description: data.description,
    status: 'draft',
    quorumType: data.quorumType || 'percentage',
    quorumValue: data.quorumValue || 50,
    agendaItems: (data.agendaItems || []).map((item, i) => ({
      id: `agenda_${Date.now()}_${i}`,
      title: item.title,
      type: item.type || 'custom',
      description: item.description || '',
      votingMode: item.votingMode || null,
      candidates: [],
      votes: [],
      voterRegistry: [],
      anonymousVotes: [],
      votingOpen: false
    })),
    attendance: 0,
    attendees: [],
    createdAt: new Date()
  };

  if (USE_NORMALIZED()) {
    await withTransactionFallback(async (session) => {
      const opts = session ? { session } : {};
      if (!org.assemblies) org.assemblies = [];
      org.assemblies.push(assemblyData);
      await org.save(opts);
      await Assembly.create([{
        organizationId: org._id,
        legacyId,
        ...assemblyData
      }], opts);
    });
  } else {
    if (!org.assemblies) org.assemblies = [];
    org.assemblies.push(assemblyData);
    await org.save();
  }

  return assemblyData;
}

/**
 * Update an assembly. Returns the updated assembly or null.
 */
export async function updateAssembly(org, assemblyId, updates) {
  if (USE_NORMALIZED()) {
    const assembly = await Assembly.findOne({
      organizationId: org._id,
      $or: [{ legacyId: assemblyId }, { _id: assemblyId }]
    });
    if (!assembly) return null;
    if (assembly.status === 'finalizada' || assembly.status === 'cancelada') {
      throw new Error('No se puede editar una asamblea finalizada o cancelada');
    }
    Object.assign(assembly, updates);

    await withTransactionFallback(async (session) => {
      const opts = session ? { session } : {};
      await assembly.save(opts);
      syncToEmbedded(org, assembly.legacyId || assemblyId, updates);
      await org.save(opts);
    });

    return assembly;
  }

  const idx = (org.assemblies || []).findIndex(a => a.id === assemblyId);
  if (idx === -1) return null;
  const assembly = org.assemblies[idx];
  if (assembly.status === 'finalizada' || assembly.status === 'cancelada') {
    throw new Error('No se puede editar una asamblea finalizada o cancelada');
  }
  Object.assign(assembly, updates);
  await org.save();
  return assembly;
}

/**
 * Delete an assembly.
 */
export async function deleteAssembly(org, assemblyId) {
  if (USE_NORMALIZED()) {
    const assembly = await Assembly.findOne({
      organizationId: org._id,
      $or: [{ legacyId: assemblyId }, { _id: assemblyId }]
    });
    if (!assembly) return null;
    if (!['draft', 'convocada'].includes(assembly.status)) {
      throw new Error('Solo se pueden eliminar asambleas en estado borrador o convocada');
    }

    await withTransactionFallback(async (session) => {
      const opts = session ? { session } : {};
      await Assembly.deleteOne({ _id: assembly._id }, opts);
      const idx = (org.assemblies || []).findIndex(a => a.id === assemblyId);
      if (idx !== -1) {
        org.assemblies.splice(idx, 1);
      }
      await org.save(opts);
    });

    return true;
  }

  // Embedded-only mode
  const idx = (org.assemblies || []).findIndex(a => a.id === assemblyId);
  if (idx === -1) return null;
  const assembly = org.assemblies[idx];
  if (!['draft', 'convocada'].includes(assembly.status)) {
    throw new Error('Solo se pueden eliminar asambleas en estado borrador o convocada');
  }
  org.assemblies.splice(idx, 1);
  await org.save();
  return true;
}

/**
 * Save changes to an assembly (for mutations like votes, status changes).
 * Handles dual-write within a transaction.
 */
export async function saveAssembly(org, assembly) {
  if (USE_NORMALIZED() && assembly.save) {
    await withTransactionFallback(async (session) => {
      const opts = session ? { session } : {};
      await assembly.save(opts);
      // Sync key fields back to embedded
      const legacyId = assembly.legacyId || assembly.id;
      const idx = (org.assemblies || []).findIndex(a => a.id === legacyId);
      if (idx !== -1) {
        org.assemblies[idx] = assembly.toObject();
        org.assemblies[idx].id = legacyId;
      }
      await org.save(opts);
    });
  } else {
    await org.save();
  }
}

/**
 * Sync specific updates back to the embedded array.
 */
function syncToEmbedded(org, legacyId, updates) {
  const idx = (org.assemblies || []).findIndex(a => a.id === legacyId);
  if (idx !== -1) {
    for (const [key, value] of Object.entries(updates)) {
      org.assemblies[idx][key] = value;
    }
  }
}
