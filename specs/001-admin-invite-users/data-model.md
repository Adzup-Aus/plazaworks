# Data Model: Admin-Only Access and Email Invites

**Branch**: `001-admin-invite-users` | **Date**: 2025-02-16

## Existing Entities (unchanged structure, usage changes)

### users (shared/models/auth.ts)

- **Purpose**: App users; one row per account.
- **Relevant fields**: id, email, firstName, lastName, createdAt, updatedAt.
- **Change in usage**: New rows created only by (1) seed (admin) or (2) accepting a user invite (no self-registration).

### auth_identities (shared/models/organizations.ts)

- **Purpose**: Login identity (email/phone + optional password hash).
- **Relevant fields**: id, userId, type, identifier, passwordHash, isVerified, isPrimary, lastUsedAt.
- **Change in usage**: New email identities created by seed (admin) or when invitee completes “accept invite” (set password).

### verification_codes (shared/models/organizations.ts)

- **Purpose**: OTP/verification codes for login, verify_email, password_reset.
- **No change**: Invite flow uses a separate table (user_invites), not verification_codes.

### organization_members (shared/models/organizations.ts)

- **Purpose**: Links user to organization with a role.
- **Relevant for seed**: Seeded admin must be a member of the owner organization (e.g. role owner or admin) so existing is-super-admin and UI work.

---

## New Entity

### user_invites

- **Purpose**: Pending invite to create a new app user. One row per invited email until used or expired.
- **Location**: `shared/models/auth.ts` (or a new file re-exported from shared/schema.ts).

| Field       | Type        | Constraints | Description |
|------------|-------------|-------------|-------------|
| id         | varchar     | PK, default gen_random_uuid() | Unique invite id. |
| email      | varchar(255)| NOT NULL, indexed | Invited email (normalized lowercase). |
| token      | varchar(64) | NOT NULL, UNIQUE, indexed | Secure random token for the invite link. |
| invitedBy  | varchar     | NOT NULL    | userId of admin who sent the invite. |
| expiresAt  | timestamp   | NOT NULL    | Invite valid until this time (e.g. 7 days). |
| usedAt     | timestamp   | NULL        | Set when invitee completes setup (account created). |
| createdAt  | timestamp   | default now() | When invite was created. |

- **Validation**: email format (Zod/DB); token generated server-side (e.g. 32-byte hex); expiresAt > createdAt.
- **State**: Pending (usedAt IS NULL AND expiresAt > now()), Used (usedAt IS NOT NULL), Expired (expiresAt <= now() AND usedAt IS NULL).
- **Uniqueness**: One pending invite per email: when creating a new invite, either replace existing pending row for that email (resend) or return “already invited” and optionally resend. No duplicate users: if an auth_identity already exists for that email, do not create an invite (return 400).

---

## Relationships

- **user_invites.invitedBy** → users.id (admin who sent the invite).
- **user_invites.email** → used to create auth_identities.identifier (type `email`) and users.email when invite is accepted.
- No FK from user_invites to auth_identities or users for “created user” (optional: add acceptedUserId later if we want to link; not required for MVP).

---

## Seed Data (conceptual)

- **Admin user**: One row in `users` (e.g. id fixed or from seed) with email `cliff@gmail.com`.
- **Admin identity**: One row in `auth_identities`: type `email`, identifier `cliff@gmail.com`, passwordHash = bcrypt(secret1234), isVerified true, isPrimary true, userId = admin user id.
- **Org membership**: Ensure admin user is in the owner organization (organization_members) with role owner or admin so `/api/auth/is-super-admin` and existing admin UI behave correctly.

---

## Indexes

- user_invites: index on (email), unique index on (token), index on (expiresAt, usedAt) for cleanup/list queries.
