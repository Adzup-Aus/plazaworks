# Research: Functional Staff Permission System

**Date**: February 24, 2026

## Current State Analysis

### Existing Permission Infrastructure

1. **Database Schema** (`shared/models/staff.ts`):
   - `staffProfiles.permissions` field exists as `text[]` array
   - Currently defined permissions: `view_jobs`, `create_jobs`, `edit_jobs`, `delete_jobs`, `view_users`, `create_users`, `edit_users`, `delete_users`, `view_schedule`, `manage_schedule`, `view_reports`, `admin_settings`

2. **Frontend Auth Hook** (`client/src/hooks/use-auth.ts`):
   - Already exposes `permissions?: string[]` in `AuthUser` type
   - Permissions are available throughout the app via `useAuth()`

3. **Team Management UI** (`client/src/pages/team.tsx`):
   - Already has UI for editing permissions (checkboxes)
   - Shows permission count per staff member
   - Supports toggling permissions on/off

### What's Missing

1. **Backend Enforcement**: No middleware or route-level permission checking
2. **Frontend Enforcement**: No hooks/components for permission-based UI
3. **Navigation Filtering**: Sidebar shows all items regardless of permissions
4. **Action Button Control**: No hiding of Create/Edit/Delete buttons based on permissions
5. **Missing Permissions**: No `view_quotes`, `view_invoices`, `view_dashboard`, etc.

## Technical Decisions

### Decision 1: Permission Naming Convention

**Chosen**: `{action}_{resource}` format (e.g., `view_jobs`, `create_quotes`)

**Rationale**:
- Matches existing pattern
- Clear and self-documenting
- Easy to filter by resource or action

**Actions**: `view`, `create`, `edit`, `delete`
**Resources**: `dashboard`, `jobs`, `quotes`, `invoices`, `schedule`, `activities`, `users`, `clients`, `reports`, `settings`

### Decision 2: Permission Dependencies

**Chosen**: Implicit view permission when higher permissions granted

**Rule**: If user has `create_jobs`, they automatically have `view_jobs`

**Implementation**:
```typescript
function normalizePermissions(permissions: UserPermission[]): UserPermission[] {
  const normalized = new Set(permissions);
  if (normalized.has('create_jobs')) normalized.add('view_jobs');
  if (normalized.has('edit_jobs')) normalized.add('view_jobs');
  if (normalized.has('delete_jobs')) normalized.add('view_jobs');
  // ... etc for all resources
  return Array.from(normalized);
}
```

**Rationale**: Prevents misconfiguration where user can create but not view

### Decision 3: Admin Role Handling

**Chosen**: Admin role grants all permissions EXCEPT dashboard visibility

**Rule**: 
- `admin` role = all permissions
- `view_dashboard` is explicit - must be granted separately
- Dashboard visibility: `admin` OR `view_dashboard` permission

**Rationale**: 
- Matches spec requirement: "Dashboard should be invisible only for admin and those who have permission"
- Allows admin to hide dashboard from themselves if desired
- Keeps dashboard visibility explicit

### Decision 4: Backend Implementation Approach

**Chosen**: Middleware-based permission checking

**Pattern**:
```typescript
app.post('/api/jobs', 
  isAuthenticated, 
  requirePermission('create_jobs'), 
  async (req, res) => { ... }
);
```

**Rationale**:
- Clean, reusable, follows Express conventions
- Easy to apply to existing routes
- Returns 403 Forbidden on failure

### Decision 5: Frontend Implementation Approach

**Chosen**: Hook + Component + Utility function combo

**Pattern**:
```typescript
// Hook for programmatic checks
const { hasPermission } = usePermissions();
if (hasPermission('create_jobs')) { ... }

// Component for declarative rendering
<PermissionGate permission="create_jobs">
  <CreateButton />
</PermissionGate>

// Utility for data transformation
const visibleNavItems = filterNavByPermissions(navItems, permissions);
```

**Rationale**:
- Covers all use cases
- Clean, readable code
- Easy to test

### Decision 6: Permission Cache Strategy

**Chosen**: No caching - check on each request

**Rationale**:
- Permissions are in session/JWT - already fast
- PostgreSQL array lookup is fast
- Permission changes should be immediate
- Complexity of caching outweighs benefit

### Decision 7: Handling No Permissions

**Chosen**: Show "No Access" page with helpful message

**Implementation**:
- Create `NoAccess` page component
- Show when user has zero permissions
- Message: "You don't have access to any sections. Please contact an administrator."
- Show logout button

**Rationale**:
- Better UX than blank screen
- Clear next step for user
- Matches security best practices

## Permission Matrix

| Section | View | Create | Edit | Delete | Notes |
|---------|------|--------|------|--------|-------|
| Dashboard | `view_dashboard` | N/A | N/A | N/A | Special: visible to admin OR with permission |
| Jobs | `view_jobs` | `create_jobs` | `edit_jobs` | `delete_jobs` | |
| Quotes | `view_quotes` | `create_quotes` | `edit_quotes` | `delete_quotes` | **NEW** |
| Invoices | `view_invoices` | `create_invoices` | `edit_invoices` | `delete_invoices` | **NEW** |
| Schedule | `view_schedule` | N/A | `manage_schedule` | N/A | `manage_schedule` covers all schedule edits |
| Activities | `view_activities` | N/A | N/A | N/A | **NEW** |
| Team | `view_users` | `create_users` | `edit_users` | `delete_users` | Also controls invite functionality |
| Clients | `view_clients` | `create_clients` | `edit_clients` | `delete_clients` | **NEW** |
| Reports | `view_reports` | N/A | N/A | N/A | |
| Settings | `admin_settings` | N/A | N/A | N/A | Settings is all-or-nothing |

## New Permissions to Add

1. `view_dashboard` - Dashboard visibility
2. `view_quotes` - View quotes section
3. `create_quotes` - Create new quotes
4. `edit_quotes` - Edit existing quotes
5. `delete_quotes` - Delete quotes
6. `view_invoices` - View invoices section
7. `create_invoices` - Create new invoices
8. `edit_invoices` - Edit existing invoices
9. `delete_invoices` - Delete invoices
10. `view_activities` - View activities section
11. `view_clients` - View clients section
12. `create_clients` - Create new clients
13. `edit_clients` - Edit existing clients
14. `delete_clients` - Delete clients

## Navigation Mapping

```typescript
const mainNavItems = [
  { title: "Jobs", url: "/jobs", permission: "view_jobs" },
  { title: "Quotes", url: "/quotes", permission: "view_quotes" },
  { title: "Invoices", url: "/invoices", permission: "view_invoices" },
  { title: "Schedule", url: "/schedule", permission: "view_schedule" },
  { title: "Activities", url: "/activities", permission: "view_activities" },
  { title: "Team", url: "/team", permission: "view_users" },
  { title: "Clients", url: "/clients", permission: "view_clients" },
  { title: "Settings", url: "/settings", permission: "admin_settings" },
];

const dashboardsNavItems = [
  { title: "Overview", url: "/", permission: "view_dashboard" },
  { title: "KPI", url: "/kpi", permission: "view_reports" },
  { title: "Time Tracking", url: "/productivity", permission: "view_reports" },
  { title: "Capacity", url: "/capacity", permission: "view_reports" },
];
```

## API Endpoints Requiring Permission Checks

### Jobs Module
- `GET /api/jobs` - `view_jobs`
- `POST /api/jobs` - `create_jobs`
- `PATCH /api/jobs/:id` - `edit_jobs`
- `DELETE /api/jobs/:id` - `delete_jobs`

### Quotes Module
- `GET /api/quotes` - `view_quotes`
- `POST /api/quotes` - `create_quotes`
- `PATCH /api/quotes/:id` - `edit_quotes`
- `DELETE /api/quotes/:id` - `delete_quotes`

### Invoices Module
- `GET /api/invoices` - `view_invoices`
- `POST /api/invoices` - `create_invoices`
- `PATCH /api/invoices/:id` - `edit_invoices`
- `DELETE /api/invoices/:id` - `delete_invoices`

### Team Module
- `GET /api/staff` - `view_users`
- `POST /api/staff` - `create_users`
- `PATCH /api/staff/:id` - `edit_users`
- `DELETE /api/staff/:id` - `delete_users`
- `POST /api/invites` - `create_users`

### Clients Module
- `GET /api/clients` - `view_clients`
- `POST /api/clients` - `create_clients`
- `PATCH /api/clients/:id` - `edit_clients`
- `DELETE /api/clients/:id` - `delete_clients`

### Activities Module
- `GET /api/activities` - `view_activities`

### Schedule Module
- `GET /api/schedule` - `view_schedule`
- `POST /api/schedule` - `manage_schedule`
- `PATCH /api/schedule/:id` - `manage_schedule`
- `DELETE /api/schedule/:id` - `manage_schedule`
