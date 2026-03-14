# Invites API Contract: Teams Page Invite with Admin-Configured User Info (008)

**Branch**: `008-teams-invite-admin-config` | **Date**: 2025-03-13

This document describes **changes** to the Invites API for this feature. Base behavior from 001 and 007 (permissions on invite, etc.) still applies unless overridden below. Base URL and auth patterns unchanged.

---

## 1. Create invite – request body extended (admin)

**POST** `/api/invites`

**Existing**: `email`, optional `roleId`, optional `permissions` (007).

**New required**: `firstName`, `lastName` (strings; trimmed, non-empty, reasonable max length e.g. 100).

**New optional**: `profileImageUrl` (string). URL or object path from upload flow. Omitted or empty = no profile image on invite.

**Request body**:

```json
{
  "email": "newuser@example.com",
  "firstName": "Jane",
  "lastName": "Doe",
  "roleId": "role-uuid-optional",
  "permissions": ["view_jobs", "view_quotes"],
  "profileImageUrl": "https://... or upload path"
}
```

**Validation**:

- 400: missing or invalid email; missing/empty firstName or lastName after trim; invalid roleId; email already registered.
- First name and last name: required, trimmed, non-empty, max length (e.g. 100).

**Response (201)**: Include `firstName`, `lastName`, `profileImageUrl` (if present) in response so client can reflect created invite. Example: `{ "message": "Invitation sent", "inviteId", "email", "firstName", "lastName", "profileImageUrl", "expiresAt", "roleId", "roleName", "permissions" }`.

---

## 2. List invites – response extended

**GET** `/api/invites`

**Response**: Each invite object MUST include `firstName`, `lastName`, and `profileImageUrl` (nullable) in addition to existing fields (id, email, roleId, roleName, permissions, expiresAt, usedAt, createdAt, invitedBy).

---

## 3. Get invite by token – response extended (optional for UX)

**GET** `/api/invites/accept?token=<token>`

**Response (200)**: May include `firstName` and `lastName` in the body (e.g. for display “Set password for Jane D.”). Existing `email`, `valid`, `inviteId` unchanged. No change required if client only shows email; including name improves UX.

**Example**: `{ "email": "jane@example.com", "valid": true, "inviteId": "<id>", "firstName": "Jane", "lastName": "Doe" }`.

---

## 4. Accept invite – request body reduced to password only

**POST** `/api/invites/accept`

**Description**: Creates the user from **invite data** (email, firstName, lastName, profileImageUrl, roleId, permissions) and **request body** (password only). Invitee does not supply first name, last name, or profile image.

**Request body**:

```json
{
  "token": "<token from link>",
  "password": "min 8 chars"
}
```

- `token`: string, required.
- `password`: string, required, minimum 8 characters (existing policy).

**Removed from request body**: `firstName`, `lastName`, `profileImageUrl`. These MUST NOT be accepted from the client; they are read from the invite record only.

**Validation**:

- 400: missing or invalid token; password &lt; 8 chars; invite expired/used; duplicate email (invite email already has an account).

**Success (201)**: User created with email, firstName, lastName, profileImageUrl from invite; auth identity and staff profile created (permissions = union of role and invite.permissions); invite marked used. Response: `{ "message": "Account created. You can now sign in.", "userId": "<id>" }`.

**Backward compatibility**: If invite row has null firstName/lastName/profileImageUrl (e.g. pre-008 invite), user is still created with those fields null; no error.

---

## 5. Summary of behavior changes

| Area | Before (007) | After (008) |
|------|--------------|-------------|
| POST /api/invites body | email, roleId?, permissions? | + firstName, lastName (required), profileImageUrl? |
| GET /api/invites response | id, email, roleId, roleName, ... | + firstName, lastName, profileImageUrl |
| POST /api/invites/accept body | token, password, firstName, lastName, profileImageUrl? | token, password only |
| User creation on accept | firstName, lastName, profileImageUrl from request | From invite record only |
