# Quickstart: 002 Schedule Drag-to-Select and Activity Entity

**Branch**: `002-schedule-drag-job-activity`

## Scope

- **Backend**: New Activity entity (CRUD API); schedule entries can reference Job or Activity; seed Travel, Admin, Sales.
- **Frontend**: Schedule page — day selection, hourly timeline, drag-to-select time range, right sidebar (job/activity picker), left sidebar Activity CRUD; activities visually distinct from jobs.

## Prerequisites

- Node 18+, npm, PostgreSQL
- Repo constitution followed: `server/modules/`, `shared/models/`, `client/src/pages/`

## Implementation order

1. **Data & API**
   - Add `shared/models/activities.ts` (table, insert schema, types); re-export in `shared/schema.ts`.
   - Extend `shared/models/schedule.ts`: `activityId` (FK to activities), `jobId` nullable; validation one-of jobId/activityId.
   - Migration (or drizzle push): create activities table, alter schedule_entries (activity_id, job_id nullable).
   - Seed default activities (Travel, Admin, Sales) for default/first org.
   - Add `server/modules/activities/` (routes + model); register in `server/routes/index.ts`.
   - Extend `server/storage.ts`: Activity CRUD; schedule create/update accept activityId and enforce one-of.
   - Extend `server/modules/schedule/routes.ts`: POST/PATCH accept activityId; validate one-of.

2. **Tests**
   - `server/__tests__/api.activities.test.ts`: list, get, create, update, delete, 401.
   - Update `server/__tests__/api.schedule.test.ts`: create entry with activityId; ensure one-of validation.
   - Run `npm run test:env`.

3. **Frontend**
   - Schedule page: day picker (existing or refine), switch to **hourly** timeline view for selected day.
   - Grid: staff rows × hour columns; render existing job and activity entries in correct cells.
   - Pointer events: onPointerDown → start selection; onPointerMove → update end hour (visual feedback); onPointerUp → open right sidebar with selected range and staff row.
   - Right sidebar: Sheet/panel with Jobs list and Activities list; on select + confirm → POST /api/schedule with jobId or activityId, staffId, date, startTime, endTime.
   - Left sidebar: Activity section — list activities (GET /api/activities), add/edit/delete (POST, PATCH, DELETE); use TanStack Query and invalidate after mutations.
   - Differentiate activities from jobs on the grid (e.g. label, color, or icon).

## Key files

| Area | File |
|------|------|
| Schema | `shared/models/activities.ts`, `shared/models/schedule.ts` |
| Activities API | `server/modules/activities/routes.ts`, `model.ts` |
| Schedule API | `server/modules/schedule/routes.ts` |
| Storage | `server/storage.ts` |
| Tests | `server/__tests__/api.activities.test.ts`, `api.schedule.test.ts` |
| UI | `client/src/pages/schedule.tsx` |

## Verification

- `npm run test:env` passes.
- Manual: select day → see hourly grid → drag range → right sidebar opens → pick job or activity → entry appears; left sidebar: add/edit/delete Activity; activities look distinct from jobs on grid.
