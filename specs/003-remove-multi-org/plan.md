# Implementation Plan: Remove Multi-Organization Support

**Branch**: `003-remove-multi-org` | **Date**: Tuesday, Feb 24, 2026 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-remove-multi-org/spec.md`

---

## Summary

This plan removes the multi-tenant organization architecture from the Plaza Works application. The system currently supports multiple organizations with isolated data, subscription tiers, and membership models. This implementation will:

1. Remove all organization-related database tables and foreign keys
2. Simplify authentication to work without organization context
3. Migrate organization-scoped data to global scope
4. Remove organization management UI and APIs
5. Convert organization settings to global application settings

**Technical Approach**: Database-first migration using Drizzle ORM, followed by backend API simplification, then frontend cleanup. Uses phased approach to ensure data integrity.

---

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 20+
**Primary Dependencies**: 
- Express.js (backend framework)
- Drizzle ORM (database)
- React 18 + Vite (frontend)
- TanStack Query (state management)
- PostgreSQL (database)

**Storage**: PostgreSQL with Drizzle ORM
**Testing**: Vitest with API and storage tests
**Target Platform**: Web application (full-stack)
**Project Type**: Web application with backend/frontend

**Constraints**:
- Must preserve all existing data during migration
- Must maintain backward compatibility for authentication during transition
- Must pass `npm run test:env` after all changes

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Gates Assessment

| Gate | Status | Notes |
|------|--------|-------|
| Module structure compliance | PASS | This is a removal task, not a new feature. Existing modules will be simplified. |
| Test requirements | PASS | Tests will be updated to remove org dependencies and must pass |
| Verification (test:env) | PASS | Must pass after all changes |
| Frontend conventions | PASS | UI components will be simplified to remove org selection |

**Constitution Impact**: This change affects the core architecture but aligns with the constitution's modular approach. The organizations module will be removed entirely, simplifying the module structure.

---

## Project Structure

### Current Structure (to be modified)

```
server/
├── modules/
│   └── organizations/          # TO BE REMOVED
│       ├── routes.ts
│       └── model.ts
├── middleware/
│   └── index.ts               # TO BE SIMPLIFIED (remove org middleware)
├── storage.ts                 # TO BE SIMPLIFIED
├── routes/
│   ├── index.ts               # TO BE SIMPLIFIED
│   └── shared.ts              # TO BE SIMPLIFIED
└── __tests__/                 # TO BE UPDATED

shared/
├── models/
│   └── organizations.ts       # TO BE REMOVED
└── schema.ts                  # TO BE SIMPLIFIED

client/
└── src/
    ├── pages/
    │   └── admin.tsx          # TO BE SIMPLIFIED
    └── hooks/
        └── use-auth.tsx       # TO BE SIMPLIFIED
```

### Structure Decision

The project will transition from a multi-tenant structure to a single-tenant structure. The `server/modules/organizations/` directory will be completely removed. Authentication middleware will be simplified to work without organization context. The shared schema will no longer export organization-related types.

---

## Phase 0: Research & Data Analysis

### Research Tasks

1. **Database Dependency Analysis**
   - Identify all tables with `organizationId` foreign keys
   - Map organization settings that need migration
   - Analyze data volume per organization (if multiple exist)

2. **Code Dependency Analysis**
   - Find all imports of organization models
   - Identify middleware that depends on organization context
   - Locate frontend components with org selection

3. **Migration Strategy Research**
   - Drizzle ORM migration patterns for destructive changes
   - Data migration approach for settings
   - Rollback strategy

### Findings

**Tables with organizationId dependencies**:
- `clients` - organizationId required
- `quotes` - organizationId optional
- `invoices` - organizationId optional  
- `vehicles` - organizationId optional
- `checklistTemplates` - organizationId optional
- `termsTemplates` - organizationId optional
- `activities` - organizationId required (via getActivities)

**Tables to be removed**:
- `organizations`
- `organizationSubscriptions`
- `organizationMembers`
- `organizationInvites`
- `organizationSettings`
- `organizationCounters`

**Code areas requiring changes**:
- `server/middleware/index.ts` - `withOrganization`, `requireFeature`, `checkUserLimit`, `checkJobLimit`, `requireSuperAdmin`
- `server/routes/shared.ts` - Organization context helpers
- `server/storage.ts` - All organization-related storage methods
- `server/modules/organizations/routes.ts` - Entire module to remove
- Client-side auth hooks and admin pages

---

## Phase 1: Design & Contracts

### Data Model Changes

See `data-model.md` for detailed entity changes.

**Summary**:
- Remove 6 organization tables
- Remove `organizationId` foreign key from 6 entity tables
- Create new `appSettings` table for global settings
- Preserve `authIdentities` and `verificationCodes` (not org-specific)

### API Contract Changes

See `contracts/api-changes.md` for detailed contract changes.

**Key Changes**:
- Remove `/api/organizations/*` endpoints
- Remove `/api/organizations/:id/members/*` endpoints
- Remove `/api/organizations/:id/invites/*` endpoints
- Remove `/api/organizations/:id/settings` endpoints
- Simplify auth endpoints to not require org context
- Update all existing endpoints to work without organizationId

### Quickstart

See `quickstart.md` for developer migration guide.

---

## Phase 2: Migration Plan

### Database Migration (Phase 2.1)

1. **Create Migration Script** (`migrations/00X_remove_organizations.sql`)
   - Migrate organization settings to new `appSettings` table
   - Remove `organizationId` columns from dependent tables
   - Drop organization tables
   - Drop organization-related indexes

2. **Schema Updates**
   - Update `shared/models/organizations.ts` - Remove org tables, keep auth tables
   - Update `shared/schema.ts` - Remove organization imports and relations
   - Create `shared/models/settings.ts` for global app settings

### Backend Changes (Phase 2.2)

1. **Remove Organization Module**
   - Delete `server/modules/organizations/` directory
   - Remove registration from `server/routes/index.ts`

2. **Simplify Middleware** (`server/middleware/index.ts`)
   - Remove `withOrganization` middleware (auto-org creation)
   - Simplify `requireFeature` to not check subscriptions
   - Remove `checkUserLimit` and `checkJobLimit` (or make global)
   - Update `requireSuperAdmin` to check user role directly

3. **Update Storage Layer** (`server/storage.ts`)
   - Remove all organization-related storage methods
   - Update methods that filter by organizationId
   - Add global app settings methods

4. **Update Routes** (`server/routes/shared.ts`)
   - Remove organization context from request object
   - Simplify auth helpers

### Frontend Changes (Phase 2.3)

1. **Update Auth Hooks** (`client/src/hooks/use-auth.tsx`)
   - Remove organization context from auth state
   - Simplify login/logout flow

2. **Update Admin Page** (`client/src/pages/admin.tsx`)
   - Remove organization management UI
   - Convert to global settings management

3. **Update App Component** (`client/src/App.tsx`)
   - Remove organization provider/context
   - Simplify routing

### Testing Updates (Phase 2.4)

1. **Update Test Fixtures**
   - Remove organization creation from test setup
   - Update test data to not require org context

2. **Update API Tests**
   - Remove organization-related test cases
   - Update existing tests to work without org context

3. **Run Test Suite**
   - Execute `npm run test:env`
   - Fix any regressions

---

## Complexity Tracking

This is a **high-complexity** architectural change that touches:
- Database schema (6 tables removed, 6+ tables modified)
- Authentication and authorization layer
- Backend API (entire module removed, middleware simplified)
- Frontend (auth context simplified, admin UI changed)
- Test suite (significant test updates required)

**Risk Mitigation**:
1. Full database backup before migration
2. Staged rollout (database first, then backend, then frontend)
3. Comprehensive test coverage verification
4. Rollback plan (restore from backup if issues arise)

---

## Deliverables

| Artifact | Location | Status |
|----------|----------|--------|
| Research Document | `research.md` | Generated below |
| Data Model | `data-model.md` | To be generated |
| API Contracts | `contracts/` | To be generated |
| Quickstart Guide | `quickstart.md` | To be generated |
| Migration Script | `migrations/` | To be created during implementation |

