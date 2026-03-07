# Tasks: R2 Cloudflare Object Storage

**Input**: Design documents from `/specs/006-r2-storage/`
**Prerequisites**: research.md, data-model.md, contracts/api.yaml

**Feature**: Migrate file storage from Replit to Cloudflare R2 with S3-compatible API

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Dependencies & Configuration)

**Purpose**: Install AWS SDK dependencies and configure R2 environment

- [ ] T001 Install AWS SDK dependencies: `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`
- [ ] T002 [P] Add R2 environment variables to `server/env.ts` (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_DOMAIN)
- [ ] T003 [P] Create R2 client configuration in `server/modules/storage/r2-client.ts`
- [ ] T004 [P] Create `server/modules/storage/` directory structure following module convention

---

## Phase 2: Foundational (Database Schema & Core Types)

**Purpose**: Add r2Key fields to existing tables - MUST complete before any user story work

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Add `r2Key` column to `jobPhotos` table in `shared/schema.ts`
- [ ] T006 Add `r2Key` column to `jobReceipts` table in `shared/schema.ts`
- [ ] T007 Add `r2Key` column to `milestoneMedia` table in `shared/schema.ts`
- [ ] T008 Create and run database migration for new r2Key columns
- [ ] T009 [P] Create `server/modules/storage/model.ts` re-exporting storage-related types from `@shared/schema`
- [ ] T010 Create `shared/models/storage.ts` with storage types (UploadRequest, PresignedUrlResponse, etc.)
- [ ] T011 Create storage utility functions in `server/modules/storage/utils.ts` (key generation, URL building)

**Checkpoint**: Database schema ready with r2Key fields on all three tables

---

## Phase 3: User Story 1 - New Uploads to R2 (Priority: P1) 🎯 MVP

**Goal**: Enable new file uploads to be stored directly in R2 using presigned URLs

**Independent Test**: Upload a job photo through the app, verify it's stored in R2 with correct key pattern, and URL is saved to database

### Implementation for User Story 1

- [ ] T012 Create `server/modules/storage/service.ts` with `generatePresignedUploadUrl()` function
- [ ] T013 Implement upload request validation in `server/modules/storage/service.ts` (file size, MIME type checks)
- [ ] T014 Create `server/modules/storage/routes.ts` with `POST /api/uploads/request-url` endpoint
- [ ] T015 Register storage routes in `server/routes/index.ts` following module convention
- [ ] T016 Update `client/src/hooks/use-upload.ts` to use new R2 presigned URL endpoint
- [ ] T017 Update `client/src/components/ObjectUploader.tsx` to handle R2 upload flow
- [ ] T018 [P] Create R2 URL helper in `client/src/lib/storage.ts` for generating public/signed URLs
- [ ] T019 [P] Update job photo creation flow to populate both `url` and `r2Key` fields
- [ ] T020 [P] Update job receipt creation flow to populate both `url` and `r2Key` fields
- [ ] T021 [P] Update milestone media creation flow to populate both `url` and `r2Key` fields
- [ ] T022 Add API tests in `server/__tests__/api.storage.test.ts` for presigned URL endpoint

**Checkpoint**: New uploads go directly to R2 with proper key format and database records

---

## Phase 4: User Story 2 - Signed URL Access (Priority: P2)

**Goal**: Generate time-limited signed URLs for accessing private R2 objects

**Independent Test**: Request a signed URL for an existing R2 object, verify it works for the duration, then expires

### Implementation for User Story 2

- [ ] T023 Add `generateSignedUrl()` function to `server/modules/storage/service.ts`
- [ ] T024 Implement `POST /api/storage/signed-url` endpoint in `server/modules/storage/routes.ts`
- [ ] T025 Add signed URL request validation (r2Key format, expiresIn limits)
- [ ] T026 Create helper hook `client/src/hooks/use-signed-url.ts` for fetching signed URLs
- [ ] T027 [P] Add API tests for signed URL endpoint in `server/__tests__/api.storage.test.ts`
- [ ] T028 [P] Add storage service unit tests for signed URL generation

**Checkpoint**: Signed URLs can be generated and used to access private R2 objects

---

## Phase 5: User Story 3 - Migration Tool (Priority: P3)

**Goal**: Background migration of existing Replit files to R2

**Independent Test**: Run migration on a batch of files, verify they are copied to R2, and database records are updated with r2Key

### Implementation for User Story 3

- [ ] T029 Create `server/modules/storage/migration-service.ts` with migration logic
- [ ] T030 Implement `POST /api/storage/migrate` admin endpoint in `server/modules/storage/routes.ts`
- [ ] T031 Implement `GET /api/storage/migrate/{jobId}/status` endpoint for progress tracking
- [ ] T032 Create migration job tracking in-memory store (or use existing job queue if available)
- [ ] T033 Implement batch processing with configurable batch size
- [ ] T034 Add dry-run mode to migration endpoint (report only, no actual copy)
- [ ] T035 Add file download from Replit and upload to R2 logic
- [ ] T036 Implement database record update with r2Key after successful migration
- [ ] T037 [P] Create migration_log table in `shared/schema.ts` (optional but recommended)
- [ ] T038 [P] Add migration status reporting and error tracking
- [ ] T039 [P] Add API tests for migration endpoints in `server/__tests__/api.storage.test.ts`

**Checkpoint**: Admin can trigger and monitor background migration of existing files

---

## Phase 6: User Story 4 - Dual-Read Compatibility (Priority: P4)

**Goal**: Support reading from both Replit and R2 during transition period

**Independent Test**: View job photos with mixed storage (some Replit URLs, some R2 keys) - all display correctly

### Implementation for User Story 4

- [ ] T040 Create `getFileUrl()` utility in `server/modules/storage/utils.ts` that handles both Replit URLs and R2 keys
- [ ] T041 Update job photo retrieval endpoints to use dual-read utility
- [ ] T042 Update job receipt retrieval endpoints to use dual-read utility
- [ ] T043 Update milestone media retrieval endpoints to use dual-read utility
- [ ] T044 [P] Create client-side URL resolution hook `client/src/hooks/use-storage-url.ts`
- [ ] T045 [P] Update photo gallery components to handle both URL types
- [ ] T046 [P] Update receipt display components to handle both URL types

**Checkpoint**: App works seamlessly with both Replit and R2 stored files

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements, testing, and documentation

- [ ] T047 [P] Add rate limiting to upload endpoints
- [ ] T048 [P] Implement file size and type validation middleware
- [ ] T049 Add error handling for R2 connection failures with fallback
- [ ] T050 Create monitoring/alerting for R2 operations (failed uploads, migration errors)
- [ ] T051 [P] Add storage module documentation in `docs/storage.md`
- [ ] T052 [P] Update `.env.example` with R2 configuration variables
- [ ] T053 Run full test suite: `npm run test:env`
- [ ] T054 [P] Add storage cleanup utility for orphaned R2 objects
- [ ] T055 Verify backward compatibility - existing Replit files still accessible

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all user stories
- **User Story 1 (P1)**: Depends on Foundational (r2Key columns)
- **User Story 2 (P2)**: Depends on US1 (basic upload flow working)
- **User Story 3 (P3)**: Depends on US1 (needs files in R2 to test migration)
- **User Story 4 (P4)**: Depends on US1 (needs dual-read logic)
- **Polish (Phase 7)**: Depends on all user stories

### User Story Dependencies

```
US1 (New Uploads) ─┬─> US2 (Signed URLs)
                   ├─> US3 (Migration)
                   └─> US4 (Dual-Read)
```

### Parallel Opportunities

- All Setup tasks (T001-T004) can run in parallel
- All Foundational tasks (T005-T011) can run in parallel (after T008 migration runs)
- Within US1: T012-T013 (service), T019-T021 (entity flows) can run in parallel after T014
- Within US3: T037-T039 (optional migration_log) can run in parallel with core migration
- Polish tasks marked [P] can run in parallel

---

## Parallel Execution Examples

### User Story 1 (New Uploads)

```bash
# Parallel batch 1: Core service (sequential)
T012: Create storage service with generatePresignedUploadUrl
T013: Add upload request validation
T014: Create routes with POST /api/uploads/request-url

# Parallel batch 2: Frontend updates (depends on T014)
T016: Update use-upload.ts hook
T017: Update ObjectUploader.tsx
T018: Create storage URL helper

# Parallel batch 3: Entity flows (depends on T014)
T019: Update job photo creation flow
T020: Update job receipt creation flow
T021: Update milestone media creation flow

# Final: Testing
T022: Add API tests
```

### User Story 3 (Migration)

```bash
# Parallel batch 1: Core migration (sequential)
T029: Create migration service
T030: POST /api/storage/migrate endpoint
T031: GET /api/storage/migrate/{jobId}/status endpoint

# Parallel batch 2: Migration features (after T029)
T032: Migration job tracking
T033: Batch processing
T034: Dry-run mode

# Parallel batch 3: Optional (after T029)
T037: Create migration_log table
T038: Migration status reporting
T039: API tests
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T004)
2. Complete Phase 2: Foundational (T005-T011)
3. Complete Phase 3: User Story 1 (T012-T022)
4. **STOP and VALIDATE**: Test new uploads to R2 work end-to-end
5. Deploy - new files go to R2, old files still on Replit (works via URL)

### Incremental Delivery

1. MVP (US1): New uploads to R2 → Deploy
2. Add US2: Signed URL access for private files → Deploy
3. Add US4: Dual-read compatibility → Deploy (seamless transition)
4. Add US3: Background migration tool → Run migration → Deploy
5. Each phase adds value without breaking previous functionality

### Migration Rollout Strategy

**Phase A**: Deploy US1 (new uploads to R2)
- New files go directly to R2
- Existing Replit files continue working via URL

**Phase B**: Deploy US4 (dual-read)
- App seamlessly handles both storage systems
- No user-facing changes

**Phase C**: Run US3 migration tool
- Admin triggers background migration
- Monitor progress, fix any issues
- Gradually migrate all existing files

**Phase D**: Retire Replit (future)
- Once migration complete, remove Replit integration
- All files served from R2

---

## Notes

### R2 Object Key Format

```
{organizationId}/{entityType}/{uuid}.{ext}

Examples:
- org_123/photos/a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg
- org_456/receipts/b2c3d4e5-f6g7-8901-bcde-f23456789012.pdf
- org_789/media/c3d4e5f6-g7h8-9012-cdef-345678901234.png
```

### Environment Variables Required

```bash
R2_ACCOUNT_ID=         # Cloudflare account ID
R2_ACCESS_KEY_ID=      # R2 API access key
R2_SECRET_ACCESS_KEY=  # R2 API secret
R2_BUCKET_NAME=        # R2 bucket name (e.g., plazaworks-uploads)
R2_PUBLIC_DOMAIN=      # Custom domain (optional, for public URLs)
```

### Testing Checklist

- [ ] New job photos upload to R2 with correct key format
- [ ] New job receipts upload to R2 with correct key format
- [ ] New milestone media upload to R2 with correct key format
- [ ] Presigned URLs expire correctly
- [ ] Signed URLs work for private access
- [ ] Migration copies files without corruption
- [ ] Dual-read handles mixed Replit/R2 files
- [ ] All existing tests pass: `npm run test:env`
