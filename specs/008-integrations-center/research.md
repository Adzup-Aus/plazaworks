# Research: Integrations Center Implementation

**Date**: 2026-03-09
**Feature**: Integrations Center with Auto-Generated API Documentation

## Research Areas

### 1. Auto-Documentation Approach

**Decision**: Use `swagger-jsdoc` + `swagger-ui-express` with JSDoc annotations in route handlers

**Rationale**:
- Keeps documentation co-located with code (single source of truth)
- Industry standard for Express.js APIs
- Generates OpenAPI 3.0 spec that can be consumed by other tools
- Allows interactive testing via Swagger UI
- Supports scope annotations via custom JSDoc tags

**Implementation Pattern**:
```typescript
/**
 * @openapi
 * /api/integrations:
 *   get:
 *     summary: List all integrations
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of integrations
 *       401:
 *         description: Unauthorized
 */
```

**Alternatives Considered**:
| Approach | Pros | Cons | Rejected Because |
|----------|------|------|------------------|
| Manual OpenAPI YAML | Full control | Gets out of sync | Maintenance burden |
| Runtime route introspection | Zero annotations | Limited metadata | Can't capture descriptions/scopes |
| tRPC | Type-safe | Requires major refactor | Not aligned with existing Express stack |

### 2. Dual Authentication Strategy

**Decision**: Implement parallel authentication middleware that checks for API token in Authorization header OR session cookie

**Rationale**:
- Third-party apps use `Authorization: Bearer <token>` header
- Web UI continues using existing session cookie auth
- Same middleware can handle both, setting `req.user` appropriately

**Implementation**:
```typescript
// middleware/apiAuth.ts
export const apiAuth = async (req, res, next) => {
  // Check for Bearer token first
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const integration = await validateApiToken(token);
    if (integration) {
      req.user = { type: 'integration', ...integration };
      return next();
    }
  }
  // Fall through to session auth
  return isAuthenticated(req, res, next);
};
```

### 3. Scope-Based Authorization

**Decision**: Use middleware factory pattern with JSDoc annotations

**Rationale**:
- Clean separation of concerns
- Scopes visible in OpenAPI spec via extensions
- Can be composed with other middleware

**Implementation**:
```typescript
// middleware/requireScope.ts
export const requireScope = (...scopes: string[]) => {
  return (req, res, next) => {
    if (req.user?.type === 'integration') {
      const hasScope = scopes.every(s => req.user.scopes.includes(s));
      if (!hasScope) return res.status(403).json({ error: 'Insufficient scope' });
    }
    next();
  };
};
```

**JSDoc Integration**:
```typescript
/**
 * @openapi
 * /api/jobs:
 *   post:
 *     x-scopes: [jobs:write]
 */
app.post('/api/jobs', apiAuth, requireScope('jobs:write'), createJob);
```

### 4. Token Format & Storage

**Decision**: UUID v4 (36 chars) stored as plain text in database with bcrypt hash for validation

**Rationale**:
- Per spec requirement (UUID v4)
- Store only hash (like passwords) for security
- Display full token only once at creation/rotation

**Implementation**:
```typescript
// On creation: generate UUID, show to user, store hash
const apiToken = crypto.randomUUID(); // Show this once
const tokenHash = await bcrypt.hash(apiToken, 10); // Store this
```

### 5. Documentation Auto-Update Mechanism

**Decision**: Build-time generation via script + runtime regeneration endpoint

**Rationale**:
- Build-time: Ensures docs are current on deploy
- Runtime: Allows refresh without restart during development
- Triggers on file change in `server/modules/**/routes.ts`

**Skill Implementation**:
```typescript
// server/docs/swagger.ts
export class DocumentationSkill {
  async generateSpec() {
    const options = {
      definition: {
        openapi: '3.0.0',
        info: { title: 'API', version: '1.0.0' },
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'UUID'
            }
          }
        }
      },
      apis: ['./server/modules/**/routes.ts']
    };
    return swaggerJsdoc(options);
  }
  
  watchForChanges() {
    // Watch routes files and regenerate on change
  }
}
```

## Dependencies to Add

```json
{
  "swagger-jsdoc": "^6.2.8",
  "swagger-ui-express": "^5.0.0",
  "@types/swagger-jsdoc": "^6.0.4",
  "@types/swagger-ui-express": "^4.1.6"
}
```

## Open Questions Resolved

1. **How to mark routes with scopes?** → JSDoc `@openapi` comments with custom `x-scopes` extension
2. **How to handle auth for both web and API?** → Parallel middleware checking Bearer token then session
3. **When does documentation update?** → Build-time + runtime endpoint, triggered by file changes
4. **Token storage secure?** → Store bcrypt hash, display plaintext only once

## Research Complete

All Phase 0 unknowns resolved. Proceeding to Phase 1 design.
