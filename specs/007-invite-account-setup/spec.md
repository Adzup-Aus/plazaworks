# Feature Specification: Full Account Setup for Invited Users

**Feature Branch**: `007-invite-account-setup`  
**Created**: 2025-03-08  
**Status**: Draft  
**Input**: User description: "Currently once a user is invited he only set the password. We need a full account page where the user can assign firstname, lastname and upload a photo. If no photo is provided then the first letter of his firstname is shown (like in Gmail and other platforms). Ensure that the invited user gets forwarded to the full account info so he need to set Firstname, Lastname, password and profile image is optional. Allow assigning specific permissions to invited users during the invitation process."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Invited User Is Redirected to Full Account Setup (Priority: P1)

When an invited user opens the invite link, they are taken to a full account setup page (not the current password-only page). On this page they must provide first name, last name, and password; profile image is optional. Until they complete this step, they cannot sign in.

**Why this priority**: This is the core behavior change—invite flow must lead to the new full account page instead of the old password-only flow.

**Independent Test**: Open an invite link with a valid token; confirm the page shows fields for first name, last name, password (and confirm), and optional profile photo; submit with valid data and confirm account is created and user can sign in.

**Acceptance Scenarios**:

1. **Given** an invited user has a valid invite link, **When** they open it, **Then** they see the full account setup page with first name, last name, password, confirm password, and optional profile image (not the old password-only form).
2. **Given** the user is on the full account setup page, **When** they leave first name, last name, or password empty or invalid, **Then** the form shows validation errors and does not submit.
3. **Given** the user submits valid first name, last name, and password (and optionally a photo), **Then** the account is created, the invite is marked used, and they are informed they can sign in (e.g. redirect to login or success message).
4. **Given** the user has completed account setup, **When** they sign in with email and password, **Then** they can access the application and their first name, last name, and profile image (or fallback) are reflected in the app (e.g. sidebar, header).

---

### User Story 2 - Profile Image Optional; Avatar Fallback (Priority: P2)

Profile image upload is optional. Where the app displays the user (e.g. sidebar, header, profile), if no profile image is set, the system shows an avatar with the first letter of the user’s first name (e.g. “J” for “John”), similar to Gmail and other platforms.

**Why this priority**: Ensures consistent UX and avoids broken or empty avatars when no photo is provided.

**Independent Test**: Create an account without uploading a photo; sign in and confirm avatar shows the first letter of first name. Upload a photo and confirm the photo is shown instead.

**Acceptance Scenarios**:

1. **Given** a user has no profile image, **When** the app displays their avatar (sidebar, header, profile, etc.), **Then** an avatar with the first letter of their first name is shown (e.g. circle with “J” for “John”).
2. **Given** a user has a profile image, **When** the app displays their avatar, **Then** the uploaded image is shown (no letter fallback).
3. **Given** a user has no first name set (edge case), **When** displaying avatar, **Then** the system uses a sensible fallback (e.g. first letter of email, or a generic placeholder) so the UI never breaks.

---

### User Story 3 - Invite Accept API and Data (Priority: P3)

The backend accepts first name, last name, and optional profile image (or URL) as part of invite acceptance. User record is created with email (from invite), first name, last name, password hash, and optionally profile image URL. Existing auth and invite semantics (token validity, single use, expiry) are unchanged.

**Why this priority**: Required for the full account setup flow; can be tested via API and storage.

**Independent Test**: Call POST /api/invites/accept with token, password, firstName, lastName, and optionally profileImageUrl (or upload); verify user row has correct firstName, lastName, profileImageUrl; verify invite is marked used and user can log in.

**Acceptance Scenarios**:

1. **Given** a valid invite token, **When** the client sends first name, last name, password (and optionally profile image), **Then** the API creates the user with these fields and returns success.
2. **Given** invalid or missing required fields (e.g. missing first name), **When** the client submits, **Then** the API returns 400 with a JSON body indicating which field(s) failed (e.g. message or field-level errors).
3. **Given** an expired or already-used token, **When** the client submits, **Then** the API returns an error and does not create an account.
4. **Given** the invite email already has an account, **When** the client submits accept, **Then** the API returns 400 or 409 with a clear message and does not create a duplicate user. Server errors (e.g. storage failure) return 500.

---

### User Story 4 - Assign Permissions During Invitation (Priority: P4)

When an admin (or other authorized user) creates an invite, they can assign specific permissions to the invited user for when they accept. **Only users authorized to create invites (e.g. admin) may assign permissions.** Optionally they can also assign a role (as today); the invited user’s staff profile, once they complete account setup, receives the permissions from the role and/or the explicitly assigned permissions.

**Why this priority**: Enables fine-grained access control at invite time without requiring a pre-defined role for every combination of permissions.

**Independent Test**: Create an invite with a chosen set of permissions (and optionally a role); accept the invite and complete account setup; sign in and verify the user has the assigned permissions (e.g. can access only the allowed features).

**Acceptance Scenarios**:

1. **Given** the inviter is authorized to create invites, **When** they create an invite, **Then** they can optionally assign a role and/or a specific list of permissions from the system’s permission set.
2. **Given** an invite was created with specific permissions (and optionally a role), **When** the invited user accepts and completes account setup, **Then** the created staff profile has those permissions (role-derived and/or explicitly assigned) so the user can access only the allowed features.
3. **Given** the inviter submits an invalid or disallowed permission key, **When** the invite is created or updated, **Then** the system stores only valid permission keys (invalid keys are dropped); the API may return 400 if any invalid key is present, or 201 with the stored (valid-only) list.
4. **Given** both a role and explicit permissions are assigned on the invite, **When** the invite is accepted, **Then** the user’s effective permissions are the **union** of the role’s permissions and the explicitly assigned permissions (merge rule: union; applied consistently).

---

### Edge Cases

- What happens when the user submits the form with only spaces for first or last name? (Trim and treat as empty; show validation.)
- What happens when the uploaded image is very large or an invalid file type? (Limit to allowed types (e.g. image/jpeg, image/png, image/webp) and max size (e.g. 5MB); return clear error or reject.)
- What happens when the user has no first name stored (legacy or bug)? (Avatar fallback: use first letter of email or generic placeholder.)
- What happens if the user completes account setup but the session is not created automatically? (Redirect to login with success message so they can sign in.)
- What happens when the inviter assigns a permission that is later removed from the system? (On accept, only currently valid permissions are applied; invalid ones are ignored or rejected.)
- What happens when the invite email already has an account? (Accept MUST fail with 400 or 409 and a clear message; do not create a duplicate user.)
- Invalid or unknown permission keys at invite create/update: only valid keys are stored (invalid keys dropped); implementation may return 400 if any invalid key is present.
- If the role assigned to the invite is deleted before accept: on accept, only the invite’s explicit permissions are applied (role-derived permissions omitted).
- Empty permission list: allowed; inviter may assign no explicit permissions (and optionally no role).
- Updating an existing invite (e.g. resend): if supported, the same validation and storage rules apply to permissions (overwrite with the new list).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The invite acceptance flow MUST direct the user to a full account setup page that collects first name, last name, password (and confirm), and optional profile image. Profile image is captured via **file upload**; the system stores a URL (or equivalent) after upload. Implementation may support URL-only in addition.
- **FR-002**: First name and last name MUST be required on account setup; both MUST be trimmed of leading/trailing whitespace and non-empty after trim. Reasonable max length (e.g. 100 characters each) MAY be enforced. Password MUST remain required and meet **existing policy: minimum 8 characters**.
- **FR-003**: Profile image MUST be optional; the system MUST support displaying the user when no profile image is set.
- **FR-004**: Where the app displays the user’s avatar and no profile image exists, the system MUST show the first letter of the user’s first name. **Avatar display locations** include at least: sidebar, header, and profile/settings. When first name is missing (e.g. legacy or bug), **fallback** MUST be: first letter of the user’s email (local part or first character); if no email, a generic placeholder (e.g. “?” or default avatar) so the UI never breaks.
- **FR-005**: The invite accept API MUST accept and persist first name, last name, and optionally profile image (or URL) when creating the user; existing token/expiry/use-once semantics MUST be preserved.
- **FR-006**: After successful account setup, the user MUST be **redirected to the login page** with a **success message** (e.g. “Account created. You can now sign in.”). There is no auto-sign-in; they MUST NOT be left on a dead page.
- **FR-007**: Existing users (already created without first/last name or photo) MUST still be able to sign in; avatar fallback MUST work when first name or photo is missing (including legacy null values for firstName, lastName, profileImageUrl).
- **FR-008**: The invitation process MUST allow the inviter to assign specific permissions to the invited user (from the **system’s defined permission set**, i.e. the same set as used for roles, e.g. UserPermission in shared/models/staff.ts or GET /api/permissions). The inviter may assign a role only, permissions only, both, or **neither**; if neither, the created user has no role and no explicit permissions (empty staff profile or omit).
- **FR-009**: When an invite is accepted, the created staff profile MUST receive the permissions assigned at invite time (from role and/or explicit permission list). **Merge rule:** effective permissions = **union** of role permissions and explicitly assigned permissions. Only **valid, current** permissions (keys present in the system permission set at accept time) MUST be applied; invalid keys are ignored.

### Key Entities

- **User**: id, email, firstName, lastName, profileImageUrl (optional), plus existing auth fields. **Schema**: Already present in `shared/models/auth.ts` (users table); invite flow and UI populate and display them.
- **Invite (user_invites)**: Unchanged semantics; accept flow still consumes token and marks invite used; new payload includes firstName, lastName, optional profile image. Invite creation/update supports assigning a role and/or an explicit list of permissions; **permissions are stored on the invite** (e.g. permissions column on user_invites); API payload for create/update includes optional **permissions** array; **list invites (e.g. GET /api/invites) returns the stored permissions** for each invite so the admin UI can display them. On accept, the created staff profile gets permissions (role-derived and/or explicit). **Staff profile** (shared/models/staff.ts) supports both role-derived and direct permissions (union). **Dependency**: Token validation and single-use semantics follow existing behavior (GET /api/invites/accept, POST /api/invites/accept). **Invite UI** SHOULD use GET /api/permissions to obtain the list of assignable permissions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Invited users who open the invite link land on the full account setup page (not password-only) in 100% of valid-token cases. *Verification*: For any valid, unused, non-expired token, the page shown is the full account setup page (not password-only).
- **SC-002**: Users can complete account setup (first name, last name, password, optional photo) and sign in successfully without errors when validation passes.
- **SC-003**: In all places where user avatar is shown (sidebar, header, profile), either the profile image or the first-letter fallback is displayed (no broken or missing avatar). *Verification*: Inspect each defined avatar location for users with and without profile image and first name.
- **SC-004**: Backend tests (e.g. `npm run test:env`) pass after implementation; existing invite and auth behavior (token validation, single-use, expiry, login) is preserved or extended, not broken. *Verification*: Run test suite; no regressions in existing API or auth tests.
- **SC-005**: Inviters can assign specific permissions (and optionally a role) when creating an invite; after accept and account setup, the user’s effective permissions match what was assigned.
