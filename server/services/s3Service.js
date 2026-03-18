/**
 * S3 Service - Upload/download documents to AWS S3.
 * Replaces base64-in-MongoDB storage with S3 object storage.
 *
 * Required env vars: AWS_S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

const BUCKET = process.env.AWS_S3_BUCKET;
const REGION = process.env.AWS_REGION || 'us-east-1';
const KEY_PREFIX = process.env.AWS_S3_KEY_PREFIX || '';

let s3Client = null;

function getClient() {
  if (!s3Client) {
    if (!BUCKET) {
      throw new Error('AWS_S3_BUCKET not configured. S3 operations are disabled.');
    }
    s3Client = new S3Client({ region: REGION });
  }
  return s3Client;
}

/**
 * Check if S3 is configured and available.
 */
export function isS3Configured() {
  return !!process.env.AWS_S3_BUCKET;
}

/**
 * Upload a base64 string to S3.
 * @param {string} base64Data - Base64 encoded data (with or without data: prefix)
 * @param {Object} options - { organizationId, type, memberId, fileName }
 * @returns {{ s3Key: string, url: string }} S3 key and public URL
 */
export async function upload(base64Data, options = {}) {
  const client = getClient();

  // Strip data: prefix if present
  let cleanBase64 = base64Data;
  let mimeType = 'image/png';
  const dataMatch = base64Data.match(/^data:([^;]+);base64,(.+)$/);
  if (dataMatch) {
    mimeType = dataMatch[1];
    cleanBase64 = dataMatch[2];
  }

  const buffer = Buffer.from(cleanBase64, 'base64');
  const hash = crypto.createHash('md5').update(buffer).digest('hex').slice(0, 8);
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('jpeg') ? 'jpg' : 'bin';
  const prefix = options.organizationId || 'misc';
  const base = KEY_PREFIX ? `${KEY_PREFIX}/${prefix}` : prefix;
  const s3Key = `${base}/${options.type || 'document'}/${hash}-${options.memberId || Date.now()}.${ext}`;

  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    Body: buffer,
    ContentType: mimeType,
    Metadata: {
      organizationId: options.organizationId || '',
      type: options.type || '',
      memberId: options.memberId || ''
    }
  }));

  return { s3Key, mimeType, size: buffer.length };
}

/**
 * Get a signed URL for temporary read access (default 1 hour).
 */
export async function getPresignedUrl(s3Key, expiresIn = 3600) {
  const client = getClient();
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: s3Key });
  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Delete an object from S3.
 */
export async function deleteObject(s3Key) {
  const client = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: s3Key }));
}

/**
 * Migrate a single base64 document to S3.
 * Returns the s3Key or null if S3 is not configured.
 */
export async function migrateDocument(base64Data, options = {}) {
  if (!isS3Configured()) return null;
  if (!base64Data || base64Data.length < 100) return null;

  try {
    const result = await upload(base64Data, options);
    return result.s3Key;
  } catch (error) {
    console.error(`[s3] Migration failed for ${options.type}:`, error.message);
    return null;
  }
}
