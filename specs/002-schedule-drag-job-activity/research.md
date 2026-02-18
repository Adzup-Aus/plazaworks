# Research: Schedule Drag-to-Select and Activity Entity

**Feature**: 002-schedule-drag-job-activity  
**Date**: 2026-02-18

## 1. Pointer and touch drag for time-range selection (React)

**Decision**: Use native pointer events (`onPointerDown`, `onPointerMove`, `onPointerUp` / `onPointerCancel`) on the schedule grid to implement drag-to-select. Normalize backward drags to a span (start = min, end = max). Use a single-hour minimum span when start and end resolve to the same hour.

**Rationale**: Pointer events unify mouse and touch in one API and are supported in modern browsers. No need for a heavy drag library when the interaction is "select range on grid" rather than drag-and-drop of DOM nodes. Prevents duplicate handling and avoids touch delay issues.

**Alternatives considered**:
- **Mouse + touch events separately**: More code and risk of drift between behaviors; rejected.
- **react-dnd or dnd-kit**: Suited for dragging entities between lists; overkill for drawing a range on a grid; rejected.
- **Third-party scheduler (FullCalendar, etc.)**: Would dictate data model and UI; we need to extend existing schedule page and constitution-aligned APIs; rejected for this feature.

---

## 2. Right sidebar: job/activity picker after range selection

**Decision**: Use a slide-out panel (e.g. Sheet or SlideOver from Radix/shadcn) that opens on the right when the user completes a time-range selection. Panel shows two sections or tabs: Jobs and Activities. User selects one item and confirms to create the schedule entry; cancel closes the panel and clears the selection.

**Rationale**: Matches spec ("right sidebar would appear to select the job") and keeps the main grid focused. Reusing existing UI primitives (Sheet, ScrollArea, list) keeps consistency and accessibility.

**Alternatives considered**:
- **Modal dialog**: Blocks the whole view; sidebar is lighter and keeps context.
- **Inline dropdown on the grid**: Awkward for long job/activity lists and small touch targets; rejected.

---

## 3. Activity as separate entity and schedule entry polymorphism

**Decision**: Introduce an `activities` table (id, name, optional fields, org-scoped if multi-tenant). Schedule entries get an optional `activityId`; `jobId` becomes optional. Enforce at application and validation level: exactly one of `jobId` or `activityId` must be set. Existing schedule entries keep `jobId` set and `activityId` null.

**Rationale**: Clean separation of "activity type" (Travel, Admin, Sales) from "schedule slot assignment." Same schedule table can represent both job and activity slots; backend and storage already support filtering by date and staff.

**Alternatives considered**:
- **Separate table for "activity schedule entries"**: Duplicates logic and reporting; rejected.
- **Job type "activity" with a flag**: Blurs jobs and activities; spec calls out Activity as its own entity with CRUD; rejected.

---

## 4. Default activities (Travel, Admin, Sales)

**Decision**: Seed the three default activities via a migration or a seed step that runs when the app (or migration) is applied. If the table is empty, insert Travel, Admin, Sales so they are available immediately after deployment (SC-004).

**Rationale**: Spec requires "ship with three default Activity records." Migration/seed is the standard way to bootstrap reference data.

**Alternatives considered**:
- **Hardcoded in UI only**: Would not appear in API or for other clients; rejected.
- **Admin-only "create defaults" button**: Adds a step and can be forgotten; seed is automatic; preferred.
