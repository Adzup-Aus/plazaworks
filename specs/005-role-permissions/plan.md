# Implementation Plan: Role-Based Permission Management

**Branch**: `005-role-permissions` | **Date**: 2026-02-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-role-permissions/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Build a complete role-based permission management system that allows administrators to create custom roles, assign permissions to roles, and have staff members inherit permissions through their assigned roles. This feature adds a "Roles" section to the sidebar (alongside Invoices, Jobs, etc.) with CRUD operations for role management and a permission assignment UI.

Key changes:
1. **Database**: Add `roles` table and `role_permissions` junction table
2. **Backend**: New `server/modules/roles/` module with CRUD routes + permission middleware updates
3. **Frontend**: New `client/src/pages/roles.tsx` page with role management UI + sidebar navigation
4. **Integration**: Update permission checking to aggregate permissions from all assigned roles

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 20+
**Primary Dependencies**: Express.js, Drizzle ORM, React 18, TanStack Query, Tailwind CSS
**Storage**: PostgreSQL via Drizzle ORM
**Testing**: Vitest + Supertest for API tests
**Target Platform**: Web application (full-stack)
**Project Type**: Web application with separate backend/frontend
**Performance Goals**: Role permission changes apply within 5 seconds (per spec SC-002)
**Constraints**: Must integrate with existing permission system (`userPermissions` enum, `PERMISSION_IMPLICATIONS`, `requirePermission` middleware)
**Scale/Scope**: Single-tenant (per organization), up to ~50 roles, ~25 permissions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| Backend module structure | PASS | Will use `server/modules/roles/` with `routes.ts` and `model.ts` |
| Database schema location | PASS | New tables in `shared/models/roles.ts`, re-exported from `shared/schema.ts` |
| Frontend page location | PASS | New page at `client/src/pages/roles.tsx` |
| Route registration | PASS | Will register in `server/routes/index.ts` and `App.tsx` |
| Tests required | PASS | Will create `server/__tests__/api.roles.test.ts` |
| No loose route files | PASS | All routes in `server/modules/roles/routes.ts` |

## Project Structure

### Documentation (this feature)

```text
specs/005-role-permissions/
├── plan.md              # This file
├── research.md          # Phase 0 output (minimal - mostly straightforward CRUD)
├── data-model.md        # Phase 1 output (below)
├── quickstart.md        # Phase 1 output (below)
├── contracts/           # Phase 1 output
│   └── api.md           # API contract documentation
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
# Backend
server/
├── modules/
│   └── roles/              # NEW: Role management module
│       ├── routes.ts       # Express routes for roles CRUD + permission assignment
│       └── model.ts        # Re-exports from @shared/schema
├── routes/
│   ├── index.ts            # MODIFY: Add registerRolesRoutes import
│   └── shared.ts           # MODIFY: Export role-aware permission helpers
├── middleware/
│   └── permissions.ts      # MODIFY: Add getUserPermissionsFromRoles function
├── storage.ts              # MODIFY: Add role storage methods
└── __tests__/
    └── api.roles.test.ts   # NEW: API tests for roles module

# Shared schema
shared/
├── models/
│   └── roles.ts            # NEW: roles and role_permissions tables
└── schema.ts               # MODIFY: Re-export roles models

# Frontend
client/
├── src/
│   ├── pages/
│   │   └── roles.tsx       # NEW: Roles management page
│   ├── components/
│   │   └── app-sidebar.tsx # MODIFY: Add Roles nav item
│   ├── hooks/
│   │   └── use-roles.ts    # NEW: Hook for role data
│   └── lib/
│       └── permissions.ts  # MODIFY: Add role permission aggregation
└── App.tsx                 # MODIFY: Add /roles route
```

**Structure Decision**: Following the existing codebase structure as defined in the Speckit Constitution. Backend uses modular structure with `server/modules/roles/`, frontend follows the established pattern with pages in `client/src/pages/`.

## Complexity Tracking

> **No Constitution violations identified** - The implementation follows all constitutional requirements for module structure, testing, and frontend organization.

---

## Phase 0: Research (Completed)

### Current System Analysis

The codebase already has:
1. **Permission enum** (`userPermissions` in `shared/models/staff.ts`) with 25 permissions
2. **Permission implications** (`PERMISSION_IMPLICATIONS`) for automatic permission inheritance (e.g., `create_jobs` implies `view_jobs`)
3. **Permission middleware** (`requirePermission`, `requireAnyPermission`, etc. in `server/middleware/permissions.ts`)
4. **Frontend permission hook** (`usePermissions` in `client/src/hooks/use-permissions.ts`)
5. **Staff profile with roles array** - Currently stores role strings like "admin", "plumber"

### Gaps Identified

1. **No role entity** - Roles are just strings in the `roles` array on staff profiles
2. **No permission-to-role mapping** - Permissions are directly on staff profiles, not inherited from roles
3. **No role management UI** - No way to create/edit roles or assign permissions to them
4. **No role sidebar navigation** - No entry point for role management

### Research Decisions

| Decision | Rationale |
|----------|-----------|
| **Separate roles table** | Allows CRUD operations on roles independent of staff |
| **Junction table for role_permissions** | Many-to-many relationship (roles can have many permissions, permissions can be in many roles) |
| **Keep staff.roles array** | Backwards compatible - will populate from roles table |
| **Aggregate permissions from all roles** | Staff with multiple roles gets union of all permissions |
| **Admin bypass remains** | Admin users get all permissions regardless of role assignments |

---

## Phase 1: Design & Contracts

### Data Model (`data-model.md`)

#### New Entities

**Role**
```typescript
{
  id: string (PK, uuid)
  name: string (unique, required) - e.g., "Project Manager", "Senior Plumber"
  description: string (optional) - Human-readable description
  isSystem: boolean (default: false) - Protects system roles from deletion
  createdAt: timestamp
  updatedAt: timestamp
}
```

**RolePermission** (Junction)
```typescript
{
  roleId: string (FK -> roles.id, part of PK)
  permission: string (from userPermissions enum, part of PK)
  createdAt: timestamp
}
```

**StaffProfile Update**
- Keep existing `roles: string[]` array - now populated from Role names
- Keep existing `permissions: string[]` - will be computed from role assignments

#### Relationships

```
Role ||--o{ RolePermission : has
RolePermission }o--|| Permission : references
StaffProfile }o--o{ Role : assigned_to (via roles array)
```

#### Modified Permission Resolution Flow

1. User logs in → fetch staff profile
2. Get role names from `staffProfile.roles`
3. Fetch permissions for each role from `role_permissions` table
4. Normalize with `PERMISSION_IMPLICATIONS`
5. If admin → grant all permissions
6. Return aggregated permission set

### API Contracts (`contracts/api.md`)

#### Endpoints

| Method | Path | Description | Auth | Permissions |
|--------|------|-------------|------|-------------|
| GET | /api/roles | List all roles | Yes | admin_settings |
| POST | /api/roles | Create new role | Yes | admin_settings |
| GET | /api/roles/:id | Get role by ID | Yes | admin_settings |
| PATCH | /api/roles/:id | Update role | Yes | admin_settings |
| DELETE | /api/roles/:id | Delete role | Yes | admin_settings |
| GET | /api/roles/:id/permissions | Get role permissions | Yes | admin_settings |
| PUT | /api/roles/:id/permissions | Set role permissions | Yes | admin_settings |
| GET | /api/permissions | List all available permissions | Yes | admin_settings |

#### Request/Response Schemas

**Role Object**
```json
{
  "id": "uuid",
  "name": "Project Manager",
  "description": "Manages projects and team assignments",
  "isSystem": false,
  "createdAt": "2026-02-24T10:00:00Z",
  "updatedAt": "2026-02-24T10:00:00Z"
}
```

**Create Role Request**
```json
{
  "name": "Project Manager",
  "description": "Manages projects and team assignments"
}
```

**Update Role Request**
```json
{
  "name": "Senior Project Manager",
  "description": "Updated description"
}
```

**Set Role Permissions Request**
```json
{
  "permissions": ["view_jobs", "create_jobs", "edit_jobs", "view_schedule"]
}
```

**Permissions List Response**
```json
{
  "permissions": [
    {
      "key": "view_jobs",
      "displayName": "View Jobs",
      "description": "Can view job listings and details",
      "category": "Jobs"
    },
    ...
  ]
}
```

### Quickstart (`quickstart.md`)

#### For Developers

**Database Migration**
```bash
# After adding roles tables to schema
npm run db:generate  # Generate migration
npm run db:migrate   # Apply migration
```

**Running Tests**
```bash
# Run all tests including new role tests
npm run test:env
```

**Manual Testing**
1. Log in as admin
2. Click "Roles" in left sidebar
3. Create a new role: "Test Manager"
4. Assign permissions: view_jobs, create_jobs
5. Save role
6. Go to Team page, assign "Test Manager" role to a staff member
7. Log in as that staff member - verify they can see Jobs but not other sections

### Phase 1 Constitution Re-check

| Gate | Status | Notes |
|------|--------|-------|
| Module structure | PASS | `server/modules/roles/routes.ts` + `model.ts` |
| Schema location | PASS | `shared/models/roles.ts` |
| Frontend page | PASS | `client/src/pages/roles.tsx` |
| Route registration | PASS | Will update `server/routes/index.ts` and `App.tsx` |
| Tests | PASS | `server/__tests__/api.roles.test.ts` |

---

## Implementation Sequence

### Step 1: Database Schema
1. Create `shared/models/roles.ts` with `roles` and `role_permissions` tables
2. Re-export from `shared/schema.ts`
3. Generate and run migration

### Step 2: Backend - Storage Layer
1. Add role CRUD methods to `server/storage.ts`
2. Add `getRolePermissions`, `setRolePermissions` methods

### Step 3: Backend - Roles Module
1. Create `server/modules/roles/model.ts` (re-exports)
2. Create `server/modules/roles/routes.ts` with all endpoints
3. Register in `server/routes/index.ts`

### Step 4: Backend - Permission Integration
1. Update `server/middleware/permissions.ts` to aggregate role permissions
2. Update `getUserPermissions` to include role-based permissions

### Step 5: Backend - Tests
1. Create `server/__tests__/api.roles.test.ts`
2. Run `npm run test:env` and fix issues

### Step 6: Frontend - API Integration
1. Create `client/src/hooks/use-roles.ts`
2. Add role types to shared schema (already done in step 1)

### Step 7: Frontend - Roles Page
1. Create `client/src/pages/roles.tsx`
2. Implement role list view
3. Implement role create/edit modal
4. Implement permission assignment UI

### Step 8: Frontend - Navigation
1. Add "Roles" to `client/src/components/app-sidebar.tsx`
2. Add route in `client/App.tsx`

### Step 9: Frontend - Permission Helper Updates
1. Update permission aggregation logic if needed

### Step 10: Verification
1. Run full test suite: `npm run test:env`
2. Manual testing of role CRUD and permission assignment
3. Verify permissions take effect for staff members

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing permission system | HIGH | Keep `staffProfile.permissions` array, populate from roles - backwards compatible |
| Performance on permission lookup | MEDIUM | Cache role permissions in memory (small dataset) |
| Staff with no roles lose access | MEDIUM | Migration: create default roles or assign all permissions to existing staff |
| Role name collisions | LOW | Enforce unique constraint on role names |

---

## Post-Implementation Notes

- After implementation, existing staff permissions should be migrated to role-based system
- Consider creating default roles: "Admin" (all permissions), "Manager" (view + create + edit), "Staff" (view only)
- Document that `staffProfile.permissions` is now computed from roles, not manually set
