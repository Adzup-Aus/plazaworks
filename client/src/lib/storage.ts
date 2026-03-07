/**
 * S3-style storage URL helpers. Single object key format: uploads/{uuid}.{ext}
 */

export function isObjectKey(path: string | null | undefined): boolean {
  if (!path || typeof path !== "string") return false;
  return path.startsWith("uploads/") && !path.startsWith("http");
}

export function buildStoragePublicUrl(objectKey: string, publicBaseUrl?: string): string | null {
  if (!objectKey || !publicBaseUrl) return null;
  const base = publicBaseUrl.startsWith("http") ? publicBaseUrl : `https://${publicBaseUrl}`;
  return `${base.replace(/\/$/, "")}/${objectKey}`;
}

export function resolveStorageUrl(
  url: string | null | undefined,
  objectKey: string | null | undefined,
  publicBaseUrl?: string
): string {
  if (objectKey && publicBaseUrl) {
    const publicUrl = buildStoragePublicUrl(objectKey, publicBaseUrl);
    if (publicUrl) return publicUrl;
  }
  return url || "";
}
