# Invites API Extensions: Full Account Setup & Permissions

**Branch**: `007-invite-account-setup` | **Date**: 2025-03-08

This document describes **changes and extensions** to the existing Invites API (see specs/001-admin-invite-users/contracts/invites-api.md). Base URL and auth patterns unchanged.

---

## 1. Create invite – request body extended (admin)

**POST** `/api/invites`

**Existing**: `email`, optional `roleId`.

**New optional field**:

- `permissions`: string[] (optional). List of permission keys from the system permission set (e.g. view_jobs, create_quotes). Invalid keys are ignored or cause 400; only valid keys are stored. If both roleId and permissions are provided, the invited user receives the **union** of role permissions and this list on accept.

**Example**:

```json
{
  "email": "newuser@example.com",
  "roleId": "role-uuid-optional",
  "permissions": ["view_jobs", "view_quotes"]
}
```

**Response (201)**: Include `permissions` in response body when present (array of stored permission keys).

---

## 2. Get invite by token – unchanged

**GET** `/api/invites/accept?token=<token>`

No change. Returns `{ "email", "valid": true, "inviteId" }` for valid token.

---

## 3. Accept invite – request body extended (public)

**POST** `/api/invites/accept`

**Existing**: `token`, `password`.

**New required**: `firstName`, `lastName` (strings; trimmed, non-empty, reasonable max length e.g. 100).

**New optional**: `profileImageUrl` (string). URL or object path from upload flow (e.g. presigned upload → store path/URL here). Omitted or empty = no profile image.

**Request body**:

```json
{
  "token": "<token from link>",
  "password": "min 8 chars",
  "firstName": "Jane",
  "lastName": "Doe",
  "profileImageUrl": "https://... or uploads/..."
}
```

**Validation**:

- 400: missing or invalid token, password &lt; 8 chars, missing/empty firstName or lastName after trim, or duplicate email (invite email already has an account).
- 409: alternative for duplicate email (implementation may use 400 with message "Email is already registered" or similar).

**Success (201)**: User created with email (from invite), firstName, lastName, profileImageUrl (if provided); auth identity created; staff profile created with permissions = union(role permissions, invite.permissions), only valid permissions applied. Invite marked used. Response: `{ "message": "Account created. You can now sign in.", "userId": "<id>" }`.

**Server errors**: 500 for storage/other failures.

---

## 4. List invites – response extended

**GET** `/api/invites`

**Response**: Each invite object may include `permissions`: string[] (the stored explicit permissions for that invite), in addition to existing fields (id, email, roleId, roleName, expiresAt, usedAt, createdAt, invitedBy).
