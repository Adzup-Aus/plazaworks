import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client, getR2Bucket } from "./r2-client";
import { buildObjectKey, getFileUrl } from "./utils";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  type PresignedUrlResponse,
} from "@shared/models/storage";
import { isR2Configured } from "../../env";

const PRESIGNED_EXPIRES_SEC = 900;

function validateUploadRequest(params: {
  filename: string;
  contentType: string;
  size: number;
}): { ok: true } | { ok: false; error: string } {
  const { filename, contentType, size } = params;
  if (!filename || typeof filename !== "string") {
    return { ok: false, error: "Missing or invalid filename" };
  }
  if (filename.length > 255) {
    return { ok: false, error: "Filename too long" };
  }
  if (!contentType || !ALLOWED_MIME_TYPES.includes(contentType as any)) {
    return { ok: false, error: "Invalid file type" };
  }
  if (typeof size !== "number" || size <= 0 || size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: "File exceeds 10MB limit" };
  }
  return { ok: true };
}

/**
 * Generate presigned PUT URL using S3-style single key format (uploads/{uuid}.{ext}).
 */
export async function generatePresignedUploadUrl(params: {
  filename: string;
  contentType: string;
  size: number;
}): Promise<PresignedUrlResponse | null> {
  if (!isR2Configured()) return null;
  const client = getR2Client();
  const bucket = getR2Bucket();
  if (!client || !bucket) return null;

  const key = buildObjectKey(params.filename);
  const expiresAt = new Date(Date.now() + PRESIGNED_EXPIRES_SEC * 1000);
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: params.contentType,
    ContentLength: params.size,
  });
  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: PRESIGNED_EXPIRES_SEC,
  });
  return {
    uploadUrl,
    objectPath: key,
    expiresAt: expiresAt.toISOString(),
  };
}

export function validateUploadRequestBody(body: unknown): { error: string } | null {
  if (!body || typeof body !== "object") return { error: "Invalid request body" };
  const b = body as Record<string, unknown>;
  const filename = (b.filename ?? b.name) as string | undefined;
  const contentType = (b.contentType ?? b.content_type) as string | undefined;
  const size = typeof b.size === "number" ? b.size : Number(b.size);
  const result = validateUploadRequest({
    filename: filename ?? "",
    contentType: contentType ?? "",
    size: Number.isNaN(size) ? 0 : size,
  });
  return result.ok ? null : { error: result.error };
}

const DEFAULT_SIGNED_URL_EXPIRES = 3600;
const MAX_SIGNED_URL_EXPIRES = 86400;

/**
 * Generate signed GET URL for an S3 object key (the S3 link R2 provides).
 */
export async function generateSignedUrl(
  objectKey: string,
  expiresIn: number = DEFAULT_SIGNED_URL_EXPIRES
): Promise<{ signedUrl: string; expiresAt: string } | null> {
  if (!isR2Configured()) return null;
  const client = getR2Client();
  const bucket = getR2Bucket();
  if (!client || !bucket) return null;
  const sec = Math.min(Math.max(expiresIn, 60), MAX_SIGNED_URL_EXPIRES);
  const command = new GetObjectCommand({ Bucket: bucket, Key: objectKey });
  const signedUrl = await getSignedUrl(client, command, { expiresIn: sec });
  const expiresAt = new Date(Date.now() + sec * 1000).toISOString();
  return { signedUrl, expiresAt };
}

/** Default expiry for display URLs (1 hour) */
const DISPLAY_URL_EXPIRES = 3600;

/**
 * Resolve display URL for authenticated access: use R2's S3 signed URL when we have objectKey.
 * Falls back to public URL (if domain set) or stored url.
 */
export async function resolveDisplayUrl(
  url: string | null | undefined,
  objectKey: string | null | undefined
): Promise<string> {
  if (objectKey && isR2Configured()) {
    const signed = await generateSignedUrl(objectKey, DISPLAY_URL_EXPIRES);
    if (signed) return signed.signedUrl;
  }
  return getFileUrl(url, objectKey) || url || "";
}

/**
 * Resolve display URLs for a list of items with url and objectKey. Uses R2 S3 signed links when available.
 */
export async function resolveDisplayUrls<
  T extends { url?: string | null; objectKey?: string | null }
>(items: T[]): Promise<T[]> {
  const resolved = await Promise.all(
    items.map(async (item) => {
      const url = await resolveDisplayUrl(item.url, item.objectKey);
      return { ...item, url };
    })
  );
  return resolved;
}
