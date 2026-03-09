# Data Model: Full Account Setup for Invited Users

**Branch**: `007-invite-account-setup` | **Date**: 2025-03-08

## Existing entities (usage / population changes)

### users (shared/models/auth.ts)

- **Purpose**: App users; one row per account.
- **Relevant fields**: id, email, **firstName**, **lastName**, **profileImageUrl**, createdAt, updatedAt.
- **Change**: Already present; invite accept flow must **populate** firstName, lastName, and optionally profileImageUrl when creating the user (today only email is set). Legacy rows may have nulls; avatar fallback handles that.

### user_invites (shared/models/auth.ts)

- **Purpose**: Pending invite to create a new app user.
- **Change**: Add **permissions** column to store explicit permission keys assigned at invite time. Keep roleId; on accept, staff profile gets union of role permissions and invite.permissions (filtered to valid UserPermission enum).

### staff_profiles (shared/models/staff.ts)

- **Purpose**: Staff profile with roles and permissions.
- **Relevant fields**: userId, roles, permissions (text[]).
- **Change**: None. When creating staff profile on invite accept, set permissions = merge(rolePermissions, invitePermissions) and roles from role if present. If no role and no permissions, create staff profile with empty roles/permissions or omit (per existing behavior when invite has no roleId).

---

## New or modified schema

### user_invites – add column

| Column       | Type     | Constraints | Description |
|-------------|----------|-------------|-------------|
| permissions | text[]   | default []  | Explicit permission keys (subset of UserPermission) assigned to this invite. Filtered on write to valid enum; filtered again on accept. |

- **Location**: `shared/models/auth.ts`.
- **Migration**: Add column with default `ARRAY[]::text[]`; existing rows get empty array.

---

## Validation rules (from spec)

- **firstName / lastName**: Trimmed, non-empty after trim, max length e.g. 100 (enforced in API Zod/route).
- **profileImageUrl**: Optional; if present, string (URL or object path from upload).
- **permissions (on invite)**: Array of strings; only keys in `userPermissions` (shared/models/staff.ts) are stored; invalid keys are dropped or 400 returned (implementation choice).
- **Password**: Minimum 8 characters (existing).

---

## State / flow

- **Invite**: Pending → (accept) → Used. Accept creates user (with firstName, lastName, profileImageUrl), auth_identity, and staff_profile (roles + permissions from role and invite.permissions).
- **Duplicate email**: Before creating user, check auth_identity by invite.email; if exists, return 400/409 and do not create.
