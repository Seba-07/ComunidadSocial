/**
 * Migration: Move base64 content from Document collection to AWS S3.
 * Processes in batches of 50 to avoid memory issues.
 *
 * Usage:
 *   node scripts/migrate-base64-to-s3.js [--dry-run] [--batch-size=50]
 *
 * Required env vars: AWS_S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Document from '../models/Document.js';
import { upload, isS3Configured } from '../services/s3Service.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/comunidad_social';
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const batchArg = args.find(a => a.startsWith('--batch-size='));
const BATCH_SIZE = batchArg ? parseInt(batchArg.split('=')[1]) : 50;

const stats = { processed: 0, migrated: 0, skipped: 0, errors: 0, bytesFreed: 0 };

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log(`Connected. Mode: ${isDryRun ? 'DRY-RUN' : 'PRODUCTION'}`);

  if (!isS3Configured()) {
    console.error('AWS_S3_BUCKET not configured. Aborting.');
    process.exit(1);
  }

  const total = await Document.countDocuments({
    storageType: { $ne: 's3' },
    content: { $exists: true, $ne: '' }
  });
  console.log(`Documents to migrate: ${total}\n`);

  let skip = 0;
  while (skip < total) {
    const batch = await Document.find({
      storageType: { $ne: 's3' },
      content: { $exists: true, $ne: '' }
    }).limit(BATCH_SIZE).skip(skip);

    if (batch.length === 0) break;

    for (const doc of batch) {
      stats.processed++;
      try {
        if (!doc.content || doc.content.length < 100) {
          stats.skipped++;
          continue;
        }

        const contentSize = doc.content.length;

        if (!isDryRun) {
          const result = await upload(doc.content, {
            organizationId: doc.organizationId?.toString(),
            type: doc.type,
            memberId: doc.memberId?.toString()
          });

          doc.s3Key = result.s3Key;
          doc.storageType = 's3';
          doc.content = ''; // Free the base64 content
          await doc.save();
        }

        stats.migrated++;
        stats.bytesFreed += contentSize;
        if (stats.migrated % 10 === 0) {
          console.log(`  Progress: ${stats.migrated}/${total} (${(stats.bytesFreed / 1024 / 1024).toFixed(1)}MB freed)`);
        }
      } catch (error) {
        console.error(`  ERROR doc ${doc._id}:`, error.message);
        stats.errors++;
      }
    }
    skip += batch.length;
  }

  console.log('\n--- Stats ---');
  console.log(`Processed: ${stats.processed}`);
  console.log(`Migrated: ${stats.migrated}`);
  console.log(`Skipped: ${stats.skipped}`);
  console.log(`Errors: ${stats.errors}`);
  console.log(`Space freed: ${(stats.bytesFreed / 1024 / 1024).toFixed(2)}MB`);
  if (isDryRun) console.log('(DRY-RUN - no changes made)');

  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
