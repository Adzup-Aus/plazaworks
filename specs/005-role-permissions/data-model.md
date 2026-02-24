# Data Model: Role-Based Permission Management

## Overview

This document describes the data model changes required to implement role-based permission management. The system introduces two new tables (`roles` and `role_permissions`) and modifies how permissions are resolved for staff members.

## Entity Relationship Diagram

```
+----------------+       +--------------------+       +-------------------+
|     roles      |<-----| role_permissions   |       |  staff_profiles   |
+----------------+       +--------------------+       +-------------------+
| id (PK)        |       | roleId (FK, PK)    |       | id (PK)           |
| name (unique)  |       | permission (PK)    |       | userId (FK)       |
| description    |       | createdAt          |       | roles[]           |
| isSystem       |       +--------------------+       | permissions[]     |
| createdAt      |                                    | ...               |
| updatedAt      |                                    +-------------------+
+----------------+                                           |
                                                             |
                        +------------------------------------+
                        |
                        v
               +-------------------+
               |  userPermissions  |
               |   (enum/const)    |
               +-------------------+
```

## Tables

### roles

Stores the role definitions that can be assigned to staff members.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | varchar(36) | PK, default: gen_random_uuid() | Unique identifier |
| name | varchar(100) | NOT NULL, UNIQUE | Role display name (e.g., "Project Manager") |
| description | text | NULLABLE | Human-readable description of the role |
| isSystem | boolean | NOT NULL, default: false | Protected system role (cannot delete) |
| createdAt | timestamp | NOT NULL, default: now() | Creation timestamp |
| updatedAt | timestamp | NOT NULL, default: now() | Last update timestamp |

**Indexes:**
- Primary key on `id`
- Unique index on `name`

### role_permissions

Junction table mapping roles to their granted permissions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| roleId | varchar(36) | PK, FK -> roles.id | Reference to role |
| permission | varchar(50) | PK | Permission key from userPermissions enum |
| createdAt | timestamp | NOT NULL, default: now() | Creation timestamp |

**Indexes:**
- Composite primary key on `(roleId, permission)`
- Index on `roleId` for fast lookups

## Permission Resolution

### Current Flow (Before)

```
User Login
    ↓
Fetch Staff Profile
    ↓
staffProfile.permissions[] → normalizePermissions() → Effective Permissions
```

### New Flow (After)

```
User Login
    ↓
Fetch Staff Profile
    ↓
Get role names from staffProfile.roles[]
    ↓
For each role: fetch permissions from role_permissions table
    ↓
Aggregate all permissions (union of all role permissions)
    ↓
Combine with staffProfile.permissions[] (direct permissions)
    ↓
normalizePermissions() → Effective Permissions
```

### Permission Aggregation Rules

1. **Role-based permissions**: Union of all permissions from assigned roles
2. **Direct permissions**: Any permissions in `staffProfile.permissions[]` (for backwards compatibility)
3. **Admin override**: If user has `admin` role or `admin_settings` permission → grant ALL permissions
4. **Implied permissions**: Apply `PERMISSION_IMPLICATIONS` (e.g., `create_jobs` implies `view_jobs`)

## Example Data

### Sample Roles

| id | name | description | isSystem |
|----|------|-------------|----------|
| role_001 | Admin | Full system access | true |
| role_002 | Project Manager | Manages projects and schedules | false |
| role_003 | Plumber | Field plumber with job access | false |

### Sample Role Permissions

| roleId | permission |
|--------|------------|
| role_002 | view_jobs |
| role_002 | create_jobs |
| role_002 | edit_jobs |
| role_002 | view_schedule |
| role_002 | manage_schedule |
| role_003 | view_jobs |
| role_003 | view_schedule |

### Sample Staff Profile (After Update)

```json
{
  "id": "staff_123",
  "userId": "user_456",
  "roles": ["Project Manager"],
  "permissions": [],
  "...": "..."
}
```

**Effective permissions for this staff member:**
- view_jobs (from Project Manager role)
- create_jobs (from Project Manager role)
- edit_jobs (from Project Manager role)
- view_schedule (from Project Manager role)
- manage_schedule (from Project Manager role)

## Migration Strategy

### Phase 1: Create Tables (No Data Migration)

1. Create `roles` table
2. Create `role_permissions` table
3. Deploy code changes

### Phase 2: Populate Initial Roles (Optional)

Create default roles for common use cases:

```sql
-- Admin role (system)
INSERT INTO roles (id, name, description, isSystem) VALUES 
  ('role_admin', 'Admin', 'Full system access', true);

-- Assign all permissions to admin
INSERT INTO role_permissions (roleId, permission)
SELECT 'role_admin', unnest(ARRAY[
  'view_dashboard', 'view_jobs', 'create_jobs', 'edit_jobs', 'delete_jobs',
  'view_quotes', 'create_quotes', 'edit_quotes', 'delete_quotes',
  'view_invoices', 'create_invoices', 'edit_invoices', 'delete_invoices',
  'view_schedule', 'manage_schedule', 'view_activities',
  'view_users', 'create_users', 'edit_users', 'delete_users',
  'view_clients', 'create_clients', 'edit_clients', 'delete_clients',
  'view_reports', 'admin_settings'
]);
```

### Phase 3: Existing Staff Migration (Optional)

For existing staff with direct permissions, either:
- Option A: Keep direct permissions in `staffProfile.permissions[]` (backwards compatible)
- Option B: Create roles matching their current permissions and assign

**Recommendation**: Use Option A initially for zero-downtime migration.

## Validation Rules

### Role Entity

- `name` is required and must be unique
- `name` maximum length: 100 characters
- `description` maximum length: 500 characters (optional)
- System roles (`isSystem = true`) cannot be deleted

### RolePermission Entity

- Both `roleId` and `permission` are required
- `permission` must be a valid value from `userPermissions` enum
- Duplicate entries prevented by composite PK

### Deletion Constraints

- Cannot delete role if any staff profiles reference it in their `roles` array
- System roles cannot be deleted (enforced by application logic, not DB constraint)

## TypeScript Types

```typescript
// Role entity
interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Role creation input
interface InsertRole {
  name: string;
  description?: string;
  isSystem?: boolean;
}

// Role permission assignment
interface RolePermission {
  roleId: string;
  permission: UserPermission;
  createdAt: Date;
}

// Permission metadata (for UI)
interface PermissionInfo {
  key: UserPermission;
  displayName: string;
  description: string;
  category: string;
}
```

## Storage Interface Additions

```typescript
interface IStorage {
  // ... existing methods ...
  
  // Role CRUD
  getRoles(): Promise<Role[]>;
  getRole(id: string): Promise<Role | undefined>;
  getRoleByName(name: string): Promise<Role | undefined>;
  createRole(role: InsertRole): Promise<Role>;
  updateRole(id: string, updates: Partial<InsertRole>): Promise<Role | undefined>;
  deleteRole(id: string): Promise<boolean>;
  
  // Role permissions
  getRolePermissions(roleId: string): Promise<UserPermission[]>;
  setRolePermissions(roleId: string, permissions: UserPermission[]): Promise<void>;
  
  // Permission resolution (new or updated)
  getUserPermissionsFromRoles(staffProfile: StaffProfile): Promise<UserPermission[]>;
}
```
