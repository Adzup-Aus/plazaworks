# Feature Specification: Admin-Only Access and Email Invites

**Feature Branch**: `001-admin-invite-users`  
**Created**: 2025-02-16  
**Status**: Draft  
**Input**: User description: "I want to remove the registration form. Also I want to have an admin user that would always exist in the database email cliff@gmail.com password is secret1234. Since I am removing the register I want to add the ability for the admin to invite user using email"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin Logs In with Seeded Account (Priority: P1)

The system provides a single fixed admin account that always exists. The admin can sign in using email cliff@gmail.com and password secret1234 to access admin capabilities, including the ability to invite users.

**Why this priority**: Without a working admin account, no one can invite users or manage access.

**Independent Test**: Can be fully tested by navigating to the login page, entering the admin email and password, and confirming the user is signed in and can access admin areas (e.g. invite UI).

**Acceptance Scenarios**:

1. **Given** the application is deployed, **When** the admin enters cliff@gmail.com and secret1234 on the login page and submits, **Then** the admin is signed in and can access the application.
2. **Given** the admin is not signed in, **When** they go to the login page, **Then** they see a login form only (no registration or sign-up option).
3. **Given** the admin enters wrong credentials, **When** they submit, **Then** they see a clear error and are not signed in.

---

### User Story 2 - Admin Invites User by Email (Priority: P2)

The admin can invite new users by entering their email address. The system sends an invitation (e.g. email with a link or instructions) so the invited person can set up access. Only the admin can create new user accounts; there is no public registration form.

**Why this priority**: This replaces self-registration and controls who can use the system.

**Independent Test**: Can be tested by signing in as admin, submitting an invite for a valid email, and verifying the invite is recorded and the invitee receives (or can see) the next step to gain access.

**Acceptance Scenarios**:

1. **Given** the admin is signed in, **When** they enter a valid email and submit an invite, **Then** the system accepts the invite and the invited user is sent an invitation (e.g. email with link or one-time setup instructions).
2. **Given** the admin is signed in, **When** they try to invite an email that is already a user, **Then** the system informs them and does not create a duplicate account.
3. **Given** the admin is signed in, **When** they submit an invalid or empty email, **Then** the system shows a validation error and does not send an invite.
4. **Given** a user is not an admin, **When** they try to access the invite action, **Then** they cannot invite others (invite is restricted to the admin).

---

### User Story 3 - Invited User Accepts and Gains Access (Priority: P3)

A person who receives an invite can complete a one-time setup (e.g. set password, confirm email) and then sign in like any other user. Until they complete this step, they do not have access.

**Why this priority**: Completes the invite flow so invited users can actually use the system.

**Independent Test**: Can be tested by using the link or instructions from an invite, completing the required steps (e.g. set password), and then signing in and accessing the application.

**Acceptance Scenarios**:

1. **Given** a user has been invited and has a valid invite link or token, **When** they open it and complete the required setup (e.g. set password), **Then** their account is activated and they can sign in with that email and password.
2. **Given** an invite has expired or already been used, **When** the invitee tries to use it, **Then** they see a clear message and are offered a way to request a new invite (e.g. contact admin) or sign in if already set up.
3. **Given** an invited user has completed setup, **When** they sign in, **Then** they have the same type of access as other non-admin users (no invite capability unless they are an admin).

---

### Edge Cases

- What happens when the admin invites the same email twice before the first invite is accepted? System should treat the second invite as a resend or update (e.g. new link, same account intent) and avoid duplicate accounts.
- How does the system handle an invite sent to an invalid or non-existent email address? Invitation is recorded and sent; bounces or delivery failures are handled by normal email delivery rules; no need to block invite submission for unverifiable addresses.
- What happens when an invited user never completes setup? The invite remains in a pending state; admin can see pending invites and optionally resend or revoke.
- What happens if the seeded admin credentials need to change? Assumption: change is done via deployment or configuration (e.g. env or seed script); in-spec change-password for admin can be a follow-up if needed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide exactly one pre-existing admin user with email cliff@gmail.com and password secret1234, available after deployment or database seed.
- **FR-002**: System MUST remove or hide the public registration form and any public sign-up flow so new users cannot self-register.
- **FR-003**: System MUST allow the admin to invite users by submitting an email address; only users with admin role (or the seeded admin) can perform invites.
- **FR-004**: System MUST send an invitation to the provided email (e.g. email containing a link or token) so the invitee can complete a one-time setup (e.g. set password) and gain access.
- **FR-005**: System MUST prevent duplicate user accounts when inviting an email that is already registered; the system must inform the admin instead of creating a second account.
- **FR-006**: System MUST validate invite input (e.g. required, valid email format) and show clear errors when validation fails.
- **FR-007**: Invited users MUST be able to complete a one-time setup (e.g. set password) via the invitation and then sign in with email and password.
- **FR-008**: System MUST treat expired or already-used invite links/tokens clearly (e.g. message and option to request a new invite or sign in).

### Key Entities

- **Admin user**: The single seeded user (cliff@gmail.com) with permission to invite others; identified by role or fixed identity.
- **Invitation**: Represents a pending invite (email, status, optional expiry and token/link); links one invited email to one eventual user account.
- **User**: An account that can sign in; created either as the seeded admin or via completing an invitation (no self-registration).

## Assumptions

- The seeded admin (cliff@gmail.com / secret1234) is created by a database seed or migration that runs on deploy or first run; credentials are not stored in the spec as runtime secrets but as the required initial values.
- “Invite by email” means the admin submits an email and the system sends an email to that address containing a link or instructions; the invitee sets a password (or receives a temporary one) as part of setup. Exact email content and template are out of scope for this spec.
- Invite links or tokens have a reasonable expiry (e.g. 7 days); exact duration can be chosen by implementation.
- Non-admin users (including invited users after setup) do not have access to the invite action; only the seeded admin (or future admins if role is extended) can invite.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Admin can sign in with the seeded credentials within one minute of deployment and access the invite capability.
- **SC-002**: Admin can send an invite for a new email and the invitee receives the invitation (email or in-app) and can complete setup and sign in in a single session.
- **SC-003**: No user can create an account without an invite or without being the seeded admin; attempts to access registration are blocked or the registration entry point is removed.
- **SC-004**: Duplicate invites for the same email do not create duplicate accounts; the admin receives clear feedback when the email is already registered.
