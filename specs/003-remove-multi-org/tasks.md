# Tasks: Remove Multi-Organization Support

**Feature**: Remove Multi-Organization Support  
**Branch**: `003-remove-multi-org`  
**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

---

## Overview

This task list removes the multi-tenant organization architecture from Plaza Works. Tasks are organized by user story priority (P1 = highest) and dependency order.

**User Stories**:
- **US1** (P1): Single Organization Simplification - Database schema changes
- **US2** (P1): Simplified Authentication - Auth middleware and session handling
- **US3** (P2): Unified Data Access - Backend API and storage updates
- **US4** (P2): Admin Experience - Frontend updates and settings management

**Tech Stack**: TypeScript 5.x, Node.js 20+, Express.js, Drizzle ORM, PostgreSQL, React 18, TanStack Query

---

## Phase 1: Setup & Backup

**Goal**: Ensure safe rollback and project readiness

- [ ] T001 Create database backup before migration
- [ ] T002 Verify all tests pass on current main branch with `npm run test:env`
- [ ] T003 [P] Create rollback script for database restoration

---

## Phase 2: Foundational Database Changes (US1)

**User Story 1**: Single Organization Simplification (Priority: P1)  
**Independent Test Criteria**: Database schema contains zero organization tables; All organizationId FKs removed; Data preserved

### Database Schema Updates

- [ ] T004 [US1] Create Drizzle migration to add `app_settings` table in `shared/models/settings.ts`
- [ ] T005 [US1] Create migration to copy organization settings to global `app_settings` record
- [ ] T006 [US1] Remove `organizationId` column from `clients` table
- [ ] T007 [US1] Remove `organizationId` column from `quotes` table
- [ ] T008 [US1] Remove `organizationId` column from `invoices` table
- [ ] T009 [US1] Remove `organizationId` column from `vehicles` table
- [ ] T010 [US1] Remove `organizationId` column from `checklistTemplates` table
- [ ] T011 [US1] Remove `organizationId` column from `termsTemplates` table
- [ ] T012 [US1] Create migration to drop `organizationCounters` table
- [ ] T013 [US1] Create migration to drop `organizationInvites` table
- [ ] T014 [US1] Create migration to drop `organizationMembers` table
- [ ] T015 [US1] Create migration to drop `organizationSettings` table
- [ ] T016 [US1] Create migration to drop `organizationSubscriptions` table
- [ ] T017 [US1] Create migration to drop `organizations` table
- [ ] T018 [US1] [P] Run database migrations in development environment
- [ ] T019 [US1] Verify data integrity after migration (no orphaned records)

### Schema Code Updates

- [ ] T020 [US1] Create new `shared/models/settings.ts` with appSettings table definition
- [ ] T021 [US1] Update `shared/schema.ts` to export appSettings
- [ ] T022 [US1] Update `shared/schema.ts` to remove organization table exports
- [ ] T023 [US1] Simplify `shared/models/organizations.ts` - keep only auth-related tables
- [ ] T024 [US1] Remove organization counter exports from shared schema

---

## Phase 3: Authentication Simplification (US2)

**User Story 2**: Simplified Authentication & Authorization (Priority: P1)  
**Independent Test Criteria**: Users can login without organization validation; No org context in auth middleware; Auth endpoints return user+role only

**Depends on**: Phase 2 (database changes must be complete)

### Middleware Updates

- [ ] T025 [US2] Remove `withOrganization` middleware from `server/middleware/index.ts`
- [ ] T026 [US2] Remove `requireFeature` middleware (subscription tier checking)
- [ ] T027 [US2] Remove `checkUserLimit` middleware from `server/middleware/index.ts`
- [ ] T028 [US2] Remove `checkJobLimit` middleware from `server/middleware/index.ts`
- [ ] T029 [US2] Update `requireSuperAdmin` to check user role directly (not org ownership)
- [ ] T030 [US2] Remove organization exports from `server/routes/shared.ts`
- [ ] T031 [US2] Update Request type definition to remove organizationId, organizationRole

### Auth Routes Updates

- [ ] T032 [US2] Update `server/modules/auth/routes.ts` to not require organization context
- [ ] T033 [US2] Modify `/api/auth/me` response to return user role instead of memberships
- [ ] T034 [US2] Update auth storage methods to not check organization membership

### Session Handling

- [ ] T035 [US2] Update session middleware to not attach organization context
- [ ] T036 [US2] [P] Test authentication flow - register, login, logout

---

## Phase 4: Backend API Simplification (US3)

**User Story 3**: Unified Data Access (Priority: P2)  
**Independent Test Criteria**: All entity endpoints return data without organization filtering; No org-related API endpoints remain

**Depends on**: Phase 2, Phase 3

### Storage Layer Updates

- [ ] T037 [US3] Remove organization storage methods from `server/storage.ts` interface
- [ ] T038 [US3] Remove `getOrganization` method implementation
- [ ] T039 [US3] Remove `getOrganizations` method implementation
- [ ] T040 [US3] Remove `createOrganization` method implementation
- [ ] T041 [US3] Remove `updateOrganization` method implementation
- [ ] T042 [US3] Remove `getOrganizationBySlug` method implementation
- [ ] T043 [US3] Remove subscription-related storage methods
- [ ] T044 [US3] Remove organization member storage methods
- [ ] T045 [US3] Remove organization invite storage methods
- [ ] T046 [US3] Remove organization settings storage methods
- [ ] T047 [US3] Remove organization counter storage methods
- [ ] T048 [US3] Add `getSettings()` method to storage interface
- [ ] T049 [US3] Add `updateSettings()` method to storage interface
- [ ] T050 [US3] Update `getClients()` to not filter by organizationId
- [ ] T051 [US3] Update `getQuotes()` to not filter by organizationId
- [ ] T052 [US3] Update `getInvoices()` to not filter by organizationId
- [ ] T053 [US3] Update `getActivities()` to not require organizationId parameter

### Remove Organization Module

- [ ] T054 [US3] Delete `server/modules/organizations/routes.ts`
- [ ] T055 [US3] Delete `server/modules/organizations/model.ts`
- [ ] T056 [US3] Remove `server/modules/organizations/` directory
- [ ] T057 [US3] Remove organization routes registration from `server/routes/index.ts`

### Update Route Modules

- [ ] T058 [US3] [P] Update `server/modules/clients/routes.ts` to remove organization filtering
- [ ] T059 [US3] [P] Update `server/modules/quotes/routes.ts` to remove organization context
- [ ] T060 [US3] [P] Update `server/modules/invoices/routes.ts` to remove organization context
- [ ] T061 [US3] [P] Update `server/modules/activities/routes.ts` to remove organizationId parameter
- [ ] T062 [US3] [P] Update `server/modules/vehicles/routes.ts` to remove organization filtering
- [ ] T063 [US3] Update `server/modules/clientPortal/routes.ts` to work without organization context

### New Settings Module

- [ ] T064 [US3] Create `server/modules/settings/routes.ts` with GET/PUT endpoints
- [ ] T065 [US3] Create `server/modules/settings/model.ts` re-exporting from shared/schema
- [ ] T066 [US3] Register settings routes in `server/routes/index.ts`

### Numbering Service

- [ ] T067 [US3] Update `server/services/numberingService.ts` to use global counters
- [ ] T068 [US3] Remove organizationId parameter from numbering methods

---

## Phase 5: Frontend Updates (US4)

**User Story 4**: Admin Experience Without Org Management (Priority: P2)  
**Independent Test Criteria**: Admin page shows global settings; No organization selection UI; Settings update works globally

**Depends on**: Phase 3, Phase 4

### Auth Hook Updates

- [ ] T069 [US4] Remove organization from auth state in `client/src/hooks/use-auth.tsx`
- [ ] T070 [US4] Remove organizationId from auth context
- [ ] T071 [US4] Update login/logout to not handle organization context
- [ ] T072 [US4] Update user type to include role field

### API Client Updates

- [ ] T073 [US4] Remove organizationId from API request headers/context
- [ ] T074 [US4] Update TanStack Query keys to remove organization parameters
- [ ] T075 [US4] Create settings API hooks for global settings

### Page Component Updates

- [ ] T076 [US4] [P] Update `client/src/pages/clients.tsx` to not filter by organization
- [ ] T077 [US4] [P] Update `client/src/pages/quotes.tsx` to not use organization context
- [ ] T078 [US4] [P] Update `client/src/pages/invoices.tsx` to not use organization context
- [ ] T079 [US4] [P] Update `client/src/pages/jobs.tsx` to not use organization context
- [ ] T080 [US4] Update `client/src/pages/admin.tsx` to manage global settings
- [ ] T081 [US4] Remove organization management UI from admin page
- [ ] T082 [US4] Add global settings form to admin page

### Component Cleanup

- [ ] T083 [US4] Remove organization switcher component if exists
- [ ] T084 [US4] Remove organization selector from any forms
- [ ] T085 [US4] Update `client/src/App.tsx` to remove organization provider

---

## Phase 6: Testing & Verification

**Goal**: Ensure all functionality works without organization context

**Depends on**: All previous phases

### Test Updates

- [ ] T086 Update `server/__tests__/api.activities.test.ts` to not use organization
- [ ] T087 Update `server/__tests__/api.invoices.test.ts` to not use organization
- [ ] T088 Update `server/__tests__/api.quotes.test.ts` to not use organization
- [ ] T089 Update `server/__tests__/storage.jobs.test.ts` to not use organization
- [ ] T090 Update `server/__tests__/storage.schedule.test.ts` to not use organization
- [ ] T091 Update `server/__tests__/storage.invoices.test.ts` to not use organization
- [ ] T092 Update `server/__tests__/storage.quotes.test.ts` to not use organization
- [ ] T093 [P] Remove organization fixtures from test setup

### Verification

- [ ] T094 Run `npm run test:env` and fix any failing tests
- [ ] T095 Test user registration and login flow
- [ ] T096 Test CRUD operations on all entities (clients, jobs, quotes, invoices)
- [ ] T097 Test settings management in admin panel
- [ ] T098 Test quote/invoice number generation
- [ ] T099 [P] Verify no organization-related console errors

---

## Phase 7: Cleanup

**Goal**: Remove remaining organization references

**Depends on**: All previous phases complete and tests passing

- [ ] T100 Update `scripts/seed-admin.ts` to not create organization
- [ ] T101 Update `scripts/seed-default-activities.ts` to not use organization
- [ ] T102 Remove organization-related imports from all files
- [ ] T103 Update README.md to remove multi-tenant references
- [ ] T104 [P] Search codebase for remaining "organization" references and remove
- [ ] T105 Final verification: `npm run test:env` passes
- [ ] T106 Final verification: Application builds without errors

---

## Dependency Graph

```
Phase 1: Setup
    │
    ▼
Phase 2: Database (US1) ─────────────────────┐
    │                                          │
    ▼                                          │
Phase 3: Authentication (US2)                 │
    │                                          │
    ▼                                          │
Phase 4: Backend API (US3) ◄──────────────────┘
    │
    ▼
Phase 5: Frontend (US4)
    │
    ▼
Phase 6: Testing
    │
    ▼
Phase 7: Cleanup
```

**Key Dependencies**:
- T004-T024 (Database schema) → ALL other tasks
- T025-T036 (Auth middleware) → T058-T063 (Route modules)
- T037-T067 (Storage) → T058-T063 (Route modules)
- T054-T057 (Remove org module) → T064-T066 (Settings module)
- T069-T085 (Frontend auth) → T080-T082 (Admin page)

---

## Parallel Execution Opportunities

**Within US1 (Database)**:
- T006-T011 (Remove FKs) can run in parallel
- T012-T017 (Drop tables) can run in parallel after FKs removed

**Within US3 (Backend API)**:
- T058-T062 (Update route modules) can run in parallel

**Within US4 (Frontend)**:
- T076-T079 (Update pages) can run in parallel

---

## MVP Scope

**Minimum Viable Product** (Just US1 + US2 + basic US3):

1. Complete Phase 2 (Database changes) - T004-T024
2. Complete Phase 3 (Authentication) - T025-T036
3. Remove organization module - T054-T057
4. Basic storage cleanup - T037-T067
5. Basic test fixes - T086-T093

This gives you a working system without organization complexity. US4 (Frontend admin) can be added afterward.

---

## Task Summary

| Phase | Tasks | User Story | Effort |
|-------|-------|------------|--------|
| Phase 1 | 3 tasks | Setup | ~1 hour |
| Phase 2 | 24 tasks | US1 (P1) | ~12 hours |
| Phase 3 | 12 tasks | US2 (P1) | ~8 hours |
| Phase 4 | 32 tasks | US3 (P2) | ~16 hours |
| Phase 5 | 17 tasks | US4 (P2) | ~10 hours |
| Phase 6 | 14 tasks | Testing | ~8 hours |
| Phase 7 | 7 tasks | Cleanup | ~3 hours |
| **Total** | **109 tasks** | | **~58 hours** |

---

## Success Criteria Verification

| Criteria | Tasks | Verification |
|----------|-------|--------------|
| SC-001: Zero org tables | T012-T017 | Check database schema |
| SC-002: No org FKs | T006-T011 | Check table definitions |
| SC-003: Login without org | T025-T036 | Test auth flow |
| SC-004: No org endpoints | T054-T057 | Check routes/index.ts |
| SC-005: No org UI | T083-T085 | Visual inspection |
| SC-006: Data preserved | T018-T019 | Data count verification |
| SC-007: No org imports | T102-T104 | Code search |
| SC-008: Tests pass | T094-T099 | `npm run test:env` |
| SC-009: Auth simplified | T025-T031 | Middleware review |
| SC-010: System works | T096-T099 | End-to-end testing |
