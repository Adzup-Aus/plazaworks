# Research: Role-Based Permission Management

## Date: 2026-02-24

## Research Scope

This research documents the existing permission system and the design decisions for implementing role-based permission management.

## Current System Analysis

### Existing Permission Infrastructure

**1. Permission Enum (`shared/models/staff.ts`)**

The system already has 25 defined permissions:

```typescript
export const userPermissions = [
  "view_dashboard",
  "view_jobs", "create_jobs", "edit_jobs", "delete_jobs",
  "view_quotes", "create_quotes", "edit_quotes", "delete_quotes",
  "view_invoices", "create_invoices", "edit_invoices", "delete_invoices",
  "view_schedule", "manage_schedule",
  "view_activities",
  "view_users", "create_users", "edit_users", "delete_users",
  "view_clients", "create_clients", "edit_clients", "delete_clients",
  "view_reports",
  "admin_settings",
] as const;
```

**2. Permission Implications (`PERMISSION_IMPLICATIONS`)**

The system has automatic permission inheritance:
- `create_*` implies `view_*`
- `edit_*` implies `view_*`
- `delete_*` implies `view_*`
- `manage_schedule` implies `view_schedule`
- `create_users`/`edit_users`/`delete_users` implies `view_users`

This is implemented via `normalizePermissions()` function.

**3. Permission Middleware (`server/middleware/permissions.ts`)**

Existing middleware functions:
- `checkPermission(userId, permission)` - Check if user has permission
- `getUserPermissions(userId)` - Get all user permissions
- `requirePermission(permission)` - Express middleware to require specific permission
- `requireAnyPermission(...permissions)` - Require any of the listed permissions
- `requireAllPermissions(...permissions)` - Require all listed permissions

**4. Frontend Permission Hook (`client/src/hooks/use-permissions.ts`)**

Provides:
- `permissions` - Array of user's permissions
- `isAdmin` - Boolean indicating admin status
- `hasPermission(p)` - Check single permission
- `hasAnyPermission(...p)` - Check any permission
- `hasAllPermissions(...p)` - Check all permissions
- `canView/Create/Edit/Delete(resource)` - Resource-level helpers

**5. Staff Profile Schema**

Current `staff_profiles` table has:
- `roles: text[]` - Array of role names (e.g., ["admin", "plumber"])
- `permissions: text[]` - Array of direct permissions

### Current Data Flow

```
User Login
  ↓
Auth returns user with permissions
  ↓
Permissions stored in user object
  ↓
usePermissions hook normalizes permissions
  ↓
UI components check permissions for feature access
```

## Design Decisions

### Decision 1: Separate Roles Table

**Decision**: Create a dedicated `roles` table instead of using the string array on staff profiles.

**Rationale**:
- Enables CRUD operations on roles (create, edit, delete)
- Allows storing role metadata (description, system flag)
- Enables the role management UI
- Enforces data integrity (unique names)

**Alternatives considered**:
- Keep using string array with hardcoded roles (rejected: no flexibility)
- Store roles in a JSON configuration file (rejected: no per-tenant customization)

### Decision 2: Junction Table for Role-Permission Mapping

**Decision**: Use `role_permissions` junction table for many-to-many relationship.

**Rationale**:
- Clean separation of concerns
- Efficient permission lookups by role
- Easy to add/remove permissions from roles
- Natural SQL queries for "get all roles with this permission"

**Alternatives considered**:
- JSON array of permissions on roles table (rejected: harder to query, no referential integrity)
- Individual boolean columns per permission (rejected: schema changes needed for new permissions)

### Decision 3: Keep Direct Permissions on Staff Profile

**Decision**: Preserve `staffProfile.permissions` array for backwards compatibility.

**Rationale**:
- Zero-downtime migration
- Allows exceptional cases (user with extra permissions beyond their roles)
- Existing data continues to work

**Trade-offs**:
- Slightly more complex permission resolution
- Two sources of truth (roles + direct permissions)

### Decision 4: Permission Aggregation Strategy

**Decision**: Aggregate permissions using union (OR) logic across all assigned roles.

**Rationale**:
- Most intuitive for users
- Staff member gets all permissions from all their roles
- No complex role hierarchy needed

**Example**:
- User has "Project Manager" role (can view/create jobs)
- User also has "Scheduler" role (can manage schedule)
- Result: User can view/create jobs AND manage schedule

### Decision 5: Admin Bypass

**Decision**: Keep existing admin bypass logic (admin users get all permissions).

**Rationale**:
- Maintains existing behavior
- Safety net for system administration
- Consistent with current implementation

### Decision 6: Role Name Uniqueness

**Decision**: Enforce unique role names at database level.

**Rationale**:
- Prevents confusion in UI
- Enables lookup by name for staff profile assignment
- Clear identification of roles

### Decision 7: System Role Protection

**Decision**: Add `isSystem` flag to protect critical roles from deletion.

**Rationale**:
- Prevents accidental deletion of essential roles
- System roles (like "Admin") should always exist
- Can be extended for other protected roles

## Integration Points

### Backend Integration

1. **Permission Resolution Update** (`server/middleware/permissions.ts`)
   - Modify `getUserPermissions()` to aggregate role permissions
   - Query `role_permissions` table for each role in `staffProfile.roles`
   - Combine with direct `staffProfile.permissions`

2. **Storage Layer** (`server/storage.ts`)
   - Add role CRUD methods
   - Add role permission methods

3. **New Module** (`server/modules/roles/`)
   - Routes for role CRUD
   - Routes for permission assignment

### Frontend Integration

1. **New Page** (`client/src/pages/roles.tsx`)
   - Role list view
   - Role create/edit modal
   - Permission assignment UI

2. **Sidebar Update** (`client/src/components/app-sidebar.tsx`)
   - Add "Roles" navigation item

3. **Route Addition** (`client/App.tsx`)
   - Add `/roles` route

4. **New Hook** (`client/src/hooks/use-roles.ts`)
   - Fetch and manage role data
   - TanStack Query integration

## Permission Category Mapping

For the UI, permissions are grouped by functional area:

| Category | Icon | Permissions |
|----------|------|-------------|
| Dashboard | LayoutDashboard | view_dashboard |
| Jobs | Briefcase | view_jobs, create_jobs, edit_jobs, delete_jobs |
| Quotes | FileText | view_quotes, create_quotes, edit_quotes, delete_quotes |
| Invoices | Receipt | view_invoices, create_invoices, edit_invoices, delete_invoices |
| Schedule | Calendar | view_schedule, manage_schedule |
| Activities | ListTodo | view_activities |
| Users | Users | view_users, create_users, edit_users, delete_users |
| Clients | UserCircle | view_clients, create_clients, edit_clients, delete_clients |
| Reports | BarChart3 | view_reports |
| Settings | Settings | admin_settings |

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing permissions | Keep backwards compatibility with direct permissions |
| Performance impact | Cache role permissions in memory (small dataset: ~50 roles max) |
| Data migration complexity | Phase migration: tables first, data migration optional |
| Role name collisions | Database unique constraint + validation |
| Accidental role deletion | `isSystem` flag + staff assignment check before delete |

## Validation Strategy

1. **API Tests**: CRUD operations, permission assignment, edge cases
2. **Integration Tests**: Permission resolution from roles
3. **Frontend Tests**: Role management UI flows
4. **E2E Tests**: Complete user journey (create role → assign permissions → assign to user → verify access)

## Notes

- The existing `userRoles` enum (`plumber`, `admin`, etc.) represents job functions, not permission roles
- These will coexist: `userRoles` for job type, new `roles` table for permissions
- Future enhancement: Map job roles to permission roles automatically
