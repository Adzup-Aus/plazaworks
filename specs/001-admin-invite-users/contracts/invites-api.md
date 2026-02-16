# Invites API Contract

**Branch**: `001-admin-invite-users` | **Date**: 2025-02-16

Base URL: same as existing API (e.g. relative `/api/...`). All endpoints use JSON where a body is present. Session cookie required for admin endpoints.

---

## 1. Create invite (admin only)

**POST** `/api/invites`

**Description**: Admin sends an invite to an email address. System creates or updates a pending invite and sends an email with the invite link.

**Auth**: Required. Caller must be the seeded admin (e.g. email cliff@gmail.com) or otherwise authorized as super-admin.

**Request body**:

```json
{
  "email": "invitee@example.com"
}
```

- `email`: string, required, valid email format.

**Responses**:

- **201 Created**
  - Body: `{ "message": "Invitation sent", "inviteId": "<id>", "email": "<normalized email>", "expiresAt": "<ISO timestamp>" }`
  - Invite created or resent; email sent (or queued).

- **400 Bad Request**
  - `{ "message": "Email is already registered" }` — there is already an auth identity (user) for this email.
  - `{ "message": "Invalid email" }` or validation errors (e.g. missing or malformed email).

- **401 Unauthorized**
  - Not logged in or not the admin.

- **403 Forbidden**
  - Logged in but not allowed to invite (e.g. not super-admin).

- **500 Internal Server Error**
  - Generic error (e.g. email send failure; message may be generic for security).

---

## 2. List invites (admin only)

**GET** `/api/invites`

**Description**: Returns pending (and optionally used/expired) invites for the admin to manage.

**Auth**: Required. Same as create invite.

**Query** (optional):

- `status`: `pending` | `used` | `expired` | omit (all). Filter by invite state.

**Responses**:

- **200 OK**
  - Body: `{ "invites": [ { "id", "email", "expiresAt", "usedAt", "createdAt", "invitedBy" } ] }`
  - Array of invite objects; ordered by createdAt desc by default.

- **401 Unauthorized** / **403 Forbidden**: Same as create.

---

## 3. Get invite by token (public, for accept flow)

**GET** `/api/invites/accept?token=<token>`

**Description**: Validates the invite token and returns the email (and possibly invite id) so the client can show “Set password for …” and submit to accept. Does not require auth.

**Auth**: None.

**Query**:

- `token`: string, required. The token from the invite link.

**Responses**:

- **200 OK**
  - Body: `{ "email": "<masked or full>", "valid": true, "inviteId": "<id>" }`
  - Token is valid and not expired/used. Client uses this to show the form and submit to POST accept.

- **400 Bad Request**
  - Body: `{ "message": "Invalid or expired invite link", "valid": false }`
  - Token missing, wrong, expired, or already used.

---

## 4. Accept invite (set password, create account)

**POST** `/api/invites/accept`

**Description**: Consumes the invite token and creates the user and auth identity with the given password. Marks invite as used. Invitee can then log in with email/password.

**Auth**: None (token is the auth).

**Request body**:

```json
{
  "token": "<token from link>",
  "password": "min 8 chars"
}
```

- `token`: string, required.
- `password`: string, required, minimum 8 characters.

**Responses**:

- **200 OK** or **201 Created**
  - Body: `{ "message": "Account created. You can now sign in.", "userId": "<id>" }`
  - User and auth identity created; invite marked used. Client redirects to login.

- **400 Bad Request**
  - `{ "message": "Invalid or expired invite link" }` — token invalid/expired/used.
  - `{ "message": "Password must be at least 8 characters" }` — validation.

- **500 Internal Server Error**
  - Duplicate key or other server error (e.g. DB constraint).

---

## 5. Auth and registration (changes)

- **POST** `/api/auth/register`: **Removed or disabled.** Return **404** or **410 Gone** with message that registration is by invite only. No new self-sign-up.

- **GET** `/api/auth/session`, **POST** `/api/auth/login`, etc.: Unchanged. Seeded admin logs in with cliff@gmail.com / secret1234; invited users log in after accepting invite.

- **GET** `/api/auth/is-super-admin`: Unchanged. Used to gate invite UI (only super-admin can access invite list and create-invite).

---

## 6. Email (out of contract scope)

- System sends one email per invite (create or resend) to the given address.
- Content must include the accept-invite link: base URL + `/accept-invite?token=<token>`.
- Exact template and “from” address are implementation details; use existing Resend (or configured) sender.
