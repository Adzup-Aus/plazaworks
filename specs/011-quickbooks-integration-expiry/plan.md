# Implementation Plan: QuickBooks Integration Token Expiry Fix

**Branch**: `011-quickbooks-integration-expiry` | **Date**: 2025-03-12 | **Spec**: `specs/011-quickbooks-integration-expiry/spec.md`
**Input**: Feature specification from `/specs/011-quickbooks-integration-expiry/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Fix the behaviour where the QuickBooks integration appears to “expire” too quickly, by ensuring access tokens are refreshed proactively and the UI connection status reflects whether the integration can still be renewed using stored credentials.

Implementation will rely on the existing QuickBooks module (`server/modules/quickbooks`) and sync service (`server/services/quickbooksSync.ts`) to adjust token refresh thresholds and connection status logic, without changing the fundamental OAuth flow or adding new backend modules.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: Node.js / TypeScript (existing backend and client stack)  
**Primary Dependencies**: Express, TanStack Query, React 18, QuickBooks OAuth client (`intuit-oauth`), Drizzle ORM  
**Storage**: PostgreSQL via Drizzle, using existing `quickbooks_connections` and related tables re-exported from `@shared/schema`  
**Testing**: Vitest backend tests under `server/__tests__`, run via `npm run test:env`  
**Target Platform**: Web application (backend server + React SPA client)
**Project Type**: Web (backend + frontend in a single repo as per constitution)  
**Performance Goals**: Token refresh paths must be fast enough not to noticeably delay sync or status calls; proactive refresh should not introduce significant background load.  
**Constraints**: Must not change OAuth contract with QuickBooks; must respect provider token lifetimes and avoid excessive refresh attempts.  
**Scale/Scope**: Single-tenant per deployment, with QuickBooks integration enabled for a subset of customers; feature scope limited to token lifetime handling and connection status behaviour.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Backend module structure**: Changes stay within existing `server/modules/quickbooks/routes.ts`, `server/services/quickbooksSync.ts`, and `server/storage.ts`; no new feature modules or loose routes are introduced.  
- **Shared schema usage**: Any data shape changes (if needed) will go through `shared/schema.ts` / `shared/models/*` and be re-exported, with modules only importing via their `model.ts`.  
- **Tests**: Add or update API tests under `server/__tests__/api.quickbooks.test.ts` (or equivalent) to cover token expiry behaviour, plus any storage-level tests if token timing logic is complex.  
- **Verification**: After implementation, run `npm run test:env` and ensure all tests pass before merging.  
- **Frontend**: Any UI adjustments for connection status will respect the existing `client/src/pages/integrations.tsx` page structure, use `@/components/ui` components, TanStack Query, and `@shared/schema` types.

All of the above are achievable within the existing project structure, so the Constitution gate is **PASSED** with no violations.

## Project Structure

### Documentation (this feature)

```text
specs/011-quickbooks-integration-expiry/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
```text
server/
├── index.ts
├── routes.ts
├── routes/
│   ├── index.ts
│   ├── shared.ts
│   └── schemas.ts
├── modules/
│   ├── quickbooks/
│   │   ├── routes.ts              # OAuth, status, connection endpoints
│   │   └── model.ts               # Re-exports QuickBooks tables/types from @shared/schema
│   ├── invoices/
│   │   └── routes.ts              # Uses QuickBooks sync service for invoice-related actions
│   └── ...                        # Other feature modules
├── services/
│   └── quickbooksSync.ts          # Token refresh, proactive refresh, sync helpers
├── storage.ts                     # Data access layer (getQuickBooksConnection, etc.)
└── __tests__/
    ├── api.quickbooks.test.ts     # API tests for QuickBooks endpoints and expiry behaviour (to add/extend)
    └── ...                        # Other backend tests

shared/
├── schema.ts
└── models/
    └── quickbooks.ts (if present) # QuickBooks-related tables, re-exported via schema.ts

client/
├── src/
│   ├── pages/
│   │   ├── integrations.tsx       # Integrations UI, QuickBooks connection status and logs
│   │   └── invoice-detail.tsx     # Invoice detail with QuickBooks sync button/state
│   ├── lib/
│   │   └── queryClient.ts         # apiRequest, TanStack Query setup
│   └── components/
│       └── ui/                    # Shared UI primitives
└── ...
```

**Structure Decision**: Use the existing monorepo structure with backend modules under `server/modules`, shared schema under `shared/`, and React SPA under `client/`. All QuickBooks expiry fixes will be implemented by updating `server/modules/quickbooks/routes.ts`, `server/services/quickbooksSync.ts`, `server/storage.ts` (if needed), and the relevant client pages (`integrations.tsx`, `invoice-detail.tsx`) without introducing new top-level projects or deviating from the module pattern.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
