# Implementation Plan: Full Account Setup for Invited Users

**Branch**: `007-invite-account-setup` | **Date**: 2025-03-08 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/007-invite-account-setup/spec.md`

## Summary

Replace the current password-only invite acceptance flow with a **full account setup page** where the invited user provides first name, last name, password (and confirm), and optional profile image (file upload). After setup, redirect to login with a success message. Where the app shows the user (sidebar, header, profile), display either the uploaded profile image or a **first-letter avatar** fallback (first name, or email/local part, or generic placeholder). Extend the **invitation process** so the inviter can assign **specific permissions** (and optionally a role) to the invite; on accept, the created staff profile receives the union of role permissions and explicitly assigned permissions. No new backend module: changes live in existing **auth** module (invites, accept) and **client** (new full account setup page, avatar component, invite UI for permissions).

## Technical Context

**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: Express, React 18, Vite, Drizzle ORM, TanStack Query, Zod, bcrypt, Resend (email); existing upload (S3/GCS) if used elsewhere  
**Storage**: PostgreSQL (Drizzle); `users` already has firstName, lastName, profileImageUrl; `user_invites` has roleId; add permissions storage on invite  
**Testing**: Vitest, supertest; `npm run test:env` for verification  
**Target Platform**: Web (Node server + browser client)  
**Project Type**: Web (monorepo: server/, client/, shared/)  
**Performance Goals**: Standard web app; profile image upload within size limits (e.g. 5MB)  
**Constraints**: Must follow Speckit Constitution (modules under server/modules/, shared schema, API tests); no new feature module—extend auth module  
**Scale/Scope**: Same as existing invite flow; avatar shown in sidebar, header, profile; permission set from existing roles/permissions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Rule | Status | Notes |
|------|--------|--------|
| New feature routes under `server/modules/<featureName>/routes.ts` | Pass | No new module; extend `server/modules/auth/routes.ts` (invites and accept already there). |
| `model.ts` re-exports from `@shared/schema` only | Pass | Auth module model re-exports; any new column in shared/models/auth.ts. |
| New tables/columns in `shared/schema.ts` or `shared/models/<domain>.ts` | Pass | Add `permissions` (text[]) to `user_invites` in shared/models/auth.ts; `users` already has firstName, lastName, profileImageUrl. |
| Register module in `server/routes/index.ts` | Pass | Auth already registered; no new module. |
| API tests in `server/__tests__/api.<feature>.test.ts` | Pass | Add/update tests in api.auth.test.ts for accept (firstName, lastName, profileImageUrl, duplicate email, 400/500) and invite create (permissions). |
| `npm run test:env` passes after changes | Pass | Required before considering done. |
| New screens: page in `client/src/pages/`, Route in App.tsx | Pass | New/replace accept-invite page with full account setup page; route already exists (e.g. /accept-invite). Avatar in sidebar/header/profile. |
| Data: TanStack Query, types from `@shared` | Pass | Use existing patterns; types from @shared/schema. |

**Structure Decision**: Extend existing auth module and client pages. No new module. New/replaced page: full account setup (replace or rename current accept-user-invite flow). Shared avatar component or helper for first-letter fallback. Invite create UI (admin) extended to allow selecting permissions (and optional role).

## Project Structure

### Documentation (this feature)

```text
specs/007-invite-account-setup/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/           # Phase 1 API contracts
└── tasks.md             # Phase 2 (/speckit.tasks)
```

### Source Code (repository root)

```text
server/
├── modules/
│   └── auth/
│       ├── routes.ts      # Extend: POST /api/invites/accept (firstName, lastName, profileImageUrl; duplicate email 400/409); POST /api/invites (permissions[]); GET /api/invites/accept (unchanged)
│       └── model.ts       # Re-export users, userInvites (with new permissions column)
├── __tests__/
│   └── api.auth.test.ts  # Add: accept with firstName/lastName/profileImageUrl; duplicate email; invite with permissions
shared/
├── schema.ts
└── models/
    └── auth.ts            # users (existing), userInvites: add permissions text[] column
client/
├── src/
│   ├── App.tsx            # Route for full account setup (e.g. /accept-invite unchanged path)
│   ├── pages/
│   │   ├── accept-user-invite.tsx  # Replace with full account setup (first name, last name, password, confirm, optional photo upload)
│   │   └── invite.tsx (or admin invite UI)  # Add permission selector (and optional role) when creating invite
│   └── components/        # Avatar component or util: show profileImageUrl or first-letter fallback (firstName → email → placeholder)
```

## Complexity Tracking

No constitution violations. Table left empty.
