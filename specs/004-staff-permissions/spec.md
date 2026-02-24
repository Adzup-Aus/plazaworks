# Feature Specification: Functional Staff Permission System

**Feature Branch**: `004-staff-permissions`  
**Created**: February 24, 2026  
**Status**: Draft  
**Input**: User description: "Create a functional staff permission system. Currently permissions can be added to staff members but they are not functional. Staff members should only see sections they have permission for (dashboard, jobs, quotes, etc.). Dashboard should be invisible only for admin and those who have permission. Permissions should control view, create, delete actions for each section."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin Configures Staff Permissions (Priority: P1)

As an admin, I want to assign specific permissions to each staff member so that they can only access the sections and perform the actions they are authorized for.

**Why this priority**: This is the foundational capability that enables all other permission-related functionality. Without the ability to configure permissions, no access control can exist.

**Independent Test**: Can be fully tested by navigating to the Team page, editing a staff member, and toggling permissions on/off. The system should persist these changes and reflect them in subsequent sessions.

**Acceptance Scenarios**:

1. **Given** an admin is on the Team management page, **When** they edit a staff member and assign permissions (e.g., "View Jobs", "Create Jobs"), **Then** those permissions are saved and associated with the staff member's profile.

2. **Given** an admin has assigned permissions to a staff member, **When** the staff member logs in, **Then** they can only see navigation items and perform actions matching their assigned permissions.

3. **Given** a staff member has no permissions assigned, **When** they attempt to access any protected section, **Then** they see an access denied message or are redirected to an appropriate page.

---

### User Story 2 - Staff Member Views Authorized Sections Only (Priority: P1)

As a staff member, I want to see only the navigation sections and pages I have permission for so that I'm not overwhelmed with options I cannot use.

**Why this priority**: This directly addresses the user's stated need to hide sections staff members shouldn't see. It's a core security and UX requirement.

**Independent Test**: Can be fully tested by logging in as a staff member with limited permissions and verifying that only authorized navigation items appear. Unauthorized sections should be completely hidden from the UI.

**Acceptance Scenarios**:

1. **Given** a staff member has "View Jobs" permission but no "View Quotes" permission, **When** they view the navigation menu, **Then** they see Jobs but do not see Quotes.

2. **Given** a staff member does not have "View Dashboard" permission and is not an admin, **When** they log in, **Then** the Dashboard section is hidden from navigation and they are redirected to their first authorized section.

3. **Given** a staff member attempts to access a URL for a section they don't have permission for, **When** the page loads, **Then** they are redirected to an authorized page or shown an access denied message.

---

### User Story 3 - Staff Member Performs Authorized Actions Only (Priority: P1)

As a staff member, I want action buttons (Create, Edit, Delete) to be hidden or disabled for sections where I don't have those specific permissions so that I don't attempt actions I'm not authorized to perform.

**Why this priority**: This prevents unauthorized data modifications and provides clear visual feedback about what a user can and cannot do, reducing confusion and support requests.

**Independent Test**: Can be fully tested by navigating to a section with "View" permission but without "Create" or "Delete" permissions, and verifying that the corresponding action buttons are not visible or are disabled.

**Acceptance Scenarios**:

1. **Given** a staff member has "View Jobs" permission but not "Create Jobs" permission, **When** they are on the Jobs page, **Then** the "Create Job" button is not visible.

2. **Given** a staff member has "View Jobs" permission but not "Delete Jobs" permission, **When** they view a job, **Then** the "Delete" button or action is not available.

3. **Given** a staff member has "View Jobs" and "Edit Jobs" permissions, **When** they view a job, **Then** the "Edit" button is visible and functional.

---

### User Story 4 - Backend Enforces Permission Checks (Priority: P2)

As a system administrator, I want the backend API to enforce permission checks so that even if someone bypasses the UI, they cannot perform unauthorized actions.

**Why this priority**: While frontend restrictions improve UX, backend enforcement is essential for security. However, this can be built incrementally after frontend controls are in place.

**Independent Test**: Can be fully tested by making direct API requests without proper permissions and verifying that the API returns 403 Forbidden responses.

**Acceptance Scenarios**:

1. **Given** a staff member does not have "Create Jobs" permission, **When** they send a direct API request to create a job, **Then** the API returns a 403 Forbidden error.

2. **Given** a staff member does not have "Delete Users" permission, **When** they send a direct API request to delete a user, **Then** the API returns a 403 Forbidden error and the user is not deleted.

---

### Edge Cases

- **Permission revocation in real-time**: What happens when an admin removes a permission while a staff member is actively using the application? The system should check permissions on each navigation/action and redirect/deny as appropriate.

- **Admin override**: Should admin role automatically grant all permissions? The specification states "Dashboard should be invisible only for admin and those who have permission" - suggesting admins have special visibility rights.

- **Default permissions for new staff**: What permissions should new staff members have by default? Should they have no permissions (most secure) or a basic set of view permissions?

- **Permission inheritance**: If a user has "Create Jobs" permission, should they automatically have "View Jobs" permission? The system should enforce logical permission dependencies.

- **Batch permission changes**: How should the system handle updating permissions for multiple staff members at once?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow admins to assign granular permissions to each staff member including: view, create, edit, and delete permissions for each major section (Dashboard, Jobs, Quotes, Users, Schedule, Reports, Settings).

- **FR-002**: The system MUST hide navigation menu items for sections where the logged-in staff member does not have "view" permission.

- **FR-003**: The system MUST hide the Dashboard section from staff members who do not have "view_dashboard" permission AND are not admin users.

- **FR-004**: The system MUST hide or disable action buttons (Create, Edit, Delete) when the staff member does not have the corresponding permission for that action.

- **FR-005**: The system MUST redirect staff members to their first authorized section if they attempt to access a URL for a section they don't have permission for.

- **FR-006**: The system MUST display an appropriate "Access Denied" message when a staff member attempts to perform an action they don't have permission for.

- **FR-007**: The system MUST check permissions on the backend for all API endpoints and return 403 Forbidden for unauthorized requests.

- **FR-008**: The system MUST cache permission checks appropriately to maintain performance while ensuring permission changes take effect within a reasonable time (e.g., on next page load or within 5 minutes).

- **FR-009**: The system SHOULD automatically grant "view" permission when "create", "edit", or "delete" permissions are assigned (logical dependency enforcement).

- **FR-010**: The system MUST make permission checks available through a reusable hook or utility function for consistent implementation across components.

### Key Entities *(include if feature involves data)*

- **StaffProfile**: Represents a staff member's extended profile including their assigned permissions array.
  - Key attributes: userId, roles, permissions (array of permission strings)
  - Relationships: Links to User entity

- **Permission**: Represents a specific capability within the system.
  - Currently defined permissions include: view_jobs, create_jobs, edit_jobs, delete_jobs, view_users, create_users, edit_users, delete_users, view_schedule, manage_schedule, view_reports, admin_settings
  - May need expansion to include: view_quotes, create_quotes, edit_quotes, delete_quotes, view_dashboard

- **UserSession**: The authenticated user's session that should include their resolved permissions for quick access control checks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of navigation sections respect permission settings - unauthorized sections are never visible to staff members without appropriate permissions.

- **SC-002**: 100% of action buttons (Create, Edit, Delete) respect permission settings - unauthorized actions are never accessible through the UI.

- **SC-003**: 100% of API endpoints enforce permission checks - direct API requests without proper permissions are rejected with 403 Forbidden responses.

- **SC-004**: Permission changes take effect within 5 minutes or on next page navigation, whichever comes first.

- **SC-005**: Staff members with no permissions assigned see only a minimal interface with an appropriate message explaining they need permissions assigned.

- **SC-006**: Admin users maintain full access to all sections regardless of explicit permission assignments, with the exception that Dashboard visibility follows the explicit permission rule (only visible to admin or those with view_dashboard permission).

## Assumptions

1. **Permission model**: Permissions are stored as an array of strings on the staff profile, matching the current schema.

2. **Admin role**: Users with the "admin" role have elevated privileges and can see all sections, though Dashboard visibility is explicitly controlled.

3. **Permission granularity**: Permissions are defined at the section level (Jobs, Quotes, etc.) with action-level granularity (view, create, edit, delete).

4. **No negative permissions**: The system uses a whitelist approach - staff members only have access to what they're explicitly granted permission for.

5. **Permission UI exists**: The Team page already has UI for editing permissions; this feature focuses on making those permissions functional throughout the application.
