import type { Express } from "express";
import { isAuthenticated } from "../../routes/shared";
import {
  generatePresignedUploadUrl,
  generateSignedUrl,
  validateUploadRequestBody,
} from "./service";
import { isR2Configured } from "../../env";

async function getReplitFallbackUploadUrl(): Promise<{
  uploadURL: string;
  objectPath: string;
} | null> {
  try {
    const { ObjectStorageService } = await import(
      "../../replit_integrations/object_storage"
    );
    const svc = new ObjectStorageService();
    const uploadURL = await svc.getObjectEntityUploadURL();
    const objectPath = svc.normalizeObjectEntityPath(uploadURL);
    return { uploadURL, objectPath };
  } catch {
    return null;
  }
}

export function registerStorageRoutes(app: Express): void {
  app.post("/api/uploads/request-url", isAuthenticated, async (req, res) => {
    try {
      const validationError = validateUploadRequestBody(req.body);
      if (validationError) {
        return res.status(400).json(validationError);
      }
      const body = req.body as Record<string, unknown>;
      const filename = (body.filename ?? body.name) as string;
      const contentType = (body.contentType ?? body.content_type) as string;
      const size =
        typeof body.size === "number" ? body.size : Number(body.size);

      if (isR2Configured()) {
        const result = await generatePresignedUploadUrl({
          filename,
          contentType,
          size,
        });
        if (!result) {
          return res.status(503).json({ error: "Failed to generate upload URL" });
        }
        return res.json({
          ...result,
          uploadURL: result.uploadUrl,
          metadata: { name: filename, size, contentType },
        });
      }

      const fallback = await getReplitFallbackUploadUrl();
      if (!fallback) {
        return res.status(503).json({
          error:
            "Storage not configured. Set R2_* env vars or use Replit object storage.",
        });
      }
      return res.json({
        uploadUrl: fallback.uploadURL,
        uploadURL: fallback.uploadURL,
        objectPath: fallback.objectPath,
        metadata: { name: filename, size, contentType },
      });
    } catch (err) {
      console.error("Error generating upload URL:", err);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  app.post("/api/storage/signed-url", isAuthenticated, async (req, res) => {
    try {
      const objectKey = req.body?.objectKey ?? req.body?.r2Key;
      if (!objectKey || typeof objectKey !== "string" || !objectKey.trim()) {
        return res.status(400).json({ error: "Invalid objectKey" });
      }
      const key = objectKey.trim();
      const expiresIn = Math.min(
        Math.max(Number(req.body?.expiresIn) || 3600, 60),
        86400
      );
      if (!isR2Configured()) {
        return res.status(503).json({ error: "S3/R2 storage is not configured" });
      }
      const result = await generateSignedUrl(key, expiresIn);
      if (!result) {
        return res.status(503).json({ error: "Failed to generate signed URL" });
      }
      res.json(result);
    } catch (err) {
      console.error("Error generating signed URL:", err);
      res.status(500).json({ error: "Failed to generate signed URL" });
    }
  });
}
