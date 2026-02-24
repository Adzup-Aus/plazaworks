# API Contract Changes: Remove Multi-Organization Support

**Feature**: Remove Multi-Organization Support  
**Date**: Tuesday, Feb 24, 2026

---

## Removed Endpoints

### Organization Management

| Method | Endpoint | Replacement |
|--------|----------|-------------|
| GET | `/api/organizations` | None - orgs removed |
| GET | `/api/organizations/:id` | None - orgs removed |
| POST | `/api/organizations` | None - orgs removed |
| PATCH | `/api/organizations/:id` | None - use `/api/settings` |

### Organization Members

| Method | Endpoint | Replacement |
|--------|----------|-------------|
| GET | `/api/organizations/:id/members` | `/api/users` (user management) |
| POST | `/api/organizations/:id/members` | `/api/users` (invite user) |
| PATCH | `/api/organizations/:orgId/members/:memberId` | `/api/users/:id` (update user) |
| DELETE | `/api/organizations/:orgId/members/:memberId` | `/api/users/:id` (deactivate user) |

### Organization Invites

| Method | Endpoint | Replacement |
|--------|----------|-------------|
| GET | `/api/organizations/:id/invites` | `/api/invites` (pending invites) |
| POST | `/api/organizations/:id/invites` | `/api/invites` (create invite) |
| POST | `/api/invites/:code/accept` | `/api/invites/:code/accept` (keep, simplify) |
| DELETE | `/api/organizations/:orgId/invites/:inviteId` | `/api/invites/:id` (cancel invite) |

### Organization Subscription

| Method | Endpoint | Replacement |
|--------|----------|-------------|
| GET | `/api/organizations/:id/subscription` | `/api/settings` (include limits) |
| PATCH | `/api/organizations/:id/subscription` | None - no self-service subscription |

### Organization Settings

| Method | Endpoint | Replacement |
|--------|----------|-------------|
| GET | `/api/organizations/:orgId/settings` | `/api/settings` |
| PATCH | `/api/organizations/:orgId/settings` | `/api/settings` |

---

## Modified Endpoints

### Request Context Changes

All endpoints that previously received `organizationId` via middleware will no longer have this context:

**Before**:
```typescript
req.organizationId = membership.organizationId;
req.organizationRole = membership.role;
req.subscription = subscription;
```

**After**:
```typescript
// Removed - no organization context
req.userId = authenticatedUserId;
req.userRole = userRole; // From user record or auth token
```

### Authentication Endpoints

**GET /api/auth/me**

**Before Response**:
```json
{
  "user": { "id": "...", "email": "..." },
  "memberships": [
    {
      "organizationId": "...",
      "role": "owner",
      "organization": { "name": "...", "slug": "..." }
    }
  ]
}
```

**After Response**:
```json
{
  "user": { "id": "...", "email": "..." },
  "role": "admin",
  "permissions": ["jobs:read", "jobs:write", "quotes:read", ...]
}
```

### Client Endpoints

**GET /api/clients**

**Before**: Filtered by `req.organizationId`

**After**: Returns all clients (no org filter)

```typescript
// Before
const clients = await storage.getClients(organizationId);

// After
const clients = await storage.getClients();
```

**POST /api/clients**

**Before Request**:
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "organizationId": "required" // From req.body or req.organizationId
}
```

**After Request**:
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com"
  // No organizationId
}
```

### Quote Endpoints

**GET /api/quotes**

**Before**: Could filter by organization

**After**: Returns all quotes, optionally filtered by query params

```typescript
// Query params (optional)
GET /api/quotes?status=draft&clientId=xxx
```

**POST /api/quotes**

**Before Request**:
```json
{
  "clientId": "...",
  "organizationId": "..." // Required or from context
}
```

**After Request**:
```json
{
  "clientId": "..."
  // No organizationId
}
```

### Invoice Endpoints

**GET /api/invoices**

**Before**: Filtered by organization

**After**: Returns all invoices

```typescript
// Query params (optional)
GET /api/invoices?status=paid&jobId=xxx
```

### Activity Endpoints

**GET /api/activities**

**Before**: Required `organizationId` parameter

```typescript
GET /api/activities?organizationId=xxx
```

**After**: No organization parameter

```typescript
GET /api/activities
```

---

## New Endpoints

### App Settings

**GET /api/settings**

Returns global application settings.

**Response**:
```json
{
  "companyName": "My Plumbing Business",
  "companyAddress": "123 Main St",
  "companyPhone": "555-1234",
  "companyEmail": "info@example.com",
  "timezone": "Australia/Brisbane",
  "defaultTaxRate": "10",
  "defaultPaymentTermsDays": 14,
  "quoteNumberPrefix": "Q-",
  "invoiceNumberPrefix": "INV-",
  "jobNumberPrefix": "J-",
  "defaultQuoteTerms": "...",
  "defaultInvoiceTerms": "...",
  "featuresEnabled": ["jobs", "schedule", "quotes", "invoices"],
  "maxUsers": null,
  "maxJobsPerMonth": null
}
```

**PATCH /api/settings**

Updates global application settings.

**Request Body**:
```json
{
  "companyName": "New Name",
  "defaultTaxRate": "12"
}
```

**Permissions**: Admin only

### User Management (Simplified)

**GET /api/users**

Returns all users in the system.

**Response**:
```json
{
  "users": [
    {
      "id": "...",
      "email": "...",
      "firstName": "...",
      "lastName": "...",
      "role": "admin",
      "isActive": true
    }
  ]
}
```

**POST /api/users**

Invites or creates a new user.

**Request Body**:
```json
{
  "email": "newuser@example.com",
  "firstName": "Jane",
  "lastName": "Doe",
  "role": "staff"
}
```

**Permissions**: Admin only

**PATCH /api/users/:id**

Updates user role or status.

**Request Body**:
```json
{
  "role": "manager",
  "isActive": false
}
```

**Permissions**: Admin only

---

## Middleware Changes

### Removed Middleware

| Middleware | Purpose | Replacement |
|------------|---------|-------------|
| `withOrganization` | Auto-creates org context | Removed - not needed |
| `requireFeature` | Checks subscription tier | Simplified to check `featuresEnabled` in settings, or removed |
| `checkUserLimit` | Enforces user count limit | Optional - check against `appSettings.maxUsers` |
| `checkJobLimit` | Enforces job count limit | Optional - check against `appSettings.maxJobsPerMonth` |

### Modified Middleware

| Middleware | Change |
|------------|--------|
| `isAuthenticated` | No change - still validates session |
| `requireSuperAdmin` | Check `req.userRole === 'owner'` or `req.userRole === 'admin'` |
| `ensureStaffProfile` | No change - still creates staff profile |

### Request Object Changes

**Before**:
```typescript
interface Request {
  userId: string;
  organizationId: string;
  organizationRole: string;
  subscription: OrganizationSubscription;
}
```

**After**:
```typescript
interface Request {
  userId: string;
  userRole: string; // 'owner' | 'admin' | 'manager' | 'staff' | 'contractor'
}
```

---

## Error Response Changes

### Removed Error Cases

| Error | HTTP Status | Reason |
|-------|-------------|--------|
| "Not a member of any organization" | 403 | No longer applicable |
| "No active subscription" | 403 | No longer applicable |
| "Subscription is not active" | 403 | No longer applicable |
| "This feature requires a higher subscription tier" | 403 | Replaced with feature flags |
| "User limit reached" | 403 | Optional, based on settings |
| "Monthly job limit reached" | 403 | Optional, based on settings |

### New/Modified Error Cases

| Error | HTTP Status | When |
|-------|-------------|------|
| "Admin access required" | 403 | Non-admin tries to modify settings |
| "Feature not enabled" | 403 | Feature not in `featuresEnabled` array |

---

## Authorization Matrix

### Role Permissions

| Action | Owner | Admin | Manager | Staff | Contractor |
|--------|-------|-------|---------|-------|------------|
| View jobs | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create jobs | ✓ | ✓ | ✓ | ✓ | ✗ |
| Edit all jobs | ✓ | ✓ | ✓ | ✗ | ✗ |
| View quotes | ✓ | ✓ | ✓ | ✓ | ✗ |
| Create quotes | ✓ | ✓ | ✓ | ✗ | ✗ |
| View invoices | ✓ | ✓ | ✓ | ✗ | ✗ |
| Manage users | ✓ | ✓ | ✗ | ✗ | ✗ |
| Edit settings | ✓ | ✓ | ✗ | ✗ | ✗ |
| View reports | ✓ | ✓ | ✓ | ✓ | ✗ |

**Note**: These are suggested permissions. Actual implementation may vary based on business requirements.

---

## Client-Side Changes

### API Client Updates

**Before**:
```typescript
// Organization context required
const clients = await api.get('/api/clients', {
  headers: { 'X-Organization-Id': orgId }
});
```

**After**:
```typescript
// No organization context
const clients = await api.get('/api/clients');
```

### TanStack Query Keys

**Before**:
```typescript
// Organization-scoped queries
useQuery({ queryKey: ['/api/organizations', orgId, 'members'] })
useQuery({ queryKey: ['/api/organizations', orgId, 'settings'] })
```

**After**:
```typescript
// Global queries
useQuery({ queryKey: ['/api/users'] })
useQuery({ queryKey: ['/api/settings'] })
```

---

## Backward Compatibility

### Breaking Changes

This is a **breaking change** with no backward compatibility:

1. All organization endpoints removed
2. Request context no longer includes organization
3. Response structures changed
4. Authentication flow simplified

### Migration Path

1. Update API clients to remove organization parameters
2. Update frontend components to remove org selection
3. Update tests to use new endpoints
4. Deploy database migration
5. Deploy backend changes
6. Deploy frontend changes

**Note**: All changes must be deployed together - partial deployment will break the application.
