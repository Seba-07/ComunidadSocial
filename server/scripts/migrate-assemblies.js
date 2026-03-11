/**
 * Migration: Extract embedded assemblies[] from Organization to Assembly collection.
 *
 * Usage:
 *   node scripts/migrate-assemblies.js [--dry-run] [--org-id=xxx]
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Organization from '../models/Organization.js';
import Assembly from '../models/Assembly.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/comunidad_social_dev';
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const orgIdArg = args.find(a => a.startsWith('--org-id='));
const SPECIFIC_ORG_ID = orgIdArg ? orgIdArg.split('=')[1] : null;

const stats = { processed: 0, assembliesMigrated: 0, orgsProcessed: 0, errors: 0 };

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log(`Connected. Mode: ${isDryRun ? 'DRY-RUN' : 'PRODUCTION'}`);

  const query = { 'assemblies.0': { $exists: true } };
  if (SPECIFIC_ORG_ID) query._id = SPECIFIC_ORG_ID;

  const cursor = Organization.find(query).cursor();

  for await (const org of cursor) {
    stats.processed++;
    const orgName = org.organizationName || org._id;

    try {
      for (const embedded of org.assemblies) {
        // Check if already migrated (by legacyId)
        const exists = await Assembly.findOne({
          organizationId: org._id,
          legacyId: embedded.id
        });
        if (exists) continue;

        const assemblyData = {
          organizationId: org._id,
          legacyId: embedded.id,
          type: embedded.type,
          date: embedded.date,
          time: embedded.time,
          title: embedded.title,
          description: embedded.description,
          status: embedded.status,
          quorumType: embedded.quorumType,
          quorumValue: embedded.quorumValue,
          agendaItems: embedded.agendaItems,
          attendance: embedded.attendance,
          attendees: embedded.attendees,
          convokedAt: embedded.convokedAt,
          startedAt: embedded.startedAt,
          finishedAt: embedded.finishedAt,
          createdAt: embedded.createdAt
        };

        if (!isDryRun) {
          await Assembly.create(assemblyData);
        }
        stats.assembliesMigrated++;
        console.log(`  [${isDryRun ? 'DRY' : 'OK'}] ${orgName} -> ${embedded.title || embedded.id}`);
      }
      stats.orgsProcessed++;
    } catch (error) {
      console.error(`  ERROR ${orgName}:`, error.message);
      stats.errors++;
    }
  }

  console.log('\n--- Stats ---');
  console.log(`Orgs processed: ${stats.orgsProcessed}`);
  console.log(`Assemblies migrated: ${stats.assembliesMigrated}`);
  console.log(`Errors: ${stats.errors}`);
  if (isDryRun) console.log('(DRY-RUN - no changes made)');

  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
