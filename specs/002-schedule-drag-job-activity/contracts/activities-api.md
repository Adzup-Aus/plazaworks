# Activities API

**Base path**: `/api/activities`  
**Auth**: All endpoints require authenticated user (session). Organization context from user's membership.

---

## GET /api/activities

List activities for the current organization.

**Response**: `200 OK`  
**Body**: Array of Activity

```json
[
  { "id": "uuid", "organizationId": "uuid", "name": "Travel", "sortOrder": 0, "createdAt": "...", "updatedAt": "..." },
  { "id": "uuid", "organizationId": "uuid", "name": "Admin", "sortOrder": 1, "createdAt": "...", "updatedAt": "..." }
]
```

---

## GET /api/activities/:id

Get one activity by id.

**Response**: `200 OK` — Activity object  
**Response**: `404` — Activity not found or not in user's org

---

## POST /api/activities

Create an activity.

**Request body**:
- `name` (string, required): Display name
- `sortOrder` (number, optional): Order in list

**Response**: `201 Created` — Created Activity  
**Response**: `400` — Validation error (e.g. name missing)

---

## PATCH /api/activities/:id

Update an activity.

**Request body**: Partial `{ name?, sortOrder? }`

**Response**: `200 OK` — Updated Activity  
**Response**: `404` — Not found

---

## DELETE /api/activities/:id

Delete an activity. Behavior when activity is referenced by schedule entries: either reject with 400 (e.g. "Activity in use") or cascade/clear per business rule (see spec edge case).

**Response**: `200 OK` or `204 No Content`  
**Response**: `400` — Cannot delete (e.g. in use)  
**Response**: `404` — Not found
