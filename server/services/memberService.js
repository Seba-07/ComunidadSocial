/**
 * Member Service - Abstraction layer for reading members.
 * Reads from normalized Member collection or embedded Organization.members[]
 * depending on org.isNormalized flag.
 */

import Member from '../models/Member.js';

/**
 * Get all members for an organization.
 * @param {Object} org - Organization document
 * @returns {Array} Array of member objects
 */
export async function getOrganizationMembers(org) {
  if (org.isNormalized && org.memberIds?.length > 0) {
    return Member.find({ organizationId: org._id, isActive: true }).lean();
  }
  return org.members || [];
}

/**
 * Find a member by RUT within an organization.
 */
export async function findMemberByRut(org, rut) {
  const normalizeRut = (r) => (r || '').replace(/\./g, '').replace(/-/g, '').toUpperCase();
  const cleanRut = normalizeRut(rut);

  if (org.isNormalized && org.memberIds?.length > 0) {
    const members = await Member.find({ organizationId: org._id }).lean();
    return members.find(m => normalizeRut(m.rut) === cleanRut) || null;
  }
  return (org.members || []).find(m => normalizeRut(m.rut) === cleanRut) || null;
}

/**
 * Get electoral commission members.
 */
export async function getElectoralCommission(org) {
  if (org.isNormalized && org.memberIds?.length > 0) {
    return Member.find({
      organizationId: org._id,
      isElectoralCommission: true,
      isActive: true
    }).lean();
  }
  return org.electoralCommission || [];
}

/**
 * Get provisional board members.
 */
export async function getProvisionalBoard(org) {
  if (org.isNormalized && org.memberIds?.length > 0) {
    return Member.find({
      organizationId: org._id,
      isProvisionalBoard: true,
      isActive: true
    }).lean();
  }
  // Build from provisionalDirectorio
  const prov = org.provisionalDirectorio;
  if (!prov) return [];
  const board = [];
  if (prov.president) board.push({ ...prov.president, role: 'president' });
  if (prov.secretary) board.push({ ...prov.secretary, role: 'secretary' });
  if (prov.treasurer) board.push({ ...prov.treasurer, role: 'treasurer' });
  if (prov.additionalMembers) {
    prov.additionalMembers.forEach(m => {
      if (m) board.push({ ...m, role: 'director' });
    });
  }
  return board;
}
