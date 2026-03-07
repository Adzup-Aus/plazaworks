# Feature Specification: R2 Cloudflare Object Storage

**Feature Branch**: `006-r2-storage`  
**Created**: 2026-03-07  
**Status**: Draft  
**Input**: User description: "Currently object storage for images is replit however we migrated. I would like you to create a clean architecture to upload objects using r2 cloudflare."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Upload Images to R2 Storage (Priority: P1)

As a staff user, I want to upload images (job photos, client documents, invoice attachments) to Cloudflare R2 storage so that they are securely stored and accessible via the application.

**Why this priority**: This is the core functionality replacing the existing Replit Object Storage. Without this, image uploads across the application would fail after migration.

**Independent Test**: Can be fully tested by attempting to upload an image through any existing upload flow (job photo, client attachment, etc.) and verifying the image is stored in R2 and displays correctly.

**Acceptance Scenarios**:

1. **Given** a staff user is on a page with image upload capability (e.g., job details, client profile), **When** they select and upload an image file, **Then** the file is successfully stored in R2 and a reference URL is saved to the database
2. **Given** an uploaded image, **When** any user views the page containing that image, **Then** the image loads correctly from R2 via a public or signed URL
3. **Given** a large image file (>5MB), **When** the user uploads it, **Then** the upload completes successfully with appropriate progress indication

---

### User Story 2 - Retrieve and Display Stored Images (Priority: P1)

As any user, I want to view images that have been uploaded to the system so that I can reference job photos, client documents, or other attachments.

**Why this priority**: Viewing uploaded content is equally critical as uploading - users need to access existing images that were migrated from Replit or newly uploaded to R2.

**Independent Test**: Can be fully tested by navigating to any page that displays images and verifying all images load correctly from R2 URLs.

**Acceptance Scenarios**:

1. **Given** images exist in R2 storage (either newly uploaded or migrated), **When** a user opens a page containing those images, **Then** all images render correctly without broken links
2. **Given** an image in R2, **When** the application requests it, **Then** it is served with appropriate caching headers for performance
3. **Given** a private or sensitive image, **When** accessed, **Then** it uses a time-limited signed URL to prevent unauthorized direct access

---

### User Story 3 - Migrate Existing Replit Images (Priority: P2)

As an administrator, I want existing images currently stored in Replit Object Storage to be migrated to R2 so that no data is lost during the transition.

**Why this priority**: While critical for data continuity, this can be handled as a background migration task after the core upload/retrieve functionality is working. The existing Replit storage should remain functional during the transition.

**Independent Test**: Can be tested by running a migration script that transfers images from Replit to R2 and verifies all image references are updated correctly.

**Acceptance Scenarios**:

1. **Given** existing image references pointing to Replit URLs, **When** the migration runs, **Then** all images are copied to R2 and database references are updated
2. **Given** a partially completed migration, **When** new images are uploaded, **Then** they go directly to R2 without affecting the migration
3. **Given** a migrated image, **When** accessed via its old reference, **Then** it redirects or resolves to the new R2 location

---

### User Story 4 - Delete Images from R2 (Priority: P3)

As a staff user, I want to delete images that are no longer needed so that storage costs are managed and sensitive data can be properly removed.

**Why this priority**: Important for data management but can be implemented after core functionality. Existing images can remain in storage initially.

**Independent Test**: Can be tested by deleting an attachment from a job, client, or invoice and verifying the image is removed from R2 storage.

**Acceptance Scenarios**:

1. **Given** an existing image attachment, **When** a user deletes it from the application, **Then** the image is removed from R2 storage and the database reference is cleared
2. **Given** an attempt to delete an image that doesn't exist in R2, **When** the delete operation runs, **Then** the system handles the error gracefully and cleans up the database reference

---

### Edge Cases

- What happens when the R2 service is temporarily unavailable?
- How does the system handle upload of files with the same name?
- What happens when a file exceeds the maximum allowed size?
- How are invalid file types (non-images) handled during upload?
- What happens if the database update succeeds but the R2 upload fails (or vice versa)?
- How does the system handle network interruptions during large file uploads?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a service/module for uploading files to Cloudflare R2 object storage
- **FR-002**: System MUST generate unique identifiers for stored objects to prevent naming conflicts
- **FR-003**: System MUST support retrieving files from R2 via public URLs for non-sensitive content
- **FR-004**: System MUST support generating time-limited signed URLs for private/sensitive content
- **FR-005**: System MUST validate file types before upload (restrict to images: JPG, PNG, GIF, WebP, PDF where applicable)
- **FR-006**: System MUST enforce maximum file size limits (configurable, default 10MB)
- **FR-007**: System MUST delete objects from R2 when the corresponding database record is removed
- **FR-008**: System MUST handle R2 service errors gracefully with appropriate user feedback
- **FR-009**: System MUST store object metadata (original filename, content type, size, upload timestamp) in the database
- **FR-010**: All existing image upload flows MUST continue to work after migration to R2 backend
- **FR-011**: System MUST use environment variables for R2 configuration (account ID, access key, secret key, bucket name, public domain)

### Key Entities *(include if feature involves data)*

- **StorageUpload**: Represents a file stored in R2
  - `id`: Unique identifier (UUID)
  - `r2Key`: The unique key/path in R2 bucket
  - `originalFilename`: Original name of the uploaded file
  - `contentType`: MIME type of the file
  - `size`: File size in bytes
  - `bucket`: R2 bucket name
  - `publicUrl`: Public URL if applicable (for public buckets)
  - `uploadedAt`: Timestamp of upload
  - `uploadedBy`: Reference to user who uploaded
  - `organizationId`: For multi-tenant isolation

- **R2Configuration**: Environment-based configuration for R2 connection
  - `accountId`: Cloudflare account ID
  - `accessKeyId`: R2 access key
  - `secretAccessKey`: R2 secret key
  - `bucketName`: Target R2 bucket
  - `publicDomain`: Custom domain for public access (optional)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can upload images up to 10MB in under 5 seconds on a standard connection
- **SC-002**: 100% of uploaded images are successfully retrievable after upload (zero data loss)
- **SC-003**: All existing image-dependent features (job photos, client attachments, invoices) continue to function without regression
- **SC-004**: Image load times from R2 are comparable to or faster than previous Replit storage (under 1 second for typical images)
- **SC-005**: Storage costs are reduced by at least 30% compared to Replit Object Storage pricing
- **SC-006**: Zero unplanned downtime during the migration from Replit to R2

## Assumptions

- Cloudflare R2 bucket and access credentials are available and properly configured
- R2 bucket has appropriate CORS settings for web uploads if using direct browser-to-R2 uploads
- The application will continue to use a backend-mediated upload pattern (not direct browser-to-R2) for security and validation
- Existing image database schema can accommodate new R2-specific fields (r2Key, bucket, publicUrl)
- File types are limited to images and PDFs; other document types are out of scope for this feature

## Dependencies

**External Services:**
- Cloudflare R2 API (S3-compatible)
- Existing Replit Object Storage (for migration period)

**Internal Dependencies:**
- Database schema for storing upload metadata
- Authentication/authorization system (for access control)
- Existing upload UI components (to be updated with new backend)

**Environment Variables Required:**
- `R2_ACCOUNT_ID`: Cloudflare account ID
- `R2_ACCESS_KEY_ID`: R2 access key
- `R2_SECRET_ACCESS_KEY`: R2 secret key
- `R2_BUCKET_NAME`: Target bucket name
- `R2_PUBLIC_DOMAIN` (optional): Custom domain for public URLs

## Integration Requirements

For R2 Cloudflare integration, the following information is needed:

1. **Cloudflare Account ID**: Found in Cloudflare dashboard right sidebar
2. **R2 Access Key ID**: Created in Cloudflare Dashboard → R2 → Manage R2 API Tokens
3. **R2 Secret Access Key**: Generated alongside the Access Key ID
4. **Bucket Name**: The specific R2 bucket for storing images
5. **Public Domain** (optional): If using a custom domain for public access (e.g., `images.yourapp.com`)
6. **CORS Configuration**: If enabling direct browser uploads, the bucket needs CORS rules allowing the application's origin

## Notes

- R2 is S3-compatible, so the AWS SDK for JavaScript (v3) can be used with R2-specific endpoint configuration
- Consider implementing multipart upload for files >100MB (future enhancement)
- Migration strategy: Run a background job to copy existing Replit images to R2, then update database references
- Rollback plan: Keep Replit storage accessible during transition period until migration is verified
