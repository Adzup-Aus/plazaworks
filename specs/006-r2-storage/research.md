# Research: R2 Cloudflare Object Storage

**Feature**: R2 Cloudflare Object Storage Migration  
**Date**: 2026-03-07

---

## Decisions Made

### 1. AWS SDK v3 for R2 Integration

**Decision**: Use `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` for R2 operations.

**Rationale**:
- R2 is S3-compatible, so the AWS SDK works with minimal configuration
- Well-documented, mature library with TypeScript support
- Supports presigned URLs for secure uploads
- Active maintenance and community support

**Alternatives Considered**:
- **Cloudflare R2 native API**: Rejected - less documentation, no official TypeScript SDK, more custom code required
- **MinIO client**: Rejected - unnecessary abstraction layer, AWS SDK is standard

**Configuration**:
```typescript
const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});
```

---

### 2. Presigned URL Upload Flow (Preserved)

**Decision**: Maintain the existing presigned URL upload flow.

**Rationale**:
- Existing frontend code (`use-upload.ts`, `ObjectUploader.tsx`) already uses this pattern
- Secure - credentials never exposed to client
- Allows server-side validation before granting upload permission
- Works well with R2's S3-compatible presigned URL generation

**Flow**:
1. Client sends file metadata to `POST /api/uploads/request-url`
2. Backend validates and generates presigned PUT URL
3. Client uploads directly to R2 via presigned URL
4. Client creates database record with returned object reference

**Alternatives Considered**:
- **Direct browser uploads to R2**: Rejected - requires CORS configuration, bypasses server validation
- **Server-side streaming upload**: Rejected - adds latency, uses more server resources

---

### 3. Database Schema Strategy

**Decision**: Add `r2Key` field to existing tables; maintain `url` field for compatibility.

**Rationale**:
- Existing tables (job_photos, job_receipts, milestone_media) already store file metadata
- Adding `r2Key` allows storing the R2 object key separately from the full URL
- Maintains backward compatibility during migration period
- URL can be computed dynamically from r2Key or stored for performance

**Schema Changes**:
- Add `r2Key: text('r2_key')` to job_photos table
- Add `r2Key: text('r2_key')` to job_receipts table
- Add `r2Key: text('r2_key')` to milestone_media table

**Alternatives Considered**:
- **New storage_uploads table**: Rejected - over-normalization, adds unnecessary joins
- **Replace existing fields**: Rejected - breaks existing data during migration

---

### 4. Migration Strategy

**Decision**: Background job migration with dual-read capability.

**Rationale**:
- Zero downtime - existing Replit URLs continue to work
- Gradual migration of existing files
- Can be run in batches to control load
- Rollback possible if issues occur

**Approach**:
1. Deploy R2 upload capability (new uploads go to R2)
2. Run background job to copy existing Replit files to R2
3. Update database records with r2Key as migration progresses
4. Once complete, retire Replit integration

**Alternatives Considered**:
- **Big-bang migration**: Rejected - too risky, requires downtime
- **Lazy migration (migrate on access)**: Rejected - unpredictable performance, complex logic

---

### 5. File Organization in R2

**Decision**: Use structured key pattern: `{organizationId}/{entityType}/{uuid}.{ext}`

**Rationale**:
- Multi-tenant isolation by organization
- Logical grouping by entity type (photos, receipts, media)
- UUID prevents naming collisions
- Easy to list/filter by prefix if needed

**Pattern**:
```
org_123/photos/a1b2c3d4.jpg
org_123/receipts/e5f6g7h8.pdf
org_456/media/i9j0k1l2.png
```

**Alternatives Considered**:
- **Flat structure with UUID only**: Rejected - harder to manage, no organization
- **Date-based hierarchy**: Rejected - unnecessary complexity, harder to relate to entities

---

## Environment Variables Required

| Variable | Description | Example |
|----------|-------------|---------|
| `R2_ACCOUNT_ID` | Cloudflare account ID | `1a2b3c4d5e6f7g8h9i0j` |
| `R2_ACCESS_KEY_ID` | R2 API access key | `abc123def456` |
| `R2_SECRET_ACCESS_KEY` | R2 API secret | `xyz789uvw012` |
| `R2_BUCKET_NAME` | R2 bucket name | `plazaworks-uploads` |
| `R2_PUBLIC_DOMAIN` | Custom domain (optional) | `images.plazaworks.com` |

---

## Dependencies to Add

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

---

## R2 Configuration Notes

### CORS (if direct browser uploads needed in future)

```json
[
  {
    "AllowedOrigins": ["https://yourapp.com"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

### Public Access

- R2 buckets are private by default
- Public access requires custom domain or public bucket setting
- Signed URLs recommended for authenticated access to private objects
