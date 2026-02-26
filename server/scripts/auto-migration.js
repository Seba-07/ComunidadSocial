/**
 * Auto-migration system - Idempotent migrations that run on server startup.
 * Each migration runs only once and is tracked in MigrationLog.
 * Uses targeted queries + cursors to avoid loading all docs in RAM.
 */

import Organization from '../models/Organization.js';
import MigrationLog from '../models/MigrationLog.js';

/**
 * Run a named migration only if it hasn't been executed before.
 * @param {string} name - Unique migration name
 * @param {Function} fn - Async function that performs the migration, returns docsAffected count
 */
async function runMigration(name, fn) {
  const existing = await MigrationLog.findOne({ name });
  if (existing) return;

  console.log(`[migration] Running: ${name}`);
  try {
    const docsAffected = await fn();
    await MigrationLog.create({ name, docsAffected, status: 'success' });
    if (docsAffected > 0) {
      console.log(`[migration] ${name}: ${docsAffected} docs affected`);
    } else {
      console.log(`[migration] ${name}: no docs needed migration`);
    }
  } catch (error) {
    console.error(`[migration] ${name} failed:`, error.message);
    await MigrationLog.create({ name, status: 'failed', error: error.message });
  }
}

/**
 * Migration: Populate provisionalDirectorio from member roles.
 * Only targets orgs that have members with roles but empty provisionalDirectorio.
 */
async function migrateProvisionalDirectorio() {
  let count = 0;
  const cursor = Organization.find({
    'members.0': { $exists: true },
    $or: [
      { 'provisionalDirectorio.president': null },
      { 'provisionalDirectorio.president': { $exists: false } }
    ],
    'members.role': { $in: ['president', 'secretary', 'treasurer'] }
  }).cursor();

  for await (const org of cursor) {
    const president = org.members.find(m => m.role === 'president');
    const secretary = org.members.find(m => m.role === 'secretary');
    const treasurer = org.members.find(m => m.role === 'treasurer');

    if (president || secretary || treasurer) {
      const toMember = (m) => m ? { rut: m.rut, firstName: m.firstName, lastName: m.lastName } : null;
      org.provisionalDirectorio = {
        president: toMember(president),
        secretary: toMember(secretary),
        treasurer: toMember(treasurer),
        designatedAt: new Date(),
        type: 'PROVISIONAL'
      };
      await org.save();
      count++;
    }
  }
  return count;
}

/**
 * Migration: Populate electoralCommission from member roles.
 * Only targets orgs with empty electoralCommission that have members.
 */
async function migrateElectoralCommission() {
  let count = 0;
  const cursor = Organization.find({
    'members.0': { $exists: true },
    $or: [
      { electoralCommission: { $size: 0 } },
      { electoralCommission: { $exists: false } }
    ]
  }).cursor();

  for await (const org of cursor) {
    let commissionMembers = org.members.filter(m => m.role === 'electoral_commission');

    if (commissionMembers.length === 0) {
      const usedRuts = new Set();
      if (org.provisionalDirectorio?.president?.rut) usedRuts.add(org.provisionalDirectorio.president.rut);
      if (org.provisionalDirectorio?.secretary?.rut) usedRuts.add(org.provisionalDirectorio.secretary.rut);
      if (org.provisionalDirectorio?.treasurer?.rut) usedRuts.add(org.provisionalDirectorio.treasurer.rut);

      commissionMembers = org.members.filter(m =>
        !usedRuts.has(m.rut) &&
        ['director', 'member', 'electoral_commission'].includes(m.role)
      ).slice(0, 3);
    }

    if (commissionMembers.length > 0) {
      org.electoralCommission = commissionMembers.map(m => ({
        rut: m.rut,
        firstName: m.firstName,
        lastName: m.lastName,
        role: 'electoral_commission'
      }));
      await org.save();
      count++;
    }
  }
  return count;
}

/**
 * Migration: Sync member roles with provisionalDirectorio.
 * Only targets orgs where directorio members still have role='member'.
 */
async function syncMemberRolesWithDirectorio() {
  let count = 0;
  const normalizeRut = (rut) => (rut || '').replace(/\./g, '').replace(/-/g, '').toUpperCase();

  const cursor = Organization.find({
    'provisionalDirectorio.president': { $ne: null },
    'members.0': { $exists: true }
  }).cursor();

  for await (const org of cursor) {
    const prov = org.provisionalDirectorio;
    if (!prov) continue;

    const dirRoles = ['president', 'secretary', 'treasurer', 'director'];
    let needsSync = false;

    const checkRut = (rut) => {
      if (!rut) return;
      const clean = normalizeRut(rut);
      const member = org.members.find(m => normalizeRut(m.rut) === clean);
      if (member && !dirRoles.includes(member.role)) needsSync = true;
    };

    if (prov.president) checkRut(prov.president.rut);
    if (prov.secretary) checkRut(prov.secretary.rut);
    if (prov.treasurer) checkRut(prov.treasurer.rut);
    if (prov.additionalMembers) prov.additionalMembers.forEach(m => { if (m) checkRut(m.rut); });

    if (needsSync) {
      org.members.forEach(m => { if (dirRoles.includes(m.role)) m.role = 'member'; });

      const assignRole = (rut, role) => {
        if (!rut) return;
        const clean = normalizeRut(rut);
        const member = org.members.find(m => normalizeRut(m.rut) === clean);
        if (member) member.role = role;
      };

      if (prov.president) assignRole(prov.president.rut, 'president');
      if (prov.secretary) assignRole(prov.secretary.rut, 'secretary');
      if (prov.treasurer) assignRole(prov.treasurer.rut, 'treasurer');
      if (prov.additionalMembers) prov.additionalMembers.forEach(m => { if (m) assignRole(m.rut, 'director'); });

      await org.save();
      count++;
    }
  }
  return count;
}

/**
 * Run all auto-migrations on startup.
 */
export async function autoMigrateOrganizations() {
  await runMigration('001_populate_provisional_directorio', migrateProvisionalDirectorio);
  await runMigration('002_populate_electoral_commission', migrateElectoralCommission);
  await runMigration('003_sync_member_roles_with_directorio', syncMemberRolesWithDirectorio);
}
