/**
 * Unified Storage Service
 * Handles file storage with S3 (preferred) or base64 fallback.
 *
 * When S3 is configured: saves to S3, stores s3Key in MongoDB.
 * When S3 is NOT configured: saves base64 directly in MongoDB (legacy behavior).
 */

let s3Service = null;

try {
  s3Service = await import('./s3Service.js');
} catch {
  // AWS SDK not installed - S3 disabled
}

export function isS3Configured() {
  return s3Service?.isS3Configured?.() ?? false;
}

/**
 * Store a base64 image/document.
 * @param {string} base64Data - Base64 string (with or without data: prefix)
 * @param {Object} options - { organizationId, type, memberId }
 * @returns {{ stored: 's3'|'base64', s3Key?: string, data?: string }}
 */
export async function storeDocument(base64Data, options = {}) {
  if (!base64Data) return null;

  if (isS3Configured()) {
    try {
      const result = await s3Service.upload(base64Data, options);
      return { stored: 's3', s3Key: result.s3Key, mimeType: result.mimeType, size: result.size };
    } catch (err) {
      console.warn('[storage] S3 upload failed, falling back to base64:', err.message);
    }
  }

  // Fallback: return base64 as-is
  return { stored: 'base64', data: base64Data };
}

/**
 * Retrieve a document URL or base64 data.
 * @param {{ s3Key?: string, data?: string }} ref - Storage reference
 * @returns {string} Presigned URL or base64 data
 */
export async function getDocumentUrl(ref) {
  if (!ref) return null;

  if (ref.s3Key && isS3Configured()) {
    try {
      return await s3Service.getPresignedUrl(ref.s3Key);
    } catch (err) {
      console.warn('[storage] Failed to get presigned URL:', err.message);
    }
  }

  // Return base64 data directly
  return ref.data || null;
}

/**
 * Delete a stored document.
 * @param {{ s3Key?: string }} ref - Storage reference
 */
export async function deleteDocument(ref) {
  if (ref?.s3Key && isS3Configured()) {
    try {
      await s3Service.deleteObject(ref.s3Key);
    } catch (err) {
      console.warn('[storage] Failed to delete from S3:', err.message);
    }
  }
}

/**
 * Store a multer-uploaded file (Buffer) to S3.
 * Falls back to returning the buffer as base64 if S3 is not configured.
 * @param {Buffer} buffer - File buffer from multer
 * @param {string} mimeType - MIME type
 * @param {Object} options - { organizationId, type, fileName }
 * @returns {{ stored: 's3'|'local', s3Key?: string, data?: string }}
 */
export async function storeFile(buffer, mimeType, options = {}) {
  if (isS3Configured()) {
    try {
      const base64 = `data:${mimeType};base64,${buffer.toString('base64')}`;
      const result = await s3Service.upload(base64, options);
      return { stored: 's3', s3Key: result.s3Key, mimeType: result.mimeType, size: result.size };
    } catch (err) {
      console.warn('[storage] S3 file upload failed:', err.message);
    }
  }

  // Fallback: return as base64
  return { stored: 'base64', data: `data:${mimeType};base64,${buffer.toString('base64')}` };
}
