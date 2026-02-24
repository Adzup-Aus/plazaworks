# API Contracts: Role-Based Permission Management

## Base URL

All endpoints are prefixed with `/api`

## Authentication

All endpoints require authentication via session cookie. Authentication errors return `401 Unauthorized`.

Authorization: All endpoints require `admin_settings` permission. Authorization errors return `403 Forbidden`.

## Endpoints

### List All Roles

Retrieves a list of all roles in the system.

**Endpoint:** `GET /api/roles`

**Response:** `200 OK`

```json
[
  {
    "id": "role_001",
    "name": "Admin",
    "description": "Full system access",
    "isSystem": true,
    "createdAt": "2026-02-24T10:00:00Z",
    "updatedAt": "2026-02-24T10:00:00Z"
  },
  {
    "id": "role_002",
    "name": "Project Manager",
    "description": "Manages projects and schedules",
    "isSystem": false,
    "createdAt": "2026-02-24T10:00:00Z",
    "updatedAt": "2026-02-24T10:00:00Z"
  }
]
```

---

### Create Role

Creates a new role.

**Endpoint:** `POST /api/roles`

**Request Body:**

```json
{
  "name": "Senior Plumber",
  "description": "Experienced plumber with job assignment capabilities"
}
```

**Validation:**
- `name`: Required, string, max 100 chars, unique
- `description`: Optional, string, max 500 chars

**Response:** `201 Created`

```json
{
  "id": "role_003",
  "name": "Senior Plumber",
  "description": "Experienced plumber with job assignment capabilities",
  "isSystem": false,
  "createdAt": "2026-02-24T10:30:00Z",
  "updatedAt": "2026-02-24T10:30:00Z"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid input (missing name, exceeds max length)
- `409 Conflict`: Role name already exists

---

### Get Role by ID

Retrieves a single role by its ID.

**Endpoint:** `GET /api/roles/:id`

**Response:** `200 OK`

```json
{
  "id": "role_002",
  "name": "Project Manager",
  "description": "Manages projects and schedules",
  "isSystem": false,
  "createdAt": "2026-02-24T10:00:00Z",
  "updatedAt": "2026-02-24T10:00:00Z"
}
```

**Error Responses:**
- `404 Not Found`: Role does not exist

---

### Update Role

Updates an existing role's name and/or description.

**Endpoint:** `PATCH /api/roles/:id`

**Request Body:**

```json
{
  "name": "Senior Project Manager",
  "description": "Updated description"
}
```

**Validation:**
- `name`: Optional, string, max 100 chars, unique
- `description`: Optional, string, max 500 chars
- At least one field must be provided

**Response:** `200 OK`

```json
{
  "id": "role_002",
  "name": "Senior Project Manager",
  "description": "Updated description",
  "isSystem": false,
  "createdAt": "2026-02-24T10:00:00Z",
  "updatedAt": "2026-02-24T10:45:00Z"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid input
- `404 Not Found`: Role does not exist
- `409 Conflict`: New role name already exists
- `403 Forbidden`: Cannot modify system role properties (name changes blocked)

---

### Delete Role

Deletes a role. Cannot delete system roles or roles assigned to staff members.

**Endpoint:** `DELETE /api/roles/:id`

**Response:** `204 No Content`

**Error Responses:**
- `404 Not Found`: Role does not exist
- `403 Forbidden`: Cannot delete system role
- `409 Conflict`: Role is assigned to one or more staff members

---

### Get Role Permissions

Retrieves all permissions assigned to a role.

**Endpoint:** `GET /api/roles/:id/permissions`

**Response:** `200 OK`

```json
{
  "roleId": "role_002",
  "permissions": [
    "view_jobs",
    "create_jobs",
    "edit_jobs",
    "view_schedule",
    "manage_schedule"
  ]
}
```

**Error Responses:**
- `404 Not Found`: Role does not exist

---

### Set Role Permissions

Sets (replaces) all permissions for a role. Pass an empty array to remove all permissions.

**Endpoint:** `PUT /api/roles/:id/permissions`

**Request Body:**

```json
{
  "permissions": [
    "view_jobs",
    "create_jobs",
    "edit_jobs",
    "view_schedule",
    "manage_schedule"
  ]
}
```

**Validation:**
- `permissions`: Required, array of valid permission strings from `userPermissions` enum

**Response:** `200 OK`

```json
{
  "roleId": "role_002",
  "permissions": [
    "view_jobs",
    "create_jobs",
    "edit_jobs",
    "view_schedule",
    "manage_schedule"
  ]
}
```

**Error Responses:**
- `400 Bad Request`: Invalid permission values
- `404 Not Found`: Role does not exist

---

### List All Available Permissions

Retrieves metadata about all permissions available in the system, organized by category.

**Endpoint:** `GET /api/permissions`

**Response:** `200 OK`

```json
{
  "permissions": [
    {
      "key": "view_jobs",
      "displayName": "View Jobs",
      "description": "Can view job listings and job details",
      "category": "Jobs"
    },
    {
      "key": "create_jobs",
      "displayName": "Create Jobs",
      "description": "Can create new jobs",
      "category": "Jobs"
    },
    {
      "key": "edit_jobs",
      "displayName": "Edit Jobs",
      "description": "Can modify existing jobs",
      "category": "Jobs"
    },
    {
      "key": "view_schedule",
      "displayName": "View Schedule",
      "description": "Can view the schedule calendar",
      "category": "Schedule"
    },
    {
      "key": "manage_schedule",
      "displayName": "Manage Schedule",
      "description": "Can create and edit schedule entries",
      "category": "Schedule"
    }
  ],
  "categories": [
    "Dashboard",
    "Jobs",
    "Quotes",
    "Invoices",
    "Schedule",
    "Activities",
    "Users",
    "Clients",
    "Reports",
    "Settings"
  ]
}
```

---

## Error Response Format

All error responses follow this structure:

```json
{
  "message": "Human-readable error description"
}
```

For validation errors:

```json
{
  "message": "Validation failed",
  "errors": [
    {
      "field": "name",
      "message": "Name is required"
    }
  ]
}
```

## Permission Categories

Permissions are organized into the following categories for the UI:

| Category | Permissions |
|----------|-------------|
| Dashboard | view_dashboard |
| Jobs | view_jobs, create_jobs, edit_jobs, delete_jobs |
| Quotes | view_quotes, create_quotes, edit_quotes, delete_quotes |
| Invoices | view_invoices, create_invoices, edit_invoices, delete_invoices |
| Schedule | view_schedule, manage_schedule |
| Activities | view_activities |
| Users | view_users, create_users, edit_users, delete_users |
| Clients | view_clients, create_clients, edit_clients, delete_clients |
| Reports | view_reports |
| Settings | admin_settings |

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK - Request successful |
| 201 | Created - Resource created successfully |
| 204 | No Content - Resource deleted successfully |
| 400 | Bad Request - Invalid input data |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource does not exist |
| 409 | Conflict - Resource conflict (e.g., duplicate name) |
| 500 | Internal Server Error - Server error |
