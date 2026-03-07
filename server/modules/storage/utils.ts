import { randomUUID } from "crypto";
import { env } from "../../env";

/**
 * S3-style object key: single format for all uploads.
 * Pattern: uploads/{uuid}.{ext}
 */
export function buildObjectKey(filename: string): string {
  const ext = filename.includes(".")
    ? filename.split(".").pop()!.toLowerCase()
    : "bin";
  const safeExt = /^[a-z0-9]+$/i.test(ext) ? ext : "bin";
  const uuid = randomUUID();
  return `uploads/${uuid}.${safeExt}`;
}

/**
 * Build public URL when R2_PUBLIC_DOMAIN is set.
 */
export function buildPublicUrl(objectKey: string): string | null {
  const domain = env.R2_PUBLIC_DOMAIN;
  if (!domain) return null;
  const base = domain.startsWith("http") ? domain : `https://${domain}`;
  return `${base.replace(/\/$/, "")}/${objectKey}`;
}

/**
 * Resolve display URL: use objectKey with public domain if set, else stored url (legacy).
 */
export function getFileUrl(
  url: string | null | undefined,
  objectKey: string | null | undefined
): string {
  if (objectKey) {
    const publicUrl = buildPublicUrl(objectKey);
    if (publicUrl) return publicUrl;
  }
  return url || "";
}
