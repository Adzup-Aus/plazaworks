# Feature Specification: Invite from Teams Page with Admin-Configured User Info

**Feature Branch**: `008-teams-invite-admin-config`  
**Created**: 2025-03-13  
**Status**: Draft  
**Input**: User description: "Move the invite functionality to teams page. The user do not need to configure anything the admin should be able to configure all users info before sending the invite. The user only configure the password."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Invite Functionality on Teams Page (Priority: P1)

Invite functionality is available from the Teams page. The admin (or authorized user) manages team members and sends invites from this single place, rather than from a separate invite-only page.

**Why this priority**: Centralizing invite under Teams makes member and invite management one coherent flow and ensures the primary entry point for inviting is the Teams page.

**Independent Test**: Can be fully tested by navigating to the Teams page as an admin, confirming that creating and sending an invite is possible from that page, and that the list of pending invites (if shown) is accessible there.

**Acceptance Scenarios**:

1. **Given** the user is an admin (or has permission to invite), **When** they open the Teams page, **Then** they can create and send an invite from that page (e.g. via a clear action such as "Invite user" or "Add member").
2. **Given** the user is on the Teams page, **When** they complete the invite flow (configure user info and send), **Then** the invite is created and the invited person receives the invitation (e.g. email with link); no separate "Invite" page is required for this flow.
3. **Given** the user does not have permission to invite, **When** they open the Teams page, **Then** they do not see or cannot use the invite action (or see only the list of members without invite capability).

---

### User Story 2 - Admin Configures All User Info Before Sending Invite (Priority: P2)

When creating an invite, the admin configures all relevant user information (e.g. email, first name, last name, role and/or permissions, and optionally profile image or placeholder) before sending. The invited user is not asked to fill in any of this information later.

**Why this priority**: This defines the data flow—all user profile and access data is set at invite time by the admin, reducing invited-user effort and ensuring consistency.

**Independent Test**: Create an invite from the Teams page by filling in email, first name, last name, role (and optionally permissions and profile); send the invite. Open the accept flow as the invitee and confirm only password (and confirm password) is requested; after completing, confirm the user account has the first name, last name, and role/permissions the admin set.

**Acceptance Scenarios**:

1. **Given** the admin is on the Teams page and starts creating an invite, **When** they fill in the invite form, **Then** they can set at least: email (required), first name, last name, and role (or equivalent access); optionally profile image or placeholder and explicit permissions if the system supports them.
2. **Given** the admin has set first name, last name, and role (and any optional fields) for the invite, **When** they send the invite, **Then** the system stores this information with the invite and uses it when the invite is accepted to create the user with those values (no prompt to the invitee for name or role).
3. **Given** the admin submits the invite form with missing required fields (e.g. empty email or first name), **When** they try to send, **Then** the system shows validation errors and does not send the invite.
4. **Given** the system supports role and/or permissions, **When** the admin creates an invite, **Then** they can assign a role and/or permissions so that the created user has that access after accepting (no configuration of access by the invitee).

---

### User Story 3 - Invited User Only Configures Password (Priority: P3)

When the invited user opens the invite link, they see a single-purpose flow: set password (and confirm password). They do not configure first name, last name, profile image, or role/permissions—those were set by the admin when the invite was created.

**Why this priority**: Completes the simplified accept flow and ensures the invitee experience matches the requirement that "the user only configure the password."

**Independent Test**: Receive an invite created with first name, last name, and role set by the admin; open the accept link; confirm the page shows only password (and confirm password) fields; submit a valid password and confirm the account is created with the admin-configured name and role and the user can sign in.

**Acceptance Scenarios**:

1. **Given** an invited user has a valid invite link, **When** they open it, **Then** they see a form that asks only for password (and confirm password), with no fields for first name, last name, or profile image.
2. **Given** the invited user is on the accept page, **When** they submit a valid password (and confirm) that meets the system’s password policy, **Then** the system creates the user with the email and all other details (first name, last name, role/permissions, optional profile) taken from the invite; the invite is marked used and they are informed they can sign in (e.g. redirect to login with success message).
3. **Given** the invited user submits an invalid or mismatched password, **When** they submit, **Then** the system shows validation errors and does not create the account until the password is valid and confirmed.
4. **Given** the invite has expired or already been used, **When** the invitee opens the link, **Then** they see a clear message (e.g. invalid or expired) and are not able to set a password for that invite.

---

### Edge Cases

- What happens when the admin invites an email that already has an account? The system must not create a duplicate; it should inform the admin (e.g. "This email is already registered") and not send a new invite or overwrite the existing user.
- What happens when the admin leaves optional fields (e.g. profile image) empty? The created user has no profile image; avatar display uses the existing fallback (e.g. first letter of first name or email) so the UI does not break.
- What happens when the invited user opens the accept link multiple times before submitting? The same password form is shown until they submit successfully or the link expires; after successful accept, the link is no longer valid.
- What happens to existing invites created before this change (e.g. invite with only email and role)? Either they are accepted with the same rules (user only sets password; missing first/last name may be left empty or use email-derived defaults) or the system treats them in a backward-compatible way so no existing invite is broken.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Invite functionality MUST be available from the Teams page so that authorized users can create and send invites from that page without needing a separate dedicated invite page for the primary flow.
- **FR-002**: When creating an invite, the admin (or authorized user) MUST be able to configure at least: email (required), first name, last name, and role (or equivalent); optionally profile image or placeholder and explicit permissions if supported. All of this information MUST be stored with the invite and applied to the user when the invite is accepted.
- **FR-003**: The system MUST NOT ask the invited user to provide first name, last name, or profile image during the accept flow; those values MUST come from the invite (admin-configured).
- **FR-004**: The invite accept flow MUST ask the invited user only for password (and confirm password). Password MUST meet the existing system policy (e.g. minimum length); validation errors MUST be shown for invalid or mismatched passwords.
- **FR-005**: When an invite is accepted, the system MUST create the user with email from the invite, first name and last name from the invite, role and/or permissions from the invite, and the password (and optional profile) from the invite; the user MUST NOT be prompted to re-enter name or role.
- **FR-006**: The system MUST prevent duplicate user accounts when the invite email is already registered; the admin MUST receive clear feedback when attempting to invite an already-registered email.
- **FR-007**: Invite creation from the Teams page MUST validate required fields (e.g. email, first name, last name) and optionally role; invalid or incomplete data MUST result in clear validation messages and no invite sent.
- **FR-008**: After successful invite accept, the user MUST be directed to sign in (e.g. redirect to login with a success message); existing token/expiry/single-use semantics for invites MUST be preserved.

### Key Entities

- **Invite**: Represents a pending invitation. Contains at least: email, first name, last name, role (and optionally permissions and profile image or placeholder), token/link, status, expiry. Used at accept time to create the user with these values; the invitee does not supply name or role.
- **User**: Created when an invite is accepted. Attributes such as first name, last name, role/permissions (and optional profile) are taken from the invite; the user supplies only password at accept time.
- **Teams page**: The page from which invite functionality is accessed; authorized users manage members and send invites from here.

## Assumptions

- A "Teams" page exists or will be introduced as the place where team/member management (and thus invite) lives; the spec does not define the rest of the Teams page content, only that invite is available from it.
- Existing invite semantics (token, expiry, single use, email delivery) remain; only the source of user data (admin at invite time) and the accept flow (password only) change.
- Avatar display for users without profile image continues to use the existing fallback (e.g. first letter of first name or email); no new avatar rules are introduced by this spec.
- Password policy (e.g. minimum 8 characters) is already defined elsewhere and is unchanged.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can create and send an invite entirely from the Teams page (no need to use a separate invite-only page for the primary flow). *Verification*: Perform invite creation from the Teams page and confirm the invite is sent and the invitee receives the link.
- **SC-002**: Invited users can complete acceptance by entering only a password (and confirm); the created account reflects the first name, last name, and role/permissions set by the admin. *Verification*: Create an invite with name and role set, accept as invitee with only password; sign in and confirm profile and access match admin configuration.
- **SC-003**: No duplicate accounts are created when inviting an already-registered email; the admin sees clear feedback. *Verification*: Invite an email that already has an account; confirm no duplicate user and admin receives an appropriate message.
- **SC-004**: Validation prevents sending invites with missing required fields (e.g. email, first name, last name); errors are clear and actionable. *Verification*: Attempt to send an invite with one or more required fields empty; confirm validation messages and no invite sent.
