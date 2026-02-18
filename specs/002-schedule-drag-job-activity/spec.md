# Feature Specification: Schedule Drag-to-Select and Activity Entity

**Feature Branch**: `002-schedule-drag-job-activity`  
**Created**: 2026-02-18  
**Status**: Draft  
**Input**: User description: "Polish schedule: day selection, hourly view, drag to select end hour, right sidebar to select job. Add Activity entity with CRUD on left sidebar; initial records Travel, Admin, Sales."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Day selection and hourly schedule view (Priority: P1)

As a user, I can select a day and see the schedule as an hourly timeline so that I can plan and view assignments by hour.

**Why this priority**: Day and hour view is the foundation; without it, time-slot selection is meaningless.

**Independent Test**: Can be fully tested by selecting a day and verifying the schedule displays with hours (e.g. 12 am through 11 pm) and any existing assignments shown in the correct hour columns.

**Acceptance Scenarios**:

1. **Given** I am on the schedule screen, **When** I choose a date (e.g. via date picker or prev/next day), **Then** the schedule shows that day with a horizontal hourly timeline.
2. **Given** a day is selected, **When** I view the schedule, **Then** hours are clearly shown (e.g. 12 am, 1 am, … 11 pm) and staff/rows are visible.
3. **Given** there are existing jobs or activities on that day, **When** I view the schedule, **Then** they appear in the correct hour range and staff row.

---

### User Story 2 - Drag to select time slot and open job picker (Priority: P1)

As a user, I can press down (mouse or touch) on the schedule grid and drag to an end hour, then see a right sidebar to select a job, so that I can quickly assign a job to a time range and staff member.

**Why this priority**: This is the core interaction for scheduling jobs from the timeline.

**Independent Test**: Can be tested by performing a click-and-drag on the grid, confirming a time range is selected (e.g. visual feedback), and confirming a right sidebar opens with job selection options.

**Acceptance Scenarios**:

1. **Given** a day is selected and the hourly grid is visible, **When** I press down on a cell (or hour) and drag to another hour, **Then** the system selects a continuous time range (start hour to end hour) and shows clear visual feedback (e.g. highlight or outline).
2. **Given** I have just completed a drag to select a time range on a staff row, **When** I release, **Then** a right sidebar opens.
3. **Given** the right sidebar is open after a time selection, **When** I view it, **Then** I can choose a job to assign to that time range and staff (and completing selection creates or updates the schedule entry).
4. **Given** I am on a touch device, **When** I touch and drag across hours, **Then** the same time-selection and right-sidebar behavior works (touch-friendly).

---

### User Story 3 - Activity entity and CRUD on left sidebar (Priority: P2)

As a user, I can manage Activity types (e.g. Travel, Admin, Sales) from the left sidebar so that I can categorize and schedule unbillable activities alongside jobs.

**Why this priority**: Activities support scheduling non-job time; CRUD must exist before users can assign activities from the right sidebar.

**Independent Test**: Can be tested by opening the schedule, using the left sidebar to create, read, update, and delete Activity records, and verifying the three initial activities (Travel, Admin, Sales) exist.

**Acceptance Scenarios**:

1. **Given** I am on the schedule screen, **When** I use the left sidebar, **Then** I can view a list of Activity types (including at least Travel, Admin, Sales initially).
2. **Given** the Activity list is visible, **When** I create a new Activity, **Then** I can enter a name (and any required fields) and save, and the new activity appears in the list.
3. **Given** an Activity exists, **When** I edit it from the left sidebar, **Then** I can change its details and save, and the list reflects the change.
4. **Given** an Activity exists and is not in use in a way that prevents removal, **When** I delete it from the left sidebar, **Then** it is removed from the list and no longer available for assignment.

---

### User Story 4 - Assign Activity from schedule (Priority: P2)

As a user, I can assign an Activity (e.g. Travel, Admin, Sales) to a time slot using the same drag-and-select flow, so that unbillable time is visible on the schedule.

**Why this priority**: Completes the value of the Activity entity by allowing it to be scheduled like jobs.

**Independent Test**: Can be tested by dragging a time range, opening the right sidebar, and selecting an Activity instead of a job; the schedule then shows the activity in that range.

**Acceptance Scenarios**:

1. **Given** I have dragged to select a time range and the right sidebar is open, **When** I view the sidebar, **Then** I can choose either a Job or an Activity to assign.
2. **Given** I choose an Activity from the right sidebar for the selected range and staff, **When** I confirm, **Then** the schedule shows that activity in the selected time range and row.
3. **Given** an Activity is scheduled, **When** I view the schedule, **Then** it is visually distinguishable from jobs (e.g. label or style) so users can tell activities from jobs at a glance.

---

### Edge Cases

- What happens when the user drags backwards (end hour before start hour)? System treats the selection as the span between the two times (e.g. normalize to start = min, end = max).
- What happens when the user cancels the right sidebar without selecting a job or activity? No schedule entry is created; the selection is cleared.
- What happens when the selected time range overlaps existing assignments? System either prevents overlap, or allows and shows conflict/overlap according to business rules; behavior must be consistent and clear.
- How does the system handle very small drags (e.g. same hour)? Either treat as a single-hour slot or require a minimum span; behavior must be defined and consistent.
- What happens when an Activity is deleted but is already assigned to schedule slots? System either prevents deletion while in use, or reassigns/removes those slots; behavior must be defined and consistent.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST let the user select the day to display (e.g. date control or navigation to previous/next day and today).
- **FR-002**: System MUST display the schedule for the selected day as an hourly timeline (hours visible on the horizontal axis).
- **FR-003**: System MUST allow the user to select a time range by pointer/touch: press down on the grid and drag to an end hour, with clear visual feedback for the selected range.
- **FR-004**: System MUST open a right sidebar when the user completes a time-range selection, from which the user can select a Job or an Activity to assign to that range and staff row.
- **FR-005**: System MUST support assigning the selected job or activity to the chosen time range and staff row and persist the schedule entry.
- **FR-006**: System MUST provide full CRUD for the Activity entity from the left sidebar (list, create, edit, delete).
- **FR-007**: System MUST ship with three default Activity records: Travel, Admin, Sales.
- **FR-008**: System MUST display scheduled jobs and activities on the schedule grid in the correct hour range and staff row, with a clear way to distinguish activities from jobs.
- **FR-009**: System MUST support the same time-range selection interaction on touch devices (mobile) as on desktop (mouse).

### Key Entities

- **Schedule (existing)**: Represents assignments of staff to time slots; may reference a Job or an Activity.
- **Job (existing)**: Assignable work item; user can select from the right sidebar to assign to a time range.
- **Activity**: A type of unbillable activity (e.g. Travel, Admin, Sales). Has a name and is manageable via CRUD in the left sidebar. Can be assigned to schedule slots like a job. Initially populated with Travel, Admin, Sales.

## Assumptions

- The schedule already has a concept of staff/rows and day view; this feature refines the day/hour view and adds drag-to-select plus right-sidebar assignment.
- "Left sidebar" includes the existing staff/list area; Activity CRUD is presented in that sidebar (e.g. a section or panel).
- "Right sidebar" is a panel that opens after a time-range selection and shows jobs and activities; user selects one to assign.
- Normalization of drag direction (backward drag) is done by treating the range as the span between the two times.
- Overlap handling (allowing vs preventing overlapping assignments) follows existing or newly defined business rules and is applied consistently.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can select a day and see the schedule with hourly columns in a single action.
- **SC-002**: Users can create a schedule entry by drag-selecting a time range and choosing a job or activity from the right sidebar in under 15 seconds.
- **SC-003**: Users can perform Activity CRUD (create, edit, delete, list) entirely from the left sidebar without leaving the schedule view.
- **SC-004**: The three default activities (Travel, Admin, Sales) are available for assignment immediately after deployment.
- **SC-005**: Time-range selection works on both mouse and touch without requiring a different flow.
