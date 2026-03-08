# Research: Full Account Setup for Invited Users

**Branch**: `007-invite-account-setup` | **Date**: 2025-03-08

## 1. Profile image upload mechanism

**Decision**: Use the existing **presigned URL** upload flow (POST /api/uploads/request-url → PUT to URL → use returned objectPath/URL as profileImageUrl).

**Rationale**: The codebase already has `useUpload` hook and `/api/uploads/request-url` (object storage); job photos and other uploads use this pattern. Reusing it keeps consistency and avoids new upload infrastructure. Client: (1) user selects image; (2) request presigned URL (with size/contentType validation); (3) upload file; (4) submit accept form with token, firstName, lastName, password, profileImageUrl = objectPath or public URL. Server accepts profileImageUrl string on POST /api/invites/accept and stores in users.profileImageUrl.

**Alternatives considered**: Multipart form on /api/invites/accept—rejected to keep accept endpoint simple and reuse existing upload pipeline. Base64 in JSON—rejected for size and consistency.

---

## 2. Storing permissions on the invite

**Decision**: Add a **permissions** column (text[] or jsonb array of permission keys) to `user_invites`. On invite create/update, accept only keys that exist in the system permission set (userPermissions); store filtered list. On accept, merge role-derived permissions with this list (union) and pass to createStaffProfile.

**Rationale**: Staff profile already has `permissions: text[]`; roles have role_permissions. Invite needs to carry an optional explicit list. text[] is consistent with staff_profiles.permissions. Filtering at create/update avoids storing invalid keys; at accept, filter again to current valid permissions so removed permissions are not applied.

**Alternatives considered**: New table invite_permissions (invite_id, permission)—more normalized but overkill for a single list per invite. JSONB—same as text[] for this use case; text[] matches staff.

---

## 3. Avatar fallback (no profile image / no first name)

**Decision**: Implement in client: if user.profileImageUrl present, show image; else if user.firstName, show first letter (uppercase); else if user.email, show first letter of email (local part or first char); else show generic placeholder (e.g. "?" or default avatar component). No backend change.

**Rationale**: Spec already defines this (FR-004, User Story 2). Single reusable component or helper used in sidebar, header, and profile/settings keeps consistency.

**Alternatives considered**: Backend endpoint that returns avatar URL or letter—rejected; client has user object and can derive display.
