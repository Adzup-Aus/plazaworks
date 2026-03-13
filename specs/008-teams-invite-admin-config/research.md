# Research: Invite from Teams Page with Admin-Configured User Info

**Branch**: `008-teams-invite-admin-config` | **Date**: 2025-03-13

## 1. Where "Teams page" lives

**Decision**: Use the existing **Team** page at `/team` as the Teams page. The app already has a "Team" nav item (view_users permission) and a `client/src/pages/team.tsx` route. Invite functionality will be added there so that member management and inviting are in one place.

**Rationale**: The spec says "invite functionality is available from the Teams page." The codebase has a Team page for users/members; placing invite there avoids introducing a new "Teams" concept and matches the existing navigation.

**Alternatives considered**: Creating a new "Teams" page at a different path was rejected to avoid duplicate concepts with the existing Team page.

---

## 2. Storing admin-configured user data on the invite

**Decision**: Store `firstName`, `lastName`, and optional `profileImageUrl` on the `user_invites` table. On accept, create the user from these fields plus email (from invite), role/permissions (from invite), and password (from request body only).

**Rationale**: The spec requires the admin to configure all user info before sending the invite and the user to only set a password. The only way to satisfy this is to persist the admin-entered data on the invite and apply it at accept time. Existing `user_invites` already stores email, roleId, permissions; extending it with firstName, lastName, profileImageUrl is the minimal schema change.

**Alternatives considered**: Storing pre-filled data in a separate table keyed by invite id was rejected to keep a single source of truth per invite and avoid extra joins.

---

## 3. Backward compatibility for existing invites

**Decision**: For invites created before this change (no firstName, lastName, or profileImageUrl on the row), treat missing values as null when creating the user on accept. Avatar and display logic already support null firstName/lastName (e.g. first letter of email or placeholder). No migration backfill of old invites is required.

**Rationale**: Spec edge case: "What happens to existing invites created before this change? Either they are accepted with the same rules (user only sets password; missing first/last name may be left empty or use email-derived defaults) or the system treats them in a backward-compatible way." Allowing nulls keeps existing invites valid without data migration.

**Alternatives considered**: Backfilling placeholder names (e.g. from email) was rejected for simplicity; null is acceptable and existing avatar/display behavior already handles it.

---

## 4. Accept flow request body (password only)

**Decision**: POST `/api/invites/accept` will accept only `token` and `password` (and optionally `confirmPassword` for client-side validation; server does not require it). Remove requirement for `firstName`, `lastName`, and `profileImageUrl` from the request body; these are read from the invite record.

**Rationale**: Spec FR-003 and FR-004: "The system MUST NOT ask the invited user to provide first name, last name, or profile image during the accept flow" and "The invite accept flow MUST ask the invited user only for password (and confirm password)." The current 007 implementation requires firstName/lastName in the body; this feature reverses that so all profile data comes from the invite.

**Alternatives considered**: Keeping optional override of name/photo on accept was rejected; spec is explicit that the user only configures the password.
