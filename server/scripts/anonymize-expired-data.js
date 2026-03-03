/**
 * Script de Anonimización de Datos Expirados (Ley 21.719)
 *
 * Ejecutar manualmente o como cron job:
 *   node server/scripts/anonymize-expired-data.js
 *   node server/scripts/anonymize-expired-data.js --dry-run
 *
 * Política de retención:
 * - Cuentas inactivas: 3 años sin login → anonimizar
 * - Organizaciones disueltas: 5 años → anonimizar datos personales de miembros
 * - Notificaciones: 90 días (ya con TTL en MongoDB)
 * - Audit logs: 365 días (ya con TTL en MongoDB)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DRY_RUN = process.argv.includes('--dry-run');

async function connectDB() {
  const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/comunidadsocial';
  await mongoose.connect(MONGO_URI);
  console.log(`Connected to MongoDB ${DRY_RUN ? '(DRY RUN)' : ''}`);
}

async function anonymizeInactiveAccounts() {
  const User = (await import('../models/User.js')).default;
  const Consent = (await import('../models/Consent.js')).default;
  const AuditLog = (await import('../models/AuditLog.js')).default;

  // 3 years without login (approximated by updatedAt since we don't track lastLogin yet)
  const threeYearsAgo = new Date();
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

  // Find inactive accounts (not logged in for 3+ years, not admin)
  const inactiveUsers = await User.find({
    updatedAt: { $lt: threeYearsAgo },
    role: { $nin: ['MUNICIPALIDAD'] },
    active: true, // Only active accounts (already anonymized ones have active: false)
    firstName: { $ne: 'Usuario' } // Skip already anonymized
  }).select('_id firstName lastName email rut role updatedAt');

  console.log(`\nInactive accounts (3+ years): ${inactiveUsers.length}`);

  for (const user of inactiveUsers) {
    console.log(`  - ${user.firstName} ${user.lastName} (${user.email}) - last activity: ${user.updatedAt.toISOString().split('T')[0]}`);

    if (!DRY_RUN) {
      user.firstName = 'Usuario';
      user.lastName = 'Inactivo';
      user.email = `inactive_${user._id}@removed.local`;
      user.rut = '00.000.000-0';
      user.phone = '';
      user.address = '';
      user.region = '';
      user.commune = '';
      user.active = false;
      user.password = 'ACCOUNT_EXPIRED_' + Date.now();
      await user.save();

      await Consent.deleteMany({ userId: user._id });

      await AuditLog.logAction({
        userId: user._id,
        userName: 'Sistema',
        userRole: 'SYSTEM',
        action: 'DELETE',
        resource: 'USER',
        resourceId: user._id,
        details: {
          type: 'auto_anonymization',
          reason: 'inactive_3_years',
          lastActivity: user.updatedAt
        }
      });
    }
  }

  return inactiveUsers.length;
}

async function anonymizeDissolvedOrgs() {
  const Organization = (await import('../models/Organization.js')).default;
  const AuditLog = (await import('../models/AuditLog.js')).default;

  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

  // Find orgs dissolved 5+ years ago that still have member data
  const dissolvedOrgs = await Organization.find({
    status: 'dissolved',
    updatedAt: { $lt: fiveYearsAgo },
    'members.0': { $exists: true } // Has at least one member
  }).select('_id organizationName members updatedAt');

  console.log(`\nDissolved organizations (5+ years): ${dissolvedOrgs.length}`);

  for (const org of dissolvedOrgs) {
    console.log(`  - ${org.organizationName} (${org.members.length} members) - dissolved: ${org.updatedAt.toISOString().split('T')[0]}`);

    if (!DRY_RUN) {
      // Anonymize member data but keep the structure
      org.members = org.members.map((m, i) => ({
        ...m.toObject ? m.toObject() : m,
        firstName: 'Miembro',
        lastName: `Anonimizado-${i + 1}`,
        rut: '00.000.000-0',
        email: '',
        phone: '',
        address: '',
        birthDate: null,
        signature: null,
        certificate: null
      }));

      // Anonymize directorio
      if (org.provisionalDirectorio) {
        const anonDir = (member, role) => {
          if (!member) return member;
          const obj = member.toObject ? member.toObject() : { ...member };
          return { ...obj, firstName: role, lastName: 'Anonimizado', rut: '00.000.000-0', email: '', phone: '' };
        };
        if (org.provisionalDirectorio.president) org.provisionalDirectorio.president = anonDir(org.provisionalDirectorio.president, 'Presidente');
        if (org.provisionalDirectorio.secretary) org.provisionalDirectorio.secretary = anonDir(org.provisionalDirectorio.secretary, 'Secretario');
        if (org.provisionalDirectorio.treasurer) org.provisionalDirectorio.treasurer = anonDir(org.provisionalDirectorio.treasurer, 'Tesorero');
      }

      await org.save();

      await AuditLog.logAction({
        userId: null,
        userName: 'Sistema',
        userRole: 'SYSTEM',
        action: 'DELETE',
        resource: 'ORGANIZATION',
        resourceId: org._id,
        resourceName: org.organizationName,
        details: {
          type: 'auto_anonymization',
          reason: 'dissolved_5_years',
          memberCount: org.members.length
        }
      });
    }
  }

  return dissolvedOrgs.length;
}

async function main() {
  try {
    await connectDB();

    console.log('=== Anonymize Expired Data ===');
    console.log(`Date: ${new Date().toISOString()}`);
    if (DRY_RUN) console.log('*** DRY RUN - No changes will be made ***');

    const inactiveCount = await anonymizeInactiveAccounts();
    const dissolvedCount = await anonymizeDissolvedOrgs();

    console.log('\n=== Summary ===');
    console.log(`Inactive accounts processed: ${inactiveCount}`);
    console.log(`Dissolved organizations processed: ${dissolvedCount}`);
    if (DRY_RUN) console.log('*** DRY RUN - No changes were made ***');

    await mongoose.disconnect();
    console.log('\nDone.');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
