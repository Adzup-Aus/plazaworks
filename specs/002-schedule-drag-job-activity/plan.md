# Implementation Plan: Schedule Drag-to-Select and Activity Entity

**Branch**: `002-schedule-drag-job-activity` | **Date**: 2026-02-18 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/002-schedule-drag-job-activity/spec.md`

## Summary

Implement a polished schedule experience: (1) day selection with hourly timeline view, (2) drag-to-select time range (mouse and touch) with visual feedback, (3) right sidebar to assign a Job or Activity to the selected range and staff row, and (4) new Activity entity with full CRUD in the left sidebar and three default records (Travel, Admin, Sales). Schedule entries may reference either a Job or an Activity; activities are visually distinct on the grid.

## Technical Context

**Language/Version**: TypeScript (ESM), Node 18+  
**Primary Dependencies**: Express, React 18, Vite, Drizzle ORM, TanStack Query, Radix UI (shadcn), Tailwind CSS, Wouter  
**Storage**: PostgreSQL via Drizzle; schema in `shared/models/`, re-exported in `shared/schema.ts`  
**Testing**: Vitest; API tests in `server/__tests__/api.<feature>.test.ts`; run `npm run test:env` after changes  
**Target Platform**: Web (desktop and mobile browsers)  
**Project Type**: Web (monorepo: `server/`, `client/`, `shared/`)  
**Performance Goals**: Responsive drag interaction; schedule grid and sidebars load without noticeable delay  
**Constraints**: Schedule module and shared schema must follow constitution; touch and mouse must share the same interaction model  
**Scale/Scope**: Single-tenant per org; schedule entries and activities at typical trade-business volume

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Rule | Status | Notes |
|------|--------|--------|
| Backend: feature under `server/modules/<featureName>/` with `routes.ts` + `model.ts` | PASS | Schedule module exists; Activity CRUD and schedule extensions live in `server/modules/schedule/` and new `server/modules/activities/` or activities in schedule module per constitution. |
| New tables in `shared/schema.ts` or `shared/models/<domain>.ts` | PASS | Activity table in `shared/models/activities.ts` (or `schedule.ts`); re-export from `shared/schema.ts`. |
| Module registered in `server/routes/index.ts` | PASS | Register activities routes if separate module; otherwise extend schedule module. |
| API tests in `server/__tests__/api.<feature>.test.ts` | PASS | Add/update tests for activities API and schedule entry with activityId. |
| `npm run test:env` after changes | PASS | Required before merge. |
| Frontend: new screens in `client/src/pages/`, Route in App.tsx | PASS | Schedule page exists; enhance in place. No new route required. |
| Data via TanStack Query, types from `@shared/schema` | PASS | Use queryKey `/api/schedule`, `/api/activities`; types from shared. |
| UI from `@/components/ui/`, Tailwind, theme tokens | PASS | Use existing components; add sheet/sidebar for right panel, left sidebar section for Activity CRUD. |

**Structure Decision**: Extend existing `server/modules/schedule/` for schedule API changes; add new `server/modules/activities/` with `routes.ts` and `model.ts` for Activity CRUD (or keep activities in schedule module—see data-model). Frontend: single schedule page with day picker, hourly grid, drag-to-select, right sidebar (job/activity picker), left sidebar section for Activity list and CRUD.

## Project Structure

### Documentation (this feature)

```text
specs/002-schedule-drag-job-activity/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI or schema snippets)
└── tasks.md             # Phase 2 output (/speckit.tasks - not created by plan)
```

### Source Code (repository root)

```text
server/
├── modules/
│   ├── schedule/           # Extend: support activityId, startTime/endTime from drag
│   │   ├── routes.ts
│   │   └── model.ts
│   └── activities/        # New: Activity CRUD
│       ├── routes.ts
│       └── model.ts
├── routes/
│   └── index.ts           # Register activities routes
└── __tests__/
    ├── api.schedule.test.ts  # Update for activity assignment
    └── api.activities.test.ts # New

shared/
└── models/
    ├── schedule.ts        # Extend: activityId optional, jobId optional (one required)
    └── activities.ts      # New: activities table

client/src/
├── pages/
│   └── schedule.tsx       # Extend: day picker, hourly grid, drag-select, right sidebar, left Activity CRUD
└── components/           # Optional: ScheduleGrid, TimeRangeSidebar, ActivitySidebar
```

## Complexity Tracking

*(No constitution violations requiring justification.)*
