# Implementation Plan: Admin-Only Access and Email Invites

**Branch**: `001-admin-invite-users` | **Date**: 2025-02-16 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/001-admin-invite-users/spec.md`

## Summary

Remove public registration; provide a single seeded admin (cliff@gmail.com / secret1234) and allow that admin to invite users by email. Invitees receive an email with a link/token to set a password and activate their account. All new users are created only via invite or as the seeded admin.

## Technical Context

**Language/Version**: TypeScript 5.6  
**Primary Dependencies**: Express, React 18, Vite, Drizzle ORM, TanStack Query, Zod, bcrypt, Resend (email)  
**Storage**: PostgreSQL (Drizzle); sessions via connect-pg-simple  
**Testing**: Vitest, supertest; `npm run test:env` for verification  
**Target Platform**: Web (Node server + browser client)  
**Project Type**: Web (monorepo: server/, client/, shared/)  
**Performance Goals**: Standard web app; invite email delivery within seconds  
**Constraints**: Must follow Speckit Constitution (modules under server/modules/, shared schema, API tests)  
**Scale/Scope**: Single seeded admin; invite-based user growth; existing auth (auth_identities, users, verification_codes) and org model (organization_members, organization_invites) in place  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Rule | Status | Notes |
|------|--------|--------|
| New feature routes under `server/modules/<featureName>/routes.ts` | Pass | Invite routes will live in auth module or new `server/modules/invites/` (invites are auth-related; can extend auth module). |
| `model.ts` re-exports from `@shared/schema` only | Pass | Any new table in shared/models (auth or new domain); module model.ts re-exports only. |
| New tables in `shared/schema.ts` or `shared/models/<domain>.ts` | Pass | User-invite table will be added in shared (e.g. `shared/models/auth.ts` or organizations). |
| Register module in `server/routes/index.ts` | Pass | If new invites module: add registerInvitesRoutes; else extend auth routes. |
| API tests in `server/__tests__/api.<feature>.test.ts` | Pass | Add/update tests for invite endpoints and auth (remove register tests or expect 404). |
| `npm run test:env` passes after changes | Pass | Required before considering done. |
| New screens: page in `client/src/pages/`, Route in App.tsx | Pass | Remove register route/page; add invite list (admin) and accept-invite (public) pages. |
| Data: TanStack Query, types from `@shared` | Pass | Invite APIs consumed via existing patterns. |

**Structure Decision**: Extend existing auth module for invite-by-email (and seeded admin) so all auth-related routes stay in one place. New table `user_invites` in shared layer; optional dedicated `server/modules/invites/` only if invite logic grows large—otherwise auth module handles it.

## Project Structure

### Documentation (this feature)

```text
specs/001-admin-invite-users/
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
├── index.ts
├── routes/
│   └── index.ts           # Register auth (and optionally invites) routes
├── modules/
│   └── auth/
│       ├── routes.ts      # Login, session, register (remove), verify-email; + invite CRUD, accept-invite
│       └── model.ts       # Re-export users, authIdentities, verificationCodes, userInvites
├── __tests__/
│   └── api.auth.test.ts   # Update: no public register; add invite + accept-invite tests
shared/
├── schema.ts
└── models/
    ├── auth.ts            # users, sessions; add userInvites (or in organizations)
    └── organizations.ts   # authIdentities, verificationCodes, organizationInvites
client/
├── src/
│   ├── App.tsx            # Remove /register route; add /invite (admin), /accept-invite (public)
│   └── pages/
│       ├── register.tsx   # Remove or redirect to login
│       ├── login.tsx
│       ├── invite.tsx      # Admin: list invites, create invite (email)
│       └── accept-invite.tsx  # Public: set password from token
scripts/ or server/scripts/
└── seed-admin.ts          # Seed cliff@gmail.com + auth identity + default org membership (if needed)
```

## Complexity Tracking

No constitution violations. Table left empty.
