# Tasks: Integrations Center

**Feature**: Integrations Center  
**Branch**: `008-integrations-center`  
**Generated**: 2026-03-09  
**Template Version**: 1.0

## Overview

This task list implements the Integrations Center allowing third-party applications to connect via API tokens with configurable scopes. The implementation follows the modular backend structure per the Speckit Constitution.

**Source Documents**:
- [spec.md](./spec.md) - Feature specification with user stories
- [plan.md](./plan.md) - Implementation plan and technical context
- [data-model.md](./data-model.md) - Entity relationships and Drizzle schema
- [contracts/openapi.yaml](./contracts/openapi.yaml) - API contract specification

---

## Phase 1: Setup & Dependencies

**Goal**: Install dependencies and set up project structure per Speckit Constitution

### Dependencies

- [x] T001 Install swagger-jsdoc and swagger-ui-express packages
  - `npm install swagger-jsdoc swagger-ui-express`
  - `npm install -D @types/swagger-jsdoc @types/swagger-ui-express`

### Project Structure

- [x] T002 [P] Create backend module directory structure
  - `server/modules/integrations/` - Integration module
  - `server/middleware/apiAuth.ts` - API token auth middleware
  - `server/middleware/requireScope.ts` - Scope authorization middleware
  - `server/docs/swagger.ts` - Auto-doc generation skill

- [x] T003 [P] Create shared model file
  - `shared/models/integrations.ts` - Drizzle table definitions

- [x] T004 [P] Create frontend component directories
  - `client/src/components/integrations/` - Integration UI components

---

## Phase 2: Foundational - Database & Core Middleware

**Goal**: Database schema and core authentication infrastructure (blocking for all user stories)

### Database Schema

- [x] T005 Define Integration table in `shared/models/integrations.ts`
  - Create `integrationStatusEnum` (active, revoked)
  - Create `integrationActionEnum` (created, rotated, revoked)
  - Define `integrations` table with all fields per data-model.md
  - Export insert schema and types

- [x] T006 [P] Define Scope table in `shared/models/integrations.ts`
  - Define `scopes` table with name, description, resource, actions
  - Export insert schema and types

- [x] T007 [P] Define Service table in `shared/models/integrations.ts`
  - Define `services` table with configuration fields as jsonb
  - Export insert schema and types

- [x] T008 Define IntegrationAuditLog table in `shared/models/integrations.ts`
  - Define `integrationAuditLogs` table
  - Export insert schema and types

- [x] T009 Export all integration models from `shared/schema.ts`
  - Re-export from `shared/models/integrations.ts`

- [x] T010 [P] Create database migration
  - Generate migration with `npm run db:generate`
  - Apply migration with `npm run db:migrate`

### Core Middleware

- [x] T011 Implement API token authentication middleware in `server/middleware/apiAuth.ts`
  - Check Authorization header for Bearer token
  - Validate token against database
  - Set `req.user` with integration context
  - Fall through to session auth if no token

- [x] T012 Implement scope authorization middleware in `server/middleware/requireScope.ts`
  - Factory function accepting scope names
  - Check if integration has required scopes
  - Return 403 if insufficient scope

- [x] T013 Create integration module model file `server/modules/integrations/model.ts`
  - Re-export from `@shared/schema` for integration tables

---

## Phase 3: User Story 1 - Create API Integration (P1)

**Story Goal**: Admins can create integrations with scopes and generate API tokens

**Independent Test**: Admin creates integration, selects scopes, generates token, views token with copy functionality

### Backend

- [x] T014 Implement list scopes endpoint in `server/modules/integrations/routes.ts`
  - `GET /api/scopes` - Returns all available scopes
  - JSDoc @openapi annotations for auto-doc

- [x] T015 Implement create integration endpoint in `server/modules/integrations/routes.ts`
  - `POST /api/integrations` - Creates new integration
  - Generate UUID token, hash with bcrypt
  - Return full token only once
  - JSDoc @openapi annotations

- [x] T016 Implement list integrations endpoint in `server/modules/integrations/routes.ts`
  - `GET /api/integrations` - Returns all integrations
  - Admin only (session auth)
  - Exclude apiTokenHash from response

- [x] T017 [P] Implement audit logging for integration creation
  - Log to `integrationAuditLogs` table
  - Include createdBy, timestamp, details

- [x] T018 Register integration routes in `server/routes/index.ts`
  - Import `registerIntegrationsRoutes`
  - Call in `registerRoutes()` function

### Frontend

- [x] T019 Create Integrations page component `client/src/pages/integrations.tsx`
  - Main Integrations Center UI
  - Admin-only access check

- [x] T020 [P] Create IntegrationCard component `client/src/components/integrations/IntegrationCard.tsx`
  - Display integration details
  - Show status, scopes, created date

- [x] T021 Create TokenDisplay component `client/src/components/integrations/TokenDisplay.tsx`
  - Display token with eye icon toggle
  - Copy to clipboard button
  - Show only when token available

- [x] T022 Create ScopeSelector component `client/src/components/integrations/ScopeSelector.tsx`
  - Multi-select for scopes
  - Fetch available scopes from API

- [x] T023 [P] Create CreateIntegrationDialog component
  - Form for name, description, scopes
  - Token expiry date picker
  - Display generated token after creation

- [x] T024 Add Integrations route in `client/src/App.tsx`
  - Add to AuthenticatedRouter
  - Path: `/integrations`

---

## Phase 4: User Story 4 - API Documentation (P1)

**Story Goal**: Developers can access auto-generated interactive API documentation

**Independent Test**: Developer accesses `/api/docs`, browses endpoints, sees scopes, can test with token

### Backend

- [x] T025 Create documentation skill `server/docs/swagger.ts`
  - Configure swagger-jsdoc with JSDoc annotations
  - Set up Bearer auth security scheme
  - Watch for route file changes

- [x] T026 Implement OpenAPI spec endpoint in `server/modules/integrations/routes.ts`
  - `GET /api/docs/openapi.json` - Returns generated spec
  - Trigger regeneration on request

- [x] T027 Serve Swagger UI in `server/modules/integrations/routes.ts`
  - `GET /api/docs` - Serves Swagger UI
  - Use swagger-ui-express middleware

- [ ] T028 Add JSDoc annotations to existing API routes
  - Document authentication endpoints
  - Add @openapi comments with x-scopes

### Frontend

- [x] T029 [P] Create link to API docs in Integrations Center
  - Add "View API Documentation" button/link
  - Opens in new tab to `/api/docs`

---

## Phase 5: User Story 2 - Rotate API Token (P2)

**Story Goal**: Admins can rotate tokens for security

**Independent Test**: Admin rotates token, old token rejected, new token works

### Backend

- [x] T030 Implement rotate token endpoint in `server/modules/integrations/routes.ts`
  - `POST /api/integrations/:id/rotate` - Rotates token
  - Generate new UUID, hash and store
  - Invalidate old token
  - Return new token once

- [x] T031 [P] Add audit logging for rotation
  - Log rotation event
  - Include performedBy, timestamp

### Frontend

- [x] T032 Add rotate token button to IntegrationCard
  - Confirmation dialog
  - Display new token after rotation
  - Show warning that old token stops working

---

## Phase 6: User Story 5 - Revoke Integration (P2)

**Story Goal**: Admins can revoke integrations immediately

**Independent Test**: Admin revokes integration, token immediately rejected

### Backend

- [x] T033 Implement revoke integration endpoint in `server/modules/integrations/routes.ts`
  - `DELETE /api/integrations/:id` - Revokes integration
  - Set status to revoked
  - Set revokedAt and revokedBy

- [x] T034 [P] Add audit logging for revocation
  - Log revoke event
  - Include performedBy, timestamp

### Frontend

- [x] T035 Add revoke button to IntegrationCard
  - Confirmation dialog with warning
  - Show revoked status after revocation
  - Disable actions on revoked integrations

---

## Phase 7: User Story 3 - Service Configurations (P3)

**Story Goal**: Admins can configure outbound service integrations

**Independent Test**: Admin creates service with custom fields, saves and views configuration

### Backend

- [x] T036 Implement list services endpoint in `server/modules/integrations/routes.ts`
  - `GET /api/services` - Returns all services

- [x] T037 [P] Implement create service endpoint
  - `POST /api/services` - Creates new service
  - Validate configuration fields schema

- [x] T038 [P] Implement update service endpoint
  - `PATCH /api/services/:id` - Updates service

- [x] T039 [P] Implement delete service endpoint
  - `DELETE /api/services/:id` - Removes service

### Frontend

- [ ] T040 Create Services section in Integrations Center
  - Tab or section for Services
  - List configured services

- [ ] T041 [P] Create ServiceCard component
  - Display service details
  - Show configuration fields

- [ ] T042 [P] Create ServiceForm component
  - Dynamic form based on field types
  - Add/edit configuration fields

---

## Phase 8: Polish & Testing

**Goal**: Cross-cutting concerns and quality assurance

### Testing

- [x] T043 Create API tests in `server/__tests__/api.integrations.test.ts`
  - Test all integration endpoints
  - Test token authentication
  - Test scope authorization
  - Run with `npm run test:env`

### Documentation

- [ ] T044 [P] Update API documentation with all endpoints
  - Ensure all routes have JSDoc @openapi annotations
  - Verify scopes are documented per endpoint

### Edge Cases

- [ ] T045 Handle expired token edge case
  - Return 401 with clear error message
  - Suggest rotation to admin

- [ ] T046 [P] Handle copy failure gracefully
  - Show error if clipboard permission denied
  - Allow manual selection

- [ ] T047 [P] Add search/filter to documentation UI
  - Enable finding endpoints quickly

---

## Dependency Graph

```
Phase 1 (Setup)
    │
    ▼
Phase 2 (Foundational) ────────┐
    │                           │
    ├──► Phase 3 (US1)          │
    │       │                   │
    │       └──► Phase 4 (US4)  │
    │               │           │
    │               ├──► Phase 5 (US2)
    │               │
    │               └──► Phase 6 (US5)
    │
    └──► Phase 7 (US3)
```

**Story Dependencies**:
- US1 → US4 (documentation needs integrations to exist)
- US1 → US2 (rotation needs integration to exist)
- US1 → US5 (revocation needs integration to exist)
- US4 is independent after foundational phase
- US3 (Services) is fully independent

---

## Parallel Execution Opportunities

### Within Phase 2 (Foundational)
- T006, T007, T008, T010 can run in parallel
- T011, T012 can run in parallel with schema tasks

### Within Phase 3 (US1)
- T014 (scopes endpoint) can be done in parallel with frontend components
- T019-T024 (frontend) can be worked on in parallel

### Across User Stories
- US3 (Services) can be implemented in parallel with US1-US2-US5
- US4 (Documentation) can be worked on in parallel with backend endpoints

---

## Implementation Strategy

### MVP (Minimum Viable Product)
**Scope**: Phase 1 + Phase 2 + Phase 3 (US1 only)

The MVP delivers core value: admins can create integrations, generate tokens, and third-party apps can authenticate. This enables immediate API usage.

### Incremental Delivery
1. **Sprint 1**: Phase 1 + Phase 2 + Phase 3 (US1) - Core functionality
2. **Sprint 2**: Phase 4 (US4) + Phase 5 (US2) - Documentation + rotation
3. **Sprint 3**: Phase 6 (US5) + Phase 7 (US3) - Revocation + services
4. **Sprint 4**: Phase 8 - Testing and polish

---

## Task Summary

| Phase | Tasks | Story |
|-------|-------|-------|
| Phase 1 | 4 | Setup |
| Phase 2 | 9 | Foundational |
| Phase 3 | 11 | US1 - Create Integration |
| Phase 4 | 5 | US4 - Documentation |
| Phase 5 | 3 | US2 - Rotate Token |
| Phase 6 | 3 | US5 - Revoke Integration |
| Phase 7 | 7 | US3 - Services |
| Phase 8 | 5 | Polish |
| **Total** | **47** | |

---

## Success Criteria Verification

| Criteria | Verification Method |
|----------|---------------------|
| SC-001 | Manual test: time integration creation flow |
| SC-002 | Manual test: time token rotation |
| SC-003 | Test: API tests verify 401 for expired/revoked tokens |
| SC-004 | Manual test: verify copy button works |
| SC-005 | Test: verify audit log entries exist |
| SC-006 | Test: verify 403 for non-admin access |
| SC-007 | Verify: at least 10 scopes seeded in database |
| SC-008 | Verify: documentation updates automatically |
| SC-009 | Verify: all endpoints have OpenAPI annotations |
| SC-010 | Manual test: time finding endpoint in docs |
