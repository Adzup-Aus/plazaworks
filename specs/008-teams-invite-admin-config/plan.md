# Implementation Plan: Invite from Teams Page with Admin-Configured User Info

**Branch**: `008-teams-invite-admin-config` | **Date**: 2025-03-13 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/008-teams-invite-admin-config/spec.md`

## Summary

Move invite functionality to the **Team** page (`/team`) so admins create and send invites from one place. When creating an invite, the admin configures all user information (email, first name, last name, role, optional permissions and profile image); the invited user is only asked to set a password when accepting. Backend: extend `user_invites` with `firstName`, `lastName`, `profileImageUrl`; extend POST `/api/invites` to accept and store these; change POST `/api/invites/accept` to accept only `token` and `password` and create the user from invite data. Frontend: add invite creation and list to the Team page; simplify accept-invite page to password-only form. No new backend module—changes in existing auth module and client (Team page, accept-invite page).

## Technical Context

**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: Express, React 18, Vite, Drizzle ORM, TanStack Query, Zod, bcrypt, Resend (email); existing upload (R2/Replit) for profile image  
**Storage**: PostgreSQL (Drizzle); `user_invites` extended with firstName, lastName, profileImageUrl; `users` already has these fields  
**Testing**: Vitest, supertest; `npm run test:env` for verification  
**Target Platform**: Web (Node server + browser client)  
**Project Type**: Web (monorepo: server/, client/, shared/)  
**Performance Goals**: Standard web app; invite create/accept within existing latency expectations  
**Constraints**: Speckit Constitution (modules under server/modules/, shared schema, API tests); extend auth module only  
**Scale/Scope**: Same as existing invite flow; Team page becomes single entry for member/invite management

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Rule | Status | Notes |
|------|--------|--------|
| New feature routes under `server/modules/<featureName>/routes.ts` | Pass | No new module; extend `server/modules/auth/routes.ts` (invites and accept). |
| `model.ts` re-exports from `@shared/schema` only | Pass | Auth module model re-exports; new columns in shared/models/auth.ts. |
| New tables/columns in `shared/schema.ts` or `shared/models/<domain>.ts` | Pass | Add firstName, lastName, profileImageUrl to `user_invites` in shared/models/auth.ts. |
| Register module in `server/routes/index.ts` | Pass | Auth already registered. |
| API tests in `server/__tests__/api.<feature>.test.ts` | Pass | Update api.auth.test.ts for new invite payload and password-only accept. |
| `npm run test:env` passes after changes | Pass | Required before considering done. |
| New screens: page in `client/src/pages/`, Route in App.tsx | Pass | Extend Team page with invite UI; accept-invite page simplified (password only). No new route; /team and /accept-invite exist. |
| Data: TanStack Query, types from `@shared` | Pass | Use existing patterns; types from @shared/schema. |

**Structure Decision**: Extend auth module (invite create/accept) and client Team page (invite form + list). Accept-invite page becomes password-only. Optional: remove or redirect /admin/invites so primary flow is Team page.

## Project Structure

### Documentation (this feature)

```text
specs/008-teams-invite-admin-config/
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
│       ├── routes.ts      # Extend: POST /api/invites (firstName, lastName, profileImageUrl; validate required); POST /api/invites/accept (password only; create user from invite); GET /api/invites (return new fields)
│       └── model.ts       # Re-export userInvites with new columns
├── repositories/
│   └── AuthTenantRepository.ts  # updateUserInvite: allow firstName, lastName, profileImageUrl
├── storage.ts            # updateUserInvite signature extended
└── __tests__/
    └── api.auth.test.ts   # Invite with firstName/lastName; accept with password only; duplicate email

shared/
└── models/
    └── auth.ts            # user_invites: add firstName, lastName, profileImageUrl

client/
├── src/
│   ├── App.tsx            # Optional: redirect /admin/invites to /team or remove admin invite route
│   ├── pages/
│   │   ├── team.tsx       # Add invite creation form (email, firstName, lastName, role, optional permissions/profile) and invite list
│   │   └── accept-user-invite.tsx  # Simplify to password + confirm only; remove firstName, lastName, profile upload
│   └── components/
│       └── app-sidebar.tsx  # Optional: move "Invite users" under Team or remove from admin nav
```

## Complexity Tracking

No constitution violations. Table left empty.
