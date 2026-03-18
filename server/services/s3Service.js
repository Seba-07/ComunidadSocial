/**
 * S3 Service - Upload/download documents to AWS S3.
 * Replaces base64-in-MongoDB storage with S3 object storage.
 *
 * Required env vars: AWS_S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 * Optional: AWS_S3_KEY_PREFIX (isolates environments in shared bucket)
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import path from 'path';

const BUCKET = process.env.AWS_S3_BUCKET;
const REGION = process.env.AWS_REGION || 'us-east-1';
const KEY_PREFIX = process.env.AWS_S3_KEY_PREFIX || '';

let s3Client = null;

function getClient() {
  if (!s3Client) {
    if (!BUCKET) {
      throw new Error('AWS_S3_BUCKET not configured. S3 operations are disabled.');
    }
    s3Client = new S3Client({
      region: REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });
  }
  return s3Client;
}

/**
 * Check if S3 is configured and available.
 */
export function isS3Configured() {
  return !!(process.env.AWS_S3_BUCKET && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
}

/**
 * Derive file extension from MIME type or original filename.
 */
function getExtension(mimeType, fileName) {
  if (fileName) {
    const ext = path.extname(fileName).toLowerCase().replace('.', '');
    if (ext) return ext;
  }
  const map = {
    'application/pdf': 'pdf',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  };
  return map[mimeType] || 'bin';
}

/**
 * Build an S3 key with optional environment prefix.
 */
function buildKey(organizationId, type, fileName, mimeType) {
  const prefix = organizationId || 'misc';
  const base = KEY_PREFIX ? `${KEY_PREFIX}/${prefix}` : prefix;
  const hash = crypto.randomBytes(6).toString('hex');
  const ext = getExtension(mimeType, fileName);
  return `${base}/${type || 'document'}/${Date.now()}-${hash}.${ext}`;
}

/**
 * Upload a Buffer directly to S3 (preferred for multer uploads).
 * Files are stored PRIVATE (no public ACL).
 * @param {Buffer} buffer - File data
 * @param {string} mimeType - MIME type (e.g. 'application/pdf')
 * @param {Object} options - { organizationId, type, fileName }
 * @returns {{ s3Key: string, mimeType: string, size: number }}
 */
export async function uploadBuffer(buffer, mimeType, options = {}) {
  const client = getClient();
  const s3Key = buildKey(options.organizationId, options.type, options.fileName, mimeType);

  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    Body: buffer,
    ContentType: mimeType,
    Metadata: {
      organizationId: options.organizationId || '',
      type: options.type || '',
      originalName: options.fileName || ''
    }
  }));

  return { s3Key, mimeType, size: buffer.length };
}

/**
 * Upload a base64 string to S3 (legacy, used by storageService).
 * @param {string} base64Data - Base64 encoded data (with or without data: prefix)
 * @param {Object} options - { organizationId, type, memberId, fileName }
 * @returns {{ s3Key: string, mimeType: string, size: number }}
 */
export async function upload(base64Data, options = {}) {
  let cleanBase64 = base64Data;
  let mimeType = 'application/octet-stream';
  const dataMatch = base64Data.match(/^data:([^;]+);base64,(.+)$/);
  if (dataMatch) {
    mimeType = dataMatch[1];
    cleanBase64 = dataMatch[2];
  }

  const buffer = Buffer.from(cleanBase64, 'base64');
  return uploadBuffer(buffer, mimeType, options);
}

/**
 * Get a signed URL for temporary read access.
 * @param {string} s3Key - S3 object key
 * @param {number} expiresIn - Seconds until expiration (default 1 hour)
 * @param {Object} overrides - Optional overrides for Content-Disposition, Content-Type
 * @returns {string} Presigned URL
 */
export async function getPresignedUrl(s3Key, expiresIn = 3600, overrides = {}) {
  const client = getClient();
  const commandInput = { Bucket: BUCKET, Key: s3Key };

  if (overrides.contentDisposition) {
    commandInput.ResponseContentDisposition = overrides.contentDisposition;
  }
  if (overrides.contentType) {
    commandInput.ResponseContentType = overrides.contentType;
  }

  const command = new GetObjectCommand(commandInput);
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
