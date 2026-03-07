# Data Model: R2 Cloudflare Object Storage

**Feature**: R2 Cloudflare Object Storage Migration  
**Date**: 2026-03-07

---

## Existing Entities (Modified)

The following tables already exist and will have `r2Key` field added:

### 1. job_photos

**Purpose**: Store job site photos uploaded by staff

| Field | Type | Description |
|-------|------|-------------|
| `id` | serial (PK) | Unique identifier |
| `jobId` | integer (FK) | Reference to jobs table |
| `scheduleEntryId` | integer (FK, nullable) | Optional reference to schedule entry |
| `uploadedById` | integer (FK) | User who uploaded the photo |
| `filename` | text | Storage filename (UUID) |
| `originalFilename` | text | Original user-provided filename |
| `mimeType` | text | MIME type (image/jpeg, etc.) |
| `fileSize` | integer | Size in bytes |
| `url` | text | **URL to the image (Replit or R2)** |
| `thumbnailUrl` | text (nullable) | Thumbnail URL if applicable |
| `r2Key` | text (nullable) | **NEW: R2 object key** |
| `caption` | text (nullable) | User-provided caption |
| `category` | text (nullable) | Photo category |
| `createdAt` | timestamp | Upload timestamp |

**Relationships**:
- Belongs to: `jobs`, `users` (uploadedBy), `schedule_entries`

---

### 2. job_receipts

**Purpose**: Store receipt images for job expenses

| Field | Type | Description |
|-------|------|-------------|
| `id` | serial (PK) | Unique identifier |
| `jobId` | integer (FK) | Reference to jobs table |
| `uploadedById` | integer (FK) | User who uploaded the receipt |
| `filename` | text | Storage filename (UUID) |
| `originalFilename` | text | Original user-provided filename |
| `mimeType` | text | MIME type |
| `fileSize` | integer | Size in bytes |
| `url` | text | **URL to the receipt image** |
| `thumbnailUrl` | text (nullable) | Thumbnail URL |
| `r2Key` | text (nullable) | **NEW: R2 object key** |
| `description` | text (nullable) | Receipt description |
| `vendor` | text (nullable) | Vendor name |
| `amount` | numeric (nullable) | Receipt amount |
| `receiptDate` | date (nullable) | Date on receipt |
| `category` | text (nullable) | Expense category |
| `createdAt` | timestamp | Upload timestamp |

**Relationships**:
- Belongs to: `jobs`, `users` (uploadedBy)

---

### 3. milestone_media

**Purpose**: Store photos and notes associated with job milestones

| Field | Type | Description |
|-------|------|-------------|
| `id` | serial (PK) | Unique identifier |
| `milestoneId` | integer (FK) | Reference to milestones table |
| `jobId` | integer (FK) | Reference to jobs table |
| `scheduleEntryId` | integer (FK, nullable) | Optional schedule entry reference |
| `uploadedById` | integer (FK) | User who uploaded |
| `mediaType` | enum | "photo" or "note" |
| `filename` | text (nullable) | Storage filename for photos |
| `url` | text (nullable) | **URL to media (for photos)** |
| `thumbnailUrl` | text (nullable) | Thumbnail URL |
| `r2Key` | text (nullable) | **NEW: R2 object key** |
| `caption` | text (nullable) | Photo caption |
| `noteContent` | text (nullable) | Text content for notes |
| `workDate` | date (nullable) | Associated work date |
| `createdAt` | timestamp | Upload timestamp |

**Relationships**:
- Belongs to: `milestones`, `jobs`, `users` (uploadedBy), `schedule_entries`

---

## R2 Object Key Format

**Pattern**: `{organizationId}/{entityType}/{uuid}.{ext}`

| Component | Description | Example |
|-----------|-------------|---------|
| `organizationId` | Organization identifier | `org_123` |
| `entityType` | Type of content | `photos`, `receipts`, `media` |
| `uuid` | Unique identifier | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` |
| `ext` | File extension | `jpg`, `png`, `pdf` |

**Examples**:
- `org_123/photos/a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg`
- `org_456/receipts/b2c3d4e5-f6g7-8901-bcde-f23456789012.pdf`

---

## URL Generation

### Public URL (when using custom domain)

```
https://{R2_PUBLIC_DOMAIN}/{r2Key}
```

Example:
```
https://images.plazaworks.com/org_123/photos/a1b2c3d4.jpg
```

### Signed URL (for private access)

Generated via AWS SDK `getSignedUrl` with `GetObjectCommand`:

```typescript
const command = new GetObjectCommand({
  Bucket: env.R2_BUCKET_NAME,
  Key: r2Key,
});

const signedUrl = await getSignedUrl(r2Client, command, {
  expiresIn: 3600, // 1 hour
});
```

---

## Migration State Tracking

### migration_log (Optional - for tracking migration progress)

| Field | Type | Description |
|-------|------|-------------|
| `id` | serial (PK) | Unique identifier |
| `entityType` | text | Table name (job_photos, job_receipts, etc.) |
| `entityId` | integer | ID of the migrated record |
| `oldUrl` | text | Original Replit URL |
| `newR2Key` | text | New R2 object key |
| `migratedAt` | timestamp | Migration timestamp |
| `status` | text | "pending", "completed", "failed" |
| `error` | text (nullable) | Error message if failed |

---

## Validation Rules

### File Upload Validation

| Rule | Value | Error Message |
|------|-------|---------------|
| Max file size | 10MB | "File exceeds 10MB limit" |
| Allowed MIME types | image/jpeg, image/png, image/gif, image/webp, image/heic, image/heif, application/pdf | "Invalid file type" |
| Filename length | Max 255 chars | "Filename too long" |

### Database Constraints

| Constraint | Tables | Purpose |
|------------|--------|---------|
| `url NOT NULL` | job_photos, job_receipts | Must have storage reference |
| `fileSize > 0` | All | Valid file size |
| `mimeType IN (...)` | All | Valid MIME type |
