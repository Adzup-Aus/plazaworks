# Quickstart: Admin-Only Access and Email Invites

**Branch**: `001-admin-invite-users` | **Date**: 2025-02-16

## Prerequisites

- Node and npm installed.
- PostgreSQL running; `DATABASE_URL` in `.env`.
- (Optional) Resend or email config for sending invite emails; if not configured, invite can still be created and token logged to console for testing.

## Setup

1. **Install and DB**
   - `npm install`
   - `npm run db:push` (or run migrations) so `user_invites` and any schema changes are applied.

2. **Seed admin (first time or reset)**
   - Run the admin seed script (e.g. `npx tsx scripts/seed-admin.ts` or equivalent). This ensures:
     - A user exists with email `cliff@gmail.com`.
     - An auth identity exists for that email with password hash for `secret1234`.
     - That user is a member of the owner organization with an admin/owner role.
   - If no owner organization exists, seed may create a default one and add the admin as owner.

3. **Start app**
   - `npm run dev` (backend + client).

## Verify

- **Login**: Open `/login`, sign in with cliff@gmail.com / secret1234. You should be redirected and see the app (e.g. dashboard or jobs).
- **No register**: Visit `/register`; expect 404 or redirect to login with a message that registration is by invite only.
- **Invite (admin)**: As the seeded admin, open the invite UI (e.g. `/invite` or a link in the app). Enter an email, submit. Check that an invite is created and (if email is configured) an email is sent; otherwise check server logs for the invite link.
- **Accept invite**: Open the link from the email (or logs): `/accept-invite?token=...`. Enter a password and submit. You should see success and be able to log in with that email and password.
- **Tests**: `npm run test:env` — all tests, including new invite and auth tests, should pass.

## Key files (after implementation)

- **Backend**: `server/modules/auth/routes.ts` (invite + accept-invite handlers; register disabled). Seed: `scripts/seed-admin.ts` or under `server/scripts/`.
- **Shared**: `shared/models/auth.ts` (user_invites table and types).
- **Client**: `client/src/App.tsx` (routes: remove register; add invite, accept-invite). `client/src/pages/invite.tsx`, `client/src/pages/accept-invite.tsx`.
- **Tests**: `server/__tests__/api.auth.test.ts` (invite and accept-invite cases; register returns 404/410).
