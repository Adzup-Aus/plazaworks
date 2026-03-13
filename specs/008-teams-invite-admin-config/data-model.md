# Data Model: Invite from Teams Page with Admin-Configured User Info

**Branch**: `008-teams-invite-admin-config` | **Date**: 2025-03-13

## Existing entities (usage / population changes)

### users (shared/models/auth.ts)

- **Purpose**: App users; one row per account.
- **Relevant fields**: id, email, firstName, lastName, profileImageUrl, createdAt, updatedAt.
- **Change**: None. Invite accept flow **populates** these from the invite record (firstName, lastName, profileImageUrl from user_invites) and password from request; no longer from invitee input.

### user_invites (shared/models/auth.ts)

- **Purpose**: Pending invite to create a new app user. Admin configures all user info at invite time; invitee only sets password at accept.
- **Change**: Add **firstName**, **lastName**, and **profileImageUrl** columns so the admin can set them when creating the invite. On accept, user is created from invite email, firstName, lastName, roleId, permissions, profileImageUrl, and request password.

### staff_profiles (shared/models/staff.ts)

- **Purpose**: Staff profile with roles and permissions.
- **Change**: None. When creating staff profile on invite accept, set permissions = union(role permissions, invite.permissions) and roles from role if present (unchanged from current behavior).

---

## New or modified schema

### user_invites – add columns

| Column           | Type    | Constraints | Description |
|------------------|---------|-------------|-------------|
| first_name       | varchar | nullable    | First name set by admin when creating the invite. Applied to user on accept. |
| last_name        | varchar | nullable    | Last name set by admin when creating the invite. Applied to user on accept. |
| profile_image_url| varchar | nullable    | Optional profile image URL/path set by admin. Applied to user on accept. |

- **Location**: `shared/models/auth.ts`.
- **Migration**: Add columns as nullable; existing rows remain valid (nulls for old invites; accept uses null and existing avatar/display logic handles it).

---

## Validation rules (from spec)

- **Invite create**: email required, valid format; firstName and lastName required (trimmed, non-empty, max length e.g. 100); roleId optional; permissions optional (valid keys only); profileImageUrl optional.
- **Invite accept**: token and password required; password meets policy (e.g. min 8 chars). No firstName, lastName, or profileImageUrl in request body; all taken from invite.
- **Duplicate email**: Before creating user on accept, check auth_identity by invite.email; if exists, return 400 and do not create. At invite create, same check applies.

---

## State / flow

- **Invite**: Admin creates invite from Team page with email, firstName, lastName, roleId, optional permissions, optional profileImageUrl. Invite stored with token, expiry, etc. Email sent with accept link.
- **Accept**: Invitee opens link, sees password-only form. Submits token + password. System loads invite, creates user from invite (email, firstName, lastName, profileImageUrl, roleId, permissions) and request (password); creates auth_identity and staff_profile; marks invite used; redirects to login with success message.
- **Backward compatibility**: Invites without firstName/lastName/profileImageUrl (pre-008 or migrated rows): accept still works; user gets null for missing fields; avatar/display use existing fallbacks.
