# Research: Admin-Only Access and Email Invites

**Branch**: `001-admin-invite-users` | **Date**: 2025-02-16

## 1. Seeded Admin and “Always Exists”

**Decision**: Create the admin user and auth identity via a **database seed script** (or migration + seed) that runs on deploy or first run. Store the fixed email (cliff@gmail.com) and password hash (for secret1234) in the seed; do not hardcode plaintext password in application code. Ensure the seeded user is a member of the owner organization so existing `is-super-admin` and org-based checks continue to work.

**Rationale**: Spec requires exactly one pre-existing admin; a seed is idempotent and keeps credentials out of runtime config. Reusing existing org/membership model avoids a separate “global admin” flag and stays consistent with the rest of the app.

**Alternatives considered**: Env vars for admin email/password at runtime (rejected: spec asks for fixed identity in DB); creating admin on first login (rejected: spec says “always exist in the database”).

---

## 2. Invite Token and Link Format

**Decision**: Use a **secure random token** (e.g. 32-byte hex or crypto.randomBytes) stored in a new `user_invites` table. Invite link format: `/accept-invite?token=<token>`. Token is single-use and has an expiry (e.g. 7 days). No need for signed JWTs; a random token in the DB is sufficient and allows revoke/list by admin.

**Rationale**: Aligns with existing patterns (e.g. verification codes, client portal tokens). Single table lookup by token is simple and testable; expiry and usedAt prevent reuse.

**Alternatives considered**: Reusing `verification_codes` with purpose `invite` (possible but mixes “user creation” with OTP-style codes; a dedicated invite table is clearer for “pending user” state). JWT (adds complexity; revoke/list harder).

---

## 3. Where to Store User Invites

**Decision**: Add a **user_invites** table in the shared layer. Place it in `shared/models/auth.ts` (with users/sessions) so auth-related entities stay together; alternatively in `shared/models/organizations.ts` if we later tie invites to a specific org. For “admin invites a user to the app” (no org scope in spec), auth.ts is the natural place.

**Rationale**: Keeps “who can sign in” and “pending invites” in one domain. Existing `organization_invites` is for inviting someone to an org; user_invites is for creating a new app user.

**Alternatives considered**: Reusing organization_invites without org (rejected: semantic mismatch). New file shared/models/invites.ts (acceptable if we want a separate domain later).

---

## 4. Admin Identification for Invite Permission

**Decision**: Restrict “invite user by email” to the **seeded admin** by checking that the authenticated user’s email is the fixed admin email (cliff@gmail.com). Optionally later extend to “any user with super-admin” (e.g. isSuperAdmin from existing `/api/auth/is-super-admin`) so more than one admin can invite.

**Rationale**: Spec says “only the admin can invite”; minimal change is to allow only the seeded account. Reusing is-super-admin is a small extension and keeps permission logic consistent.

**Alternatives considered**: New role “inviter” in DB (overkill for single admin). Org-scoped invite only (spec does not require it for this feature).

---

## 5. Invite Flow and Duplicate Handling

**Decision**: On “invite by email”: (1) If email already has an auth identity (existing user), return 400 with a clear message; do not create a duplicate. (2) If there is an existing pending invite for that email, either **resend** (new token, new expiry) or return “already invited” with option to resend; spec allows “resend or update.” Prefer: allow resend (replace token, extend expiry, send email again) so duplicate invite idempotent.

**Rationale**: Prevents duplicate users (FR-005) and duplicate invite rows; resend improves UX when invitee loses the email.

**Alternatives considered**: Block second invite until first expires (stricter; spec says “resend or update” so resend is allowed).
