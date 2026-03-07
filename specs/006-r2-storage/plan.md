# Implementation Plan: R2 Cloudflare Object Storage

**Branch**: `006-r2-storage` | **Date**: 2026-03-07 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/006-r2-storage/spec.md`

## Summary

Migrate from Replit Object Storage to Cloudflare R2 for all file uploads in the application. The existing architecture uses a presigned URL flow which can be adapted for R2's S3-compatible API. New uploads will go directly to R2, and existing Replit-hosted files will be migrated via a background job.

**Technical Approach**:
1. Replace `ObjectStorageService` (Google Cloud Storage client) with AWS SDK v3 S3 client configured for R2
2. Maintain existing presigned URL upload flow to minimize frontend changes
3. Create migration script to copy existing Replit images to R2
4. Update environment configuration for R2 credentials

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js 20+)  
**Primary Dependencies**: 
- `@aws-sdk/client-s3` (AWS SDK v3 for S3-compatible R2 API)
- `@aws-sdk/s3-request-presigner` (for presigned URLs)
**Storage**: PostgreSQL (metadata), Cloudflare R2 (object storage)  
**Testing**: Vitest (existing test framework)  
**Target Platform**: Linux server / Web application  
**Project Type**: Web application (Express backend + React frontend)  
**Performance Goals**: 
- Upload: <5 seconds for 10MB files
- Download: <1 second for typical images
**Constraints**: 
- Must maintain backward compatibility with existing upload flows
- Zero downtime migration required
**Scale/Scope**: 
- Current: Unknown number of existing images in Replit
- Target: All new uploads to R2

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Check | Status | Notes |
|-------|--------|-------|
| Backend module structure | PASS | Will create `server/modules/storage/` with routes.ts and model.ts |
| Shared schema location | PASS | Storage metadata tables already exist (job_photos, job_receipts, milestone_media) |
| Route registration | PASS | Will register in `server/routes/index.ts` |
| Tests required | PASS | API tests in `server/__tests__/api.storage.test.ts` |
| Frontend data fetching | PASS | Existing `use-upload.ts` hook will be adapted |
| Path aliases | PASS | Uses existing `@/` and `@shared/` conventions |

**Constitution Compliance Notes**:
- The existing `server/replit_integrations/` directory structure violates the constitution (routes in integration folder, not modules/)
- This migration will correct this by creating a proper `server/modules/storage/` module
- Existing tables are already in `shared/schema.ts` (job_photos, job_receipts, milestone_media)

## Project Structure

### Documentation (this feature)

```text
specs/006-r2-storage/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

**Backend Changes**:

```text
server/
├── modules/
│   └── storage/              # NEW: Proper storage module per constitution
│       ├── routes.ts         # Upload URL generation, migration status
│       └── model.ts          # Re-exports storage-related types
├── services/
│   └── r2Storage.ts          # NEW: R2 storage service (replaces ObjectStorageService)
├── migrations/
│   └── xxx_add_r2_fields.sql # NEW: Add r2Key field to existing tables
└── __tests__/
    └── api.storage.test.ts   # NEW: API tests for storage module
```

**Frontend Changes**:

```text
client/src/
├── hooks/
│   └── use-upload.ts         # UPDATE: Change endpoint from Replit to R2
└── lib/
    └── r2-config.ts          # NEW: R2 configuration constants
```

**Structure Decision**: 
- Web application structure with Express backend and React frontend
- Creates proper `server/modules/storage/` per constitution (replacing the non-compliant `server/replit_integrations/`)
- Service layer pattern: `server/services/r2Storage.ts` for R2 SDK interaction
- Minimal frontend changes since presigned URL flow remains the same

## Complexity Tracking

> **Justification for approach**

| Decision | Why Needed | Alternatives Rejected |
|----------|------------|----------------------|
| AWS SDK v3 vs R2 native API | S3-compatible standard, well-documented, TypeScript support | Direct R2 API calls (more complex, less tooling) |
| Presigned URL flow | Matches existing architecture, secure, minimal frontend changes | Direct browser-to-R2 uploads (requires CORS setup, less control) |
| Replace vs extend ObjectStorageService | Clean break from Replit dependency, simplifies code | Dual storage support (unnecessary complexity) |
| Background migration | Zero downtime, allows gradual rollout | Bulk migration (risky, downtime required) |

---

## Constitution Check - Post-Design Re-evaluation

| Check | Status | Notes |
|-------|--------|-------|
| Module structure compliance | PASS | `server/modules/storage/` will be created with proper routes.ts and model.ts |
| Shared schema compliance | PASS | Uses existing tables in `shared/schema.ts`, adds r2Key column via migration |
| Route registration | PASS | Will be registered in `server/routes/index.ts` per constitution |
| Test requirements | PASS | API tests planned in `server/__tests__/api.storage.test.ts` |
| Frontend patterns | PASS | Minimal changes to existing hook, follows `@/` and `@shared/` conventions |
| No new feature routes in routes/ | PASS | All new routes in `server/modules/storage/routes.ts` |

**Design is constitution-compliant. Ready for Phase 2 task breakdown.**
