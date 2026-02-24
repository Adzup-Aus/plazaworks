# Implementation Plan: Functional Staff Permission System

**Branch**: `004-staff-permissions` | **Date**: February 24, 2026 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-staff-permissions/spec.md`

## Summary

Implement a functional permission system that makes the existing permission assignments actually control what staff members can see and do in the application. The system will hide navigation items, action buttons, and backend API access based on granular permissions (view, create, edit, delete) for each section (Dashboard, Jobs, Quotes, Users, Schedule, Reports, Settings).

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 20+  
**Primary Dependencies**: React 18, Express.js, Drizzle ORM, PostgreSQL, TanStack Query, Wouter  
**Storage**: PostgreSQL with Drizzle ORM  
**Testing**: Vitest  
**Target Platform**: Web application (full-stack)  
**Project Type**: Web (backend + frontend)  
**Performance Goals**: Permission checks should add <10ms to API requests  
**Constraints**: Permission changes should take effect on next page load or within 5 minutes  
**Scale/Scope**: Small-medium team (up to 100 staff members)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Check | Status | Notes |
|-------|--------|-------|
| Backend modules in `server/modules/<feature>/` | ✅ Pass | Feature will follow existing pattern, permissions logic distributed across existing modules |
| Frontend pages in `client/src/pages/` | ✅ Pass | Uses existing pages, adds permission checking |
| Tests in `server/__tests__/` | ✅ Pass | Will add API tests for permission enforcement |
| `npm run test:env` passes | ⚠️ Required | Must run after implementation |

**No Constitution violations identified.** This feature integrates permission checks into existing modules rather than creating new backend modules.

## Project Structure

### Documentation (this feature)

```text
specs/004-staff-permissions/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output - Technical decisions documented
├── data-model.md        # Phase 1 output - Permission entities and relationships
├── quickstart.md        # Phase 1 output - Developer guide for using permissions
├── contracts/           # Phase 1 output - Permission-related API contracts
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
# Backend (permission middleware + updates to existing modules)
server/
├── middleware/
│   └── permissions.ts        # NEW: Permission checking middleware
├── modules/
│   ├── auth/
│   │   └── routes.ts         # MODIFIED: Add permissions to user session response
│   ├── jobs/
│   │   └── routes.ts         # MODIFIED: Add permission checks to endpoints
│   ├── quotes/
│   │   └── routes.ts         # MODIFIED: Add permission checks to endpoints
│   ├── staff/
│   │   └── routes.ts         # MODIFIED: Update permission assignment logic
│   └── ... (other modules updated)
└── routes/
    └── shared.ts             # MODIFIED: Add permission helper functions

# Frontend (permission hooks + UI updates)
client/src/
├── hooks/
│   └── use-permissions.ts    # NEW: Permission checking hook
├── components/
│   ├── permission-gate.tsx   # NEW: Component for conditional rendering
│   └── app-sidebar.tsx       # MODIFIED: Filter nav items by permission
├── lib/
│   └── permissions.ts        # NEW: Permission utility functions
├── pages/
│   ├── jobs.tsx              # MODIFIED: Hide actions by permission
│   ├── quotes.tsx            # MODIFIED: Hide actions by permission
│   └── ... (other pages updated)
└── App.tsx                   # MODIFIED: Route-level permission guards

# Shared types
shared/
├── models/
│   └── staff.ts              # EXISTING: userPermissions enum (may extend)
└── schema.ts                 # EXISTING: Re-exports permissions
```

**Structure Decision**: This feature spans multiple existing modules rather than creating a new module. Permission logic is added via:
1. Shared middleware for backend enforcement
2. Shared hooks/components for frontend enforcement
3. Updates to existing routes/pages to use the permission system

## Complexity Tracking

> **No Constitution violations identified.** No complexity tracking needed.

---

## Phase 0: Research & Decisions

### Research Questions Answered

**Q1: Where are permissions currently stored and how are they accessed?**
- **Answer**: Permissions are stored in `staffProfiles.permissions` as a string array (`text[]`)
- **Current values**: `view_jobs`, `create_jobs`, `edit_jobs`, `delete_jobs`, `view_users`, `create_users`, `edit_users`, `delete_users`, `view_schedule`, `manage_schedule`, `view_reports`, `admin_settings`
- **Access**: Currently loaded via `useAuth()` hook which returns `user.permissions`

**Q2: How should we handle the Dashboard visibility rule?**
- **Decision**: Create a new `view_dashboard` permission
- **Rule**: Dashboard is visible ONLY if user has `view_dashboard` permission OR has `admin` role
- **Redirect**: Users without `view_dashboard` are redirected to their first authorized section

**Q3: What permission granularity is needed?**
- **Decision**: Standard CRUD pattern per section
  - `view_<section>` - Can see the section in nav and access the page
  - `create_<section>` - Can create new items (shows "Create" button)
  - `edit_<section>` - Can edit existing items (shows "Edit" button)
  - `delete_<section>` - Can delete items (shows "Delete" button)
- **Sections**: dashboard, jobs, quotes, invoices, schedule, activities, team, clients, settings, reports, admin

**Q4: How should permission dependencies work?**
- **Decision**: If a user has `create`, `edit`, or `delete` permission, they automatically get `view` permission
- **Implementation**: Helper function `normalizePermissions()` adds implied view permissions

**Q5: What happens when a user has NO permissions?**
- **Decision**: Show a minimal "No Access" page explaining they need permissions assigned
- **Navigation**: Only show "Settings" (if they have access) or logout option

### Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Backend middleware approach** | Create reusable `requirePermission()` middleware that can be applied to any route |
| **Frontend hook approach** | Create `usePermissions()` hook that provides `hasPermission()`, `hasAnyPermission()`, `hasAllPermissions()` |
| **PermissionGate component** | React component for declarative permission-based rendering: `<PermissionGate permission="create_jobs">...</PermissionGate>` |
| **Route-level guards** | Wrap routes in App.tsx with permission checks that redirect if unauthorized |
| **No backend caching** | Check permissions on each request; permissions are in JWT/session, fast enough |
| **Permission expansion** | Add `view_quotes`, `create_quotes`, `edit_quotes`, `delete_quotes`, `view_invoices`, `create_invoices`, `edit_invoices`, `delete_invoices`, `view_activities`, `view_dashboard` to existing list |

---

## Phase 1: Design & Contracts

### Data Model

**Permission Enum Values (to add to `shared/models/staff.ts`)**:

```typescript
export const userPermissions = [
  // Dashboard
  "view_dashboard",
  // Jobs
  "view_jobs",
  "create_jobs",
  "edit_jobs",
  "delete_jobs",
  // Quotes
  "view_quotes",
  "create_quotes",
  "edit_quotes",
  "delete_quotes",
  // Invoices
  "view_invoices",
  "create_invoices",
  "edit_invoices",
  "delete_invoices",
  // Schedule
  "view_schedule",
  "manage_schedule",
  // Activities
  "view_activities",
  // Users/Team
  "view_users",
  "create_users",
  "edit_users",
  "delete_users",
  // Clients
  "view_clients",
  "create_clients",
  "edit_clients",
  "delete_clients",
  // Reports
  "view_reports",
  // Settings
  "admin_settings",
] as const;
```

**Permission Helper Types**:

```typescript
// Permission check result
type PermissionCheck = {
  granted: boolean;
  missing: UserPermission[];
};

// Navigation item with permission requirement
type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  permission?: UserPermission;
  children?: NavItem[];
};
```

### API Contracts

**Backend Middleware**:

```typescript
// server/middleware/permissions.ts
export function requirePermission(permission: UserPermission): RequestHandler;
export function requireAnyPermission(...permissions: UserPermission[]): RequestHandler;
export function requireAllPermissions(...permissions: UserPermission[]): RequestHandler;
```

**Backend Permission Helpers (added to shared.ts)**:

```typescript
// server/routes/shared.ts
export async function checkPermission(userId: string, permission: UserPermission): Promise<boolean>;
export async function getUserPermissions(userId: string): Promise<UserPermission[]>;
export function isAdmin(profile: StaffProfile | null): boolean;
```

**Frontend Hook**:

```typescript
// client/src/hooks/use-permissions.ts
export function usePermissions() {
  return {
    permissions: UserPermission[];
    isLoading: boolean;
    hasPermission: (p: UserPermission) => boolean;
    hasAnyPermission: (...p: UserPermission[]) => boolean;
    hasAllPermissions: (...p: UserPermission[]) => boolean;
    isAdmin: boolean;
  };
}
```

**Frontend Component**:

```typescript
// client/src/components/permission-gate.tsx
interface PermissionGateProps {
  permission?: UserPermission;
  permissions?: UserPermission[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}
```

### Files to Modify

| File | Changes |
|------|---------|
| `shared/models/staff.ts` | Expand `userPermissions` array with new permissions |
| `server/middleware/permissions.ts` | **NEW**: Permission checking middleware |
| `server/routes/shared.ts` | Add permission helper functions |
| `server/modules/auth/routes.ts` | Include permissions in `/api/auth/user` response |
| `server/modules/jobs/routes.ts` | Add permission checks to job endpoints |
| `server/modules/quotes/routes.ts` | Add permission checks to quote endpoints |
| `server/modules/invoices/routes.ts` | Add permission checks to invoice endpoints |
| `server/modules/clients/routes.ts` | Add permission checks to client endpoints |
| `server/modules/staff/routes.ts` | Add permission checks to staff endpoints |
| `server/modules/activities/routes.ts` | Add permission checks to activity endpoints |
| `client/src/hooks/use-permissions.ts` | **NEW**: Permission checking hook |
| `client/src/components/permission-gate.tsx` | **NEW**: Permission wrapper component |
| `client/src/lib/permissions.ts` | **NEW**: Permission utility functions |
| `client/src/components/app-sidebar.tsx` | Filter navigation by permissions |
| `client/src/App.tsx` | Add route-level permission guards |
| `client/src/pages/jobs.tsx` | Hide action buttons by permission |
| `client/src/pages/quotes.tsx` | Hide action buttons by permission |
| `client/src/pages/team.tsx` | Show permissions in UI (already done) |

---

## Post-Design Constitution Check

| Check | Status | Notes |
|-------|--------|-------|
| Backend modules follow structure | ✅ Pass | Using middleware approach, existing modules updated |
| Frontend pages/routes structure | ✅ Pass | Uses existing pages with permission gates |
| Tests will be added | ✅ Pass | API tests for permission enforcement planned |
| No new module needed | ✅ Pass | Permission logic is cross-cutting concern |

**Status**: ✅ READY FOR IMPLEMENTATION
