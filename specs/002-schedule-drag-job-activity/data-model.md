# Data Model: Schedule Drag-to-Select and Activity Entity

**Feature**: 002-schedule-drag-job-activity  
**Date**: 2026-02-18

## Entity: Activity

New table for unbillable activity types (e.g. Travel, Admin, Sales), manageable via CRUD in the left sidebar.

| Field | Type | Constraints | Notes |
|-------|------|-------------|--------|
| id | varchar (PK) | default gen_random_uuid() | |
| organizationId | varchar (FK → organizations.id) | not null, onDelete cascade | Scope activities per org |
| name | varchar(255) | not null | Display name (e.g. "Travel", "Admin") |
| sortOrder | integer / varchar | optional | For stable ordering in UI |
| createdAt | timestamp | default now() | |
| updatedAt | timestamp | default now() | |

**Validation**: name required, non-empty. organizationId from auth context.

**Relations**: One organization; many schedule entries (via activityId).

**Seed**: Insert three rows when table is empty: Travel, Admin, Sales (organizationId from first/default org or per-tenant seed).

---

## Entity: Schedule entry (existing, extended)

Schedule entries represent a staff member assigned to a time range on a date. They reference either a **Job** or an **Activity** (not both).

| Field | Type | Constraints | Notes |
|-------|------|-------------|--------|
| id | varchar (PK) | (existing) | |
| jobId | varchar (FK → jobs.id) | **nullable** | Required if activityId is null |
| activityId | varchar (FK → activities.id) | **nullable** | Required if jobId is null |
| staffId | varchar | not null | (existing) |
| scheduledDate | date | not null | (existing) |
| startTime | varchar(10) | optional | e.g. "09:00" from drag |
| endTime | varchar(10) | optional | e.g. "12:00" from drag |
| durationHours | decimal | optional | (existing) |
| status | varchar | default "scheduled" | (existing) |
| notes | text | optional | (existing) |
| createdAt / updatedAt | timestamp | (existing) | |

**Validation**:
- Exactly one of `jobId` or `activityId` must be set (enforced in Zod and API).
- scheduledDate, staffId required. startTime/endTime recommended when created from drag.

**State**: No new state machine; existing statuses (scheduled, completed, cancelled) apply to both job and activity entries.

**Migration**: Add `activity_id` column (nullable, FK to activities.id). Make `job_id` nullable. Backfill not required (existing rows keep jobId set). Add check constraint or app-level rule: (job_id IS NOT NULL AND activity_id IS NULL) OR (job_id IS NULL AND activity_id IS NOT NULL).

---

## Relationships

- **Organization** → has many **Activities** (organizationId on activities).
- **Activity** → has many **Schedule entries** (activityId on schedule_entries).
- **Job** → has many **Schedule entries** (jobId on schedule_entries); jobId nullable when activityId set.
- **Staff** → has many **Schedule entries** (unchanged).

---

## File placement (constitution)

- **New**: `shared/models/activities.ts` — define `activities` table, relations, insert schema, types. Re-export from `shared/schema.ts`.
- **Update**: `shared/models/schedule.ts` — add `activityId` column, optional `jobId`, relation to activities, update insert schema and validation (one of jobId/activityId).
- **New**: `server/modules/activities/routes.ts` and `model.ts` — Activity CRUD API; model re-exports from `@shared/schema`.
- **Update**: `server/modules/schedule/routes.ts` — accept activityId and optional jobId on create/PATCH; validate one-of; storage layer extended for activityId.
- **Update**: `server/storage.ts` — activity CRUD + getScheduleEntriesByDateRange (and existing getters) return entries with job or activity; optional join/load of activity name for display.
