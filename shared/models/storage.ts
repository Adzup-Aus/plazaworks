/**
 * S3-compatible storage request/response types.
 * Single object key format for all uploads (no entity-specific paths).
 */

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export interface UploadRequest {
  filename: string;
  contentType: string;
  size: number;
}

export interface PresignedUrlResponse {
  uploadUrl: string;
  objectPath: string;
  expiresAt: string;
}

export interface SignedUrlRequest {
  objectKey: string;
  expiresIn?: number;
}

export interface SignedUrlResponse {
  signedUrl: string;
  expiresAt: string;
}

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
