# S3-Compatible Object Storage

Uploads use a **single S3-style object key** for all file types. When R2 (or another S3-compatible store) is configured, new uploads go there; otherwise the app falls back to Replit object storage.

## Key format (S3 approach)

One format for every upload:

- **Pattern**: `uploads/{uuid}.{ext}`
- **Examples**: `uploads/a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg`, `uploads/f1e2d3c4-b5a6-7890-1234-567890abcdef.pdf`

No separate paths for photos, receipts, or media—one key shape for all.

## Database

Tables store the key in a single column:

- **Column**: `object_key` (nullable) on `job_photos`, `job_receipts`, `milestone_media`
- **URL**: `url` still holds the display URL (public or legacy); `object_key` holds the S3 key for signed URLs or public domain.

Migration:

```bash
npm run db:migrate:object-key
```

Or use `npm run db:push` with Drizzle.

## Configuration

Set these to use R2 (or any S3-compatible endpoint):

| Variable | Description |
|----------|-------------|
| `R2_ACCOUNT_ID` | Cloudflare account ID (for R2 endpoint) |
| `R2_ACCESS_KEY_ID` | S3-compatible access key |
| `R2_SECRET_ACCESS_KEY` | S3-compatible secret key |
| `R2_BUCKET_NAME` | Bucket name |
| `R2_PUBLIC_DOMAIN` | (Optional) Custom domain for public URLs |

## Authenticated access: R2 S3 signed links

When returning job photos, receipts, or milestone media to authenticated users, the server uses **R2’s S3 signed URL** (the S3 link R2 provides) for any record that has an `object_key`. So the `url` field in API responses is a time-limited signed URL for that object, enabling authenticated access without making the bucket public.

- GET `/api/jobs/:jobId/photos`, `/api/job-photos/:id`, and the equivalent receipt and milestone-media endpoints return `url` as the R2 signed URL when the row has `objectKey` and R2 is configured.

## API

- **POST /api/uploads/request-url**  
  Body: `{ filename, contentType, size }` (no `entityType`).  
  Response: `{ uploadUrl, uploadURL, objectPath, expiresAt, metadata }` where `objectPath` is the S3 key (e.g. `uploads/uuid.ext`).

- **POST /api/storage/signed-url**  
  Body: `{ objectKey, expiresIn? }`.  
  Returns a time-limited signed URL (the S3 link from R2) for that key.

## 403 Forbidden when uploading

If the browser shows **403 Forbidden** when uploading (after the presigned URL is returned), the R2 bucket is blocking the **cross-origin PUT** from your app. Fix it by adding **CORS** to the bucket.

1. In **Cloudflare Dashboard** → **R2** → your bucket → **Settings**.
2. Open **CORS policy** and add a rule that allows your app’s origin.

**Example CORS policy** (allow localhost and one production origin):

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:5173",
      "http://localhost:5000",
      "https://your-production-domain.com"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

- **Local dev:** include `http://localhost:5173` (Vite) and/or whatever port your frontend uses.
- **Production:** add your real app origin (e.g. `https://app.plazaworks.com`) with `https`.
- **AllowedMethods** must include **PUT** for uploads.
- Save the CORS policy; changes can take a short moment to apply.

After saving, try the upload again. If it still returns 403, confirm the request’s **Origin** header in devtools matches one of the values in `AllowedOrigins`.
