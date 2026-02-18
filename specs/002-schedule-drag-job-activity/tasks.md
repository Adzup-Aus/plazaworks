# Tasks: Schedule Drag-to-Select and Activity Entity

**Input**: Design documents from `/specs/002-schedule-drag-job-activity/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Backend API tests are required by project constitution; included below.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `server/modules/`, `shared/models/`, `server/__tests__/`
- **Frontend**: `client/src/pages/`, `client/src/components/`

---

## Phase 1: Setup

**Purpose**: Verify feature context and branch

- [ ] T001 Verify feature branch 002-schedule-drag-job-activity and repo structure per specs/002-schedule-drag-job-activity/plan.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Activity entity, schedule schema extension, Activities API, and schedule API extensions. MUST be complete before user story implementation.

**Independent Test**: GET /api/activities returns list; POST /api/schedule with activityId creates entry; seed provides Travel, Admin, Sales.

- [ ] T002 [P] Create Activity model (table, relations, insert schema, types) in shared/models/activities.ts
- [ ] T003 Re-export activities in shared/schema.ts
- [ ] T004 [P] Extend schedule model: add activityId (FK to activities), make jobId nullable, add Zod one-of validation in shared/models/schedule.ts
- [ ] T005 Run migration or drizzle push for activities table and schedule_entries (activity_id, job_id nullable)
- [ ] T006 Add seed for default activities (Travel, Admin, Sales) in scripts or migration
- [ ] T007 [P] Create server/modules/activities/model.ts re-exporting from @shared/schema
- [ ] T008 Implement Activity CRUD routes (GET list, GET :id, POST, PATCH :id, DELETE :id) in server/modules/activities/routes.ts
- [ ] T009 Register activities routes in server/routes/index.ts
- [ ] T010 Extend server/storage.ts with Activity CRUD and schedule create/update accepting activityId with one-of validation
- [ ] T011 Extend server/modules/schedule/routes.ts to accept activityId on POST/PATCH and validate exactly one of jobId or activityId
- [ ] T012 [P] Add server/__tests__/api.activities.test.ts (GET list, GET :id, POST, PATCH, DELETE, 401 unauthenticated)
- [ ] T013 Update server/__tests__/api.schedule.test.ts for POST with activityId and one-of validation (400 when both or neither)
- [ ] T014 Run npm run test:env and fix any failures

**Checkpoint**: Foundation ready — Activity API and schedule API support activities; tests pass.

---

## Phase 3: User Story 1 – Day selection and hourly schedule view (Priority: P1) — MVP

**Goal**: User can select a day and see the schedule as an hourly timeline with staff rows and existing entries in correct cells.

**Independent Test**: Select a day via picker or prev/next; schedule shows that day with hours (12 am–11 pm) on horizontal axis and staff rows; existing entries appear in correct hour range and row.

- [ ] T015 [US1] Add or refine day picker (date control, prev/next day, Today) in client/src/pages/schedule.tsx
- [ ] T016 [US1] Implement hourly timeline view for selected day: horizontal axis 12 am–11 pm, staff as rows in client/src/pages/schedule.tsx
- [ ] T017 [US1] Fetch schedule entries by date range (GET /api/schedule?startDate&endDate) and render job entries in correct hour columns and staff rows in client/src/pages/schedule.tsx

**Checkpoint**: User Story 1 testable — day selection and hourly grid with existing jobs visible.

---

## Phase 4: User Story 2 – Drag to select time slot and open job picker (Priority: P1)

**Goal**: User can drag on the grid to select a time range, see visual feedback, and open a right sidebar to choose a job and create a schedule entry.

**Independent Test**: Drag on grid → range highlighted → on release right sidebar opens → select job and confirm → schedule entry created with startTime/endTime.

- [ ] T018 [US2] Add pointer handlers (onPointerDown, onPointerMove, onPointerUp, onPointerCancel) for time-range selection on schedule grid in client/src/pages/schedule.tsx
- [ ] T019 [US2] Normalize range to min/max and show visual feedback (e.g. highlight/outline) for selected range in client/src/pages/schedule.tsx
- [ ] T020 [US2] On pointer up, open right sidebar (Sheet) with selected staffId, scheduledDate, startTime, endTime in client/src/pages/schedule.tsx
- [ ] T021 [US2] In right sidebar, list jobs (GET /api/jobs) and on confirm POST /api/schedule with jobId, staffId, scheduledDate, startTime, endTime in client/src/pages/schedule.tsx

**Checkpoint**: User Story 2 testable — drag-select and job assignment from right sidebar.

---

## Phase 5: User Story 3 – Activity entity and CRUD on left sidebar (Priority: P2)

**Goal**: User can list, create, edit, and delete Activity types from the left sidebar; Travel, Admin, Sales appear by default.

**Independent Test**: Open schedule → left sidebar shows Activity list (incl. Travel, Admin, Sales) → create/edit/delete activity and list updates.

- [ ] T022 [P] [US3] Add left sidebar section for Activities: list from GET /api/activities in client/src/pages/schedule.tsx
- [ ] T023 [US3] Implement create Activity (form + POST /api/activities) in left sidebar in client/src/pages/schedule.tsx
- [ ] T024 [US3] Implement edit (PATCH /api/activities/:id) and delete (DELETE /api/activities/:id) Activity in left sidebar in client/src/pages/schedule.tsx

**Checkpoint**: User Story 3 testable — Activity CRUD from left sidebar.

---

## Phase 6: User Story 4 – Assign Activity from schedule (Priority: P2)

**Goal**: User can assign an Activity via the same drag flow; right sidebar offers Jobs and Activities; activity entries are visually distinct on the grid.

**Independent Test**: Drag range → right sidebar → select Activity → confirm → entry appears on grid; activity blocks look different from job blocks.

- [ ] T025 [US4] In right sidebar, add Activities list (GET /api/activities) alongside Jobs in client/src/pages/schedule.tsx
- [ ] T026 [US4] On Activity select and confirm, POST /api/schedule with activityId, staffId, scheduledDate, startTime, endTime in client/src/pages/schedule.tsx
- [ ] T027 [US4] Render schedule entries that have activityId on grid visually distinct from job entries (e.g. label, style, or icon) in client/src/pages/schedule.tsx

**Checkpoint**: User Story 4 testable — assign activity from right sidebar; activities distinguishable on grid.

---

## Phase 7: Polish & Cross-Cutting

**Purpose**: Edge cases and verification

- [ ] T028 [US2] Handle cancel right sidebar: clear selection and close without creating entry in client/src/pages/schedule.tsx
- [ ] T029 [US2] Normalize backward drag to single span (start = min, end = max); support same-hour drag as single-hour slot in client/src/pages/schedule.tsx
- [ ] T030 [P] Run quickstart verification: npm run test:env and manual smoke (day select, hourly grid, drag, right sidebar job/activity, left sidebar Activity CRUD) per specs/002-schedule-drag-job-activity/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1**: No dependencies — start immediately.
- **Phase 2**: Depends on Phase 1 — blocks all user stories.
- **Phase 3 (US1)**: Depends on Phase 2 — can start after foundation (no new backend for US1).
- **Phase 4 (US2)**: Depends on Phase 3 — needs hourly grid to drag on.
- **Phase 5 (US3)**: Depends on Phase 2 — only needs Activities API and left sidebar.
- **Phase 6 (US4)**: Depends on Phase 4 and Phase 5 — right sidebar and Activity list.
- **Phase 7**: Depends on Phase 6 (and earlier) — polish after stories done.

### User Story Dependencies

- **US1 (P1)**: After Phase 2 — no dependency on US2/US3/US4.
- **US2 (P1)**: After US1 — drag and right sidebar build on hourly view.
- **US3 (P2)**: After Phase 2 — independent of US1/US2; can run in parallel with US1/US2.
- **US4 (P2)**: After US2 and US3 — right sidebar shows activities; grid distinguishes activities.

### Parallel Opportunities

- Phase 2: T002, T004, T007, T012 can run in parallel where marked [P].
- Phase 3–4: US3 (Phase 5) can be done in parallel with US1/US2 if multiple developers.
- Phase 5: T022 is [P] within US3.
- Phase 7: T030 is [P].

---

## Parallel Example: Phase 2

```text
# Schema and module setup in parallel:
T002 Create Activity model in shared/models/activities.ts
T004 Extend schedule model in shared/models/schedule.ts
T007 Create server/modules/activities/model.ts
T012 Add server/__tests__/api.activities.test.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1 (Setup).
2. Complete Phase 2 (Foundational).
3. Complete Phase 3 (US1: day selection + hourly view).
4. **STOP and VALIDATE**: Select day, see hourly grid and existing entries.
5. Deploy/demo if desired.

### Incremental Delivery

1. Phase 1 + 2 → foundation and tests passing.
2. Phase 3 (US1) → day + hourly view testable.
3. Phase 4 (US2) → drag + job picker testable.
4. Phase 5 (US3) → Activity CRUD testable.
5. Phase 6 (US4) → assign activity and visual distinction testable.
6. Phase 7 → edge cases and quickstart verification.

### Suggested MVP Scope

- **MVP**: Phase 1 + Phase 2 + Phase 3 (day selection and hourly schedule view). Delivers the base for all other stories.

---

## Notes

- [P] = different files or no dependency on other in-phase tasks.
- [USn] maps task to spec user story for traceability.
- Each user story phase is independently testable per spec.
- Run `npm run test:env` after backend changes (constitution).
- Commit after each task or logical group.
