# Implementation Plan: Integrations Center

**Branch**: `008-integrations-center` | **Date**: 2026-03-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-integrations-center/spec.md`

## Summary

Build an Integrations Center that allows third-party applications to connect to the backend via API tokens with configurable scopes. The system includes token lifecycle management (create, rotate, revoke), a Services section for outbound integrations, and comprehensive auto-generated API documentation with an interactive explorer interface.

Key technical approach:
- Use OpenAPI/Swagger for auto-generating API documentation from Express route definitions
- Implement middleware-based API token authentication alongside existing session auth
- Design scope-based permission system using middleware decorators on routes
- Create modular documentation skill that scans route files and generates OpenAPI spec

## Technical Context

**Language/Version**: TypeScript 5.x (aligned with project)
**Primary Dependencies**: 
- Express.js (existing)
- Drizzle ORM (existing)
- Swagger/OpenAPI for documentation auto-generation
- swagger-ui-express for interactive documentation interface
**Storage**: PostgreSQL via Drizzle (existing)
**Testing**: Vitest with dotenv (existing)
**Target Platform**: Web application (Node.js backend + React frontend)
**Project Type**: Full-stack web application
**Performance Goals**: Token validation < 10ms, Documentation page load < 2s
**Constraints**: API tokens must work alongside existing session-based auth
**Scale/Scope**: Unlimited integrations, no rate limiting

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Check | Status | Notes |
|-------|--------|-------|
| Backend module structure | PASS | Will create `server/modules/integrations/` with `routes.ts` and `model.ts` |
| New tables in shared/models | PASS | New domain `integrations.ts` for tables |
| Frontend page structure | PASS | New page `client/src/pages/integrations.tsx` |
| Tests required | PASS | `server/__tests__/api.integrations.test.ts` |
| API documentation | NEW | Auto-generated OpenAPI spec - aligns with FR-018/019/020 |

**Gate Result**: PASS - No constitution violations identified.

## Project Structure

### Documentation (this feature)

```text
specs/008-integrations-center/
├── plan.md              # This file
├── research.md          # Phase 0: Auto-doc generation approach
├── data-model.md        # Phase 1: Entity relationships
├── quickstart.md        # Phase 1: Developer setup guide
├── contracts/           # Phase 1: OpenAPI schemas
│   └── openapi.yaml
└── tasks.md             # Phase 2: Implementation tasks (created by /speckit.tasks)
```

### Source Code (repository root)

```text
server/
├── modules/
│   └── integrations/
│       ├── routes.ts         # Integration management routes
│       └── model.ts          # Re-exports from @shared/schema
├── middleware/
│   ├── apiAuth.ts            # API token authentication middleware
│   └── requireScope.ts       # Scope-based authorization middleware
├── routes/
│   └── index.ts              # Register integration routes
├── __tests__/
│   └── api.integrations.test.ts
└── docs/
    └── swagger.ts            # Auto-doc generation skill

shared/
└── models/
    └── integrations.ts       # Integration, Scope, Service tables

client/
└── src/
    ├── pages/
    │   └── integrations.tsx  # Integrations Center UI
    └── components/
        └── integrations/
            ├── IntegrationCard.tsx
            ├── TokenDisplay.tsx
            └── ScopeSelector.tsx
```

**Structure Decision**: Following the existing modular backend structure with new `integrations` module. Auto-documentation will be implemented as a skill in `server/docs/` that scans registered routes.

## Phase 0: Research & Unknowns

Key research areas identified:

1. **Auto-documentation approach**: How to automatically generate OpenAPI spec from Express routes
2. **Dual auth strategy**: How to support both session cookies and API tokens
3. **Scope middleware pattern**: Clean way to annotate routes with required scopes

## Phase 1: Design & Contracts

Planned outputs:
- `data-model.md`: Integration, Scope, Service, ApiDocumentation entities
- `contracts/openapi.yaml`: Auto-generated OpenAPI specification
- `quickstart.md`: Developer integration guide
- Agent context update with OpenAPI/swagger knowledge

## Complexity Tracking

> No violations identified that require justification.
