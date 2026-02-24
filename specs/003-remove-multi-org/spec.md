# Feature Specification: Remove Multi-Organization Support

**Feature Branch**: `003-remove-multi-org`  
**Created**: Tuesday, Feb 24, 2026  
**Status**: Draft  
**Input**: User description: "Initially the project was made to have multiple organizations I want to rip that off totally from the project"

---

## Overview

This feature removes the multi-organization/tenant architecture from the project. The system will transition from supporting multiple distinct organizations (each with their own subscription, settings, members, and isolated data) to a simplified single-organization (or organization-less) model. This reduces complexity, simplifies the data model, and aligns the product with a single-business use case.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Single Organization Simplification (Priority: P1)

As a system administrator or developer, I want the application to operate without the multi-organization complexity so that the codebase is simpler to maintain and understand.

**Why this priority**: This is the core objective - removing the multi-tenant architecture. Without this, the other simplifications cannot happen.

**Independent Test**: Verify that organization-related tables, foreign keys, and APIs are removed or simplified, and that existing data is migrated to work without organization boundaries.

**Acceptance Scenarios**:

1. **Given** the application has organization-related database tables, **When** the migration is complete, **Then** tables that only exist for multi-org support are removed
2. **Given** entities have `organizationId` foreign keys, **When** the migration is complete, **Then** those foreign keys are removed while preserving the data
3. **Given** there were multiple organizations with data, **When** the migration runs, **Then** data from all organizations is accessible (or primary org data is preserved)

---

### User Story 2 - Simplified Authentication & Authorization (Priority: P1)

As a user, I want to log in and access the system without needing to select or be bound to an organization context.

**Why this priority**: Authentication is the entry point to the application. Organization membership currently gates access; this must be simplified.

**Independent Test**: Users can log in and immediately access all features without organization context checks or switching.

**Acceptance Scenarios**:

1. **Given** a user has valid credentials, **When** they log in, **Then** they are authenticated without organization membership validation
2. **Given** a user was previously a member of multiple organizations, **When** they log in after migration, **Then** they can access all data without organization context
3. **Given** a user accesses protected resources, **When** the system checks permissions, **Then** organization membership is not required

---

### User Story 3 - Unified Data Access (Priority: P2)

As a user, I want to see all data (jobs, clients, quotes, invoices) without organization-based filtering so that I have a complete view of my business.

**Why this priority**: After removing org boundaries, data naturally becomes unified. This ensures no data is lost or hidden.

**Independent Test**: Queries return all records regardless of which organization they originally belonged to.

**Acceptance Scenarios**:

1. **Given** jobs existed in multiple organizations, **When** viewing the jobs list, **Then** all jobs are visible
2. **Given** clients existed across organizations, **When** searching clients, **Then** all clients are searchable
3. **Given** quotes were created in different organizations, **When** viewing quotes, **Then** all quotes are accessible

---

### User Story 4 - Admin Experience Without Org Management (Priority: P2)

As an administrator, I want to manage users, settings, and billing without dealing with organization-level abstractions.

**Why this priority**: The admin UX should reflect the simplified model. Org management UI becomes unnecessary.

**Independent Test**: Admin interfaces work without organization selection or org-specific settings.

**Acceptance Scenarios**:

1. **Given** an admin accesses user management, **When** viewing the interface, **Then** there is no organization selector or org-based filtering
2. **Given** an admin configures system settings, **When** saving settings, **Then** they are saved at the global level (not organization-specific)
3. **Given** an admin invites new users, **When** sending invites, **Then** the invite is not tied to an organization

---

### Edge Cases

- **Multiple existing organizations**: Data migration strategy must handle cases where multiple organizations exist with potentially overlapping data (e.g., users in multiple orgs, conflicting slugs)
- **Organization-specific settings**: Settings currently stored per-organization need to be either globalized or migrated to a default set
- **Subscription/billing data**: Organization subscriptions need to be deprecated or migrated to a single-company model
- **Invite codes**: Pending organization invites need to be handled (expired or converted)
- **Role-based access**: Organization member roles (owner, admin, manager, staff) need to be redefined in a non-org context
- **URL structures**: Any URL paths that include organization slugs or IDs need updating

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST remove the `organizations` table and all related data structures that exist solely for multi-tenancy
- **FR-002**: System MUST remove `organizationId` foreign keys from all tables that reference organizations
- **FR-003**: System MUST remove or deprecate organization membership concepts (organizationMembers table, org-based roles)
- **FR-004**: System MUST update authentication to not require organization context validation
- **FR-005**: System MUST migrate existing data so that no data is lost when organization boundaries are removed
- **FR-006**: System MUST remove organization-related API endpoints and middleware
- **FR-007**: System MUST update the frontend to remove organization selection UI and organization-scoped features
- **FR-008**: System MUST handle organization settings migration (convert org settings to global/app settings)
- **FR-009**: System MUST update authorization logic to work without organization membership checks
- **FR-010**: System MUST preserve user roles/permissions in a simplified non-org context

### Key Entities *(simplified after org removal)*

- **User**: Represents an individual who can access the system. Previously linked via organizationMembers, now has direct system access.
- **Settings**: Global application settings (previously organizationSettings). Single configuration for the entire system.
- **Job**: Work items - no longer scoped to organizations, unified across the system.
- **Client**: Customer records - accessible globally without org boundaries.
- **Quote/Invoice**: Financial documents - unified across the system.
- **StaffProfile**: Employee/tradesman profiles - associated with users directly.

**Removed Entities**:
- Organization (removed entirely)
- OrganizationSubscription (removed - billing model changes)
- OrganizationMember (removed - users access system directly)
- OrganizationInvite (removed - invite system simplified)
- OrganizationCounter (removed or migrated to global counters)

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The database schema contains zero tables with "organization" in the name
- **SC-002**: All tables that previously had `organizationId` foreign keys no longer have them
- **SC-003**: Users can log in and access all features without any organization context or selection
- **SC-004**: No organization-related API endpoints remain in the codebase
- **SC-005**: Frontend UI contains no organization selection, switching, or management interfaces
- **SC-006**: 100% of existing data is accessible after migration (no orphaned records or data loss)
- **SC-007**: The codebase has zero imports or references to organization models in shared/schema
- **SC-008**: All tests pass after removing organization-related test cases and fixtures
- **SC-009**: Authentication middleware performs no organization membership validation
- **SC-010**: The system operates correctly with a simplified, single-tenant architecture

---

## Assumptions

1. The target deployment is for a single business entity, not a SaaS platform serving multiple unrelated businesses
2. Existing data from multiple organizations can be unified (no data segregation requirements remain)
3. Users who were members of multiple organizations will have unified access to all data
4. Subscription/billing will be handled externally or simplified - no multi-tenant billing logic needed
5. Role-based permissions will be simplified to system-level roles (admin, manager, staff) without org scoping

---

## Dependencies

- Database migration framework (Drizzle ORM migrations)
- Existing authentication system (to be simplified)
- Frontend routing and state management (to remove org context)
- Test suite (tests need updating for new auth model)

---

## Out of Scope

- New feature development (this is a removal/simplification task)
- UI/UX redesign beyond removing organization-specific elements
- Changes to core business logic (jobs, quotes, invoices functionality remains)
- Data export capabilities for organization separation (assumes unification is acceptable)
