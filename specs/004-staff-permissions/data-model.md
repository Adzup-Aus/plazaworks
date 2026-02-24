# Data Model: Functional Staff Permission System

## Overview

This document defines the data structures, types, and relationships for the permission system.

## Core Entities

### StaffProfile (Existing)

**Location**: `shared/models/staff.ts`

The `StaffProfile` entity already contains a `permissions` field. This feature makes that field functional.

```typescript
export const staffProfiles = pgTable("staff_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  roles: text("roles").array().notNull().default(sql`ARRAY['plumber']::text[]`),
  permissions: text("permissions").array().notNull().default(sql`ARRAY[]::text[]`),
  // ... other fields
});
```

### UserPermission Enum (Extended)

**Location**: `shared/models/staff.ts`

```typescript
export const userPermissions = [
  // Dashboard (special visibility rules)
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
  
  // Reports/Dashboards
  "view_reports",
  
  // Settings
  "admin_settings",
] as const;

export type UserPermission = typeof userPermissions[number];
```

### Permission Resource Mapping

Maps permissions to application sections and actions:

```typescript
type PermissionResource = 
  | "dashboard"
  | "jobs" 
  | "quotes"
  | "invoices"
  | "schedule"
  | "activities"
  | "users"
  | "clients"
  | "reports"
  | "settings";

type PermissionAction = "view" | "create" | "edit" | "delete" | "manage";

// Permission format: {action}_{resource}
// Examples: view_jobs, create_quotes, manage_schedule
```

## Helper Types

### Backend Types

**Location**: `server/middleware/permissions.ts` and `server/routes/shared.ts`

```typescript
// Permission check result
interface PermissionCheckResult {
  granted: boolean;
  missing: UserPermission[];
}

// User with resolved permissions
interface PermissionContext {
  userId: string;
  permissions: UserPermission[];
  isAdmin: boolean;
  hasPermission: (permission: UserPermission) => boolean;
  hasAnyPermission: (...permissions: UserPermission[]) => boolean;
  hasAllPermissions: (...permissions: UserPermission[]) => boolean;
}

// Request with permission context
interface PermissionRequest extends Request {
  permissionContext?: PermissionContext;
}
```

### Frontend Types

**Location**: `client/src/hooks/use-permissions.ts`

```typescript
interface UsePermissionsReturn {
  // Data
  permissions: UserPermission[];
  isLoading: boolean;
  isAdmin: boolean;
  
  // Check functions
  hasPermission: (permission: UserPermission) => boolean;
  hasAnyPermission: (...permissions: UserPermission[]) => boolean;
  hasAllPermissions: (...permissions: UserPermission[]) => boolean;
  
  // Resource helpers
  canView: (resource: PermissionResource) => boolean;
  canCreate: (resource: PermissionResource) => boolean;
  canEdit: (resource: PermissionResource) => boolean;
  canDelete: (resource: PermissionResource) => boolean;
}
```

### Navigation Types

**Location**: `client/src/components/app-sidebar.tsx`

```typescript
interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  permission?: UserPermission;
  adminOnly?: boolean;
  children?: NavItem[];
}

interface NavSection {
  label: string;
  items: NavItem[];
}
```

## Permission Logic

### Implicit Permission Rules

These rules define implied permissions:

```typescript
const PERMISSION_IMPLICATIONS: Record<UserPermission, UserPermission[]> = {
  // Create implies view
  "create_jobs": ["view_jobs"],
  "create_quotes": ["view_quotes"],
  "create_invoices": ["view_invoices"],
  "create_users": ["view_users"],
  "create_clients": ["view_clients"],
  
  // Edit implies view
  "edit_jobs": ["view_jobs"],
  "edit_quotes": ["view_quotes"],
  "edit_invoices": ["view_invoices"],
  "edit_users": ["view_users"],
  "edit_clients": ["view_clients"],
  
  // Delete implies view
  "delete_jobs": ["view_jobs"],
  "delete_quotes": ["view_quotes"],
  "delete_invoices": ["view_invoices"],
  "delete_users": ["view_users"],
  "delete_clients": ["view_clients"],
  
  // Manage implies view for schedule
  "manage_schedule": ["view_schedule"],
  
  // No implications for view permissions or admin_settings
  "view_dashboard": [],
  "view_jobs": [],
  "view_quotes": [],
  "view_invoices": [],
  "view_schedule": [],
  "view_activities": [],
  "view_users": [],
  "view_clients": [],
  "view_reports": [],
  "admin_settings": [],
};
```

### Permission Normalization

Function to expand permissions with implications:

```typescript
function normalizePermissions(permissions: UserPermission[]): UserPermission[] {
  const normalized = new Set(permissions);
  
  // Add implied permissions
  for (const permission of permissions) {
    const implications = PERMISSION_IMPLICATIONS[permission] || [];
    implications.forEach(p => normalized.add(p));
  }
  
  return Array.from(normalized);
}
```

### Admin Role Check

```typescript
function isAdmin(profile: StaffProfile | null): boolean {
  if (!profile) return false;
  return profile.roles?.includes("admin") || false;
}

function hasAdminAccess(profile: StaffProfile | null): boolean {
  if (!profile) return false;
  return isAdmin(profile) || profile.permissions?.includes("admin_settings") || false;
}
```

## Relationships

### StaffProfile → Permissions

```
StaffProfile {
  id: string (PK)
  userId: string (FK → User)
  roles: string[]
  permissions: UserPermission[]
  ...
}
```

### User → Effective Permissions

```typescript
// Effective permissions combine explicit permissions + admin roleunction getEffectivePermissions(
  profile: StaffProfile | null
): UserPermission[] {
  if (!profile) return [];
  
  // Admin gets all permissions
  if (isAdmin(profile)) {
    return [...userPermissions]; // All permissions
  }
  
  // Otherwise return normalized explicit permissions
  return normalizePermissions(profile.permissions as UserPermission[]);
}
```

## Validation Rules

### Permission Assignment Rules

1. **Valid Permission**: Must be in `userPermissions` array
2. **No Duplicates**: Array should not contain duplicates
3. **Case Sensitive**: Permissions are case-sensitive
4. **Implied Permissions**: Automatically granted, don't need explicit assignment

### Permission Check Rules

1. **Existence**: User must have a staff profile to have permissions
2. **Active Only**: Only active staff profiles should be checked
3. **Admin Override**: Admin role bypasses all permission checks
4. **Dashboard Special**: Dashboard visibility requires explicit permission OR admin role

## State Transitions

### Permission Assignment Flow

```
[Admin edits staff] → [Select permissions] → [Save] → [Permissions stored in DB]
                                         ↓
[Staff logs in] ← [Permissions loaded in auth] ← [Session created]
                                         ↓
[Navigation filtered] ← [Permissions checked] ← [Page rendered]
```

### Permission Revocation Flow

```
[Admin removes permission] → [Save to DB] → [Staff's next request checks new permissions]
                                                      ↓
[Redirect to authorized page] ← [Unauthorized access detected]
```

## Database Queries

### Get User Permissions

```typescript
// Get staff profile with permissions
const profile = await db
  .select()
  .from(staffProfiles)
  .where(eq(staffProfiles.userId, userId))
  .limit(1);

const permissions = profile[0]?.permissions || [];
```

### Update Staff Permissions

```typescript
// Update permissions array
await db
  .update(staffProfiles)
  .set({ 
    permissions: newPermissions,
    updatedAt: new Date()
  })
  .where(eq(staffProfiles.id, staffId));
```
