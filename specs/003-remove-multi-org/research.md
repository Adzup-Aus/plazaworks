# Research Document: Remove Multi-Organization Support

**Feature**: Remove Multi-Organization Support  
**Date**: Tuesday, Feb 24, 2026

---

## 1. Database Dependency Analysis

### 1.1 Tables to be Removed (Organization-Specific)

| Table | Purpose | Records | Cascade Impact |
|-------|---------|---------|----------------|
| `organizations` | Core organization entity | Varies | All dependent tables cascade |
| `organizationSubscriptions` | Subscription/tier info | 1:1 with orgs | Removed with orgs |
| `organizationMembers` | User-org memberships | Many per org | User access changes |
| `organizationInvites` | Pending invitations | Varies | Invites invalidated |
| `organizationSettings` | Per-org configuration | 1:1 with orgs | Settings need migration |
| `organizationCounters` | Sequential numbering | Many per org | Counters need migration |

### 1.2 Tables with organizationId Foreign Keys

| Table | organizationId Nullable | Impact | Migration Action |
|-------|------------------------|--------|------------------|
| `clients` | No | High (core entity) | Remove FK, keep data |
| `quotes` | Yes | Medium | Remove FK column |
| `invoices` | Yes | Medium | Remove FK column |
| `vehicles` | Yes | Low | Remove FK column |
| `checklistTemplates` | Yes | Low | Remove FK column |
| `termsTemplates` | Yes | Low | Remove FK column |
| `activities` | No* | Medium | Remove from getActivities filter |

*Note: `activities` table appears to have organizationId but it's used as a filter parameter in `getActivities()` method, not necessarily a column.

### 1.3 Tables to Preserve (Auth-Related)

| Table | Reason | Notes |
|-------|--------|-------|
| `authIdentities` | User authentication | Not org-specific, keep as-is |
| `verificationCodes` | Auth verification | Not org-specific, keep as-is |

### 1.4 New Table Required

| Table | Purpose | Fields |
|-------|---------|--------|
| `appSettings` | Global application settings | id, companyName, defaultTaxRate, quotePrefix, invoicePrefix, jobPrefix, defaultTerms, createdAt, updatedAt |

---

## 2. Code Dependency Analysis

### 2.1 Backend Dependencies

#### Middleware (`server/middleware/index.ts`)

| Function | Lines | Org Dependency | Action |
|----------|-------|----------------|--------|
| `requireFeature` | 20-66 | Checks subscription tier | Simplify to feature flags or remove |
| `checkUserLimit` | 68-100 | Uses org subscription | Remove or make global |
| `checkJobLimit` | 102-140 | Uses org subscription | Remove or make global |
| `withOrganization` | 142-192 | Auto-creates org for user | Remove entirely |
| `requireSuperAdmin` | 194-223 | Checks org ownership | Simplify to check user role |

#### Storage Layer (`server/storage.ts`)

Organization-related methods to remove:
- `getOrganizations()`
- `getOrganization(id)`
- `getOrganizationBySlug(slug)`
- `createOrganization(data)`
- `updateOrganization(id, data)`
- `getOrganizationSubscription(orgId)`
- `createOrganizationSubscription(data)`
- `updateOrganizationSubscription(id, data)`
- `getOrganizationSettings(orgId)`
- `createOrganizationSettings(data)`
- `updateOrganizationSettings(orgId, data)`
- `getOrganizationMembers(orgId)`
- `getOrganizationMember(orgId, userId)`
- `createOrganizationMember(data)`
- `updateOrganizationMember(id, data)`
- `deleteOrganizationMember(id)`
- `getUserMemberships(userId)`
- `getOrganizationInvites(orgId)`
- `createOrganizationInvite(data)`
- `acceptInvite(inviteId, userId)`
- `deleteOrganizationInvite(id)`
- `getInviteByCode(code)`

Methods to update (remove org filtering):
- `getJobs()` - Currently returns all, but may filter by org in future
- `getClients()` - Likely filters by org
- `getQuotes()` - May filter by org
- `getInvoices()` - May filter by org
- `getActivities(organizationId)` - Remove orgId parameter

#### Organization Routes (`server/modules/organizations/routes.ts`)

**Entire file to be removed** (351 lines)

Endpoints being removed:
- `GET /api/organizations`
- `GET /api/organizations/:id`
- `POST /api/organizations`
- `PATCH /api/organizations/:id`
- `GET /api/organizations/:id/subscription`
- `PATCH /api/organizations/:id/subscription`
- `GET /api/organizations/:id/members`
- `POST /api/organizations/:id/members`
- `PATCH /api/organizations/:orgId/members/:memberId`
- `DELETE /api/organizations/:orgId/members/:memberId`
- `GET /api/organizations/:id/invites`
- `POST /api/organizations/:id/invites`
- `POST /api/invites/:code/accept`
- `DELETE /api/organizations/:orgId/invites/:inviteId`
- `GET /api/organizations/:orgId/settings`
- `PATCH /api/organizations/:orgId/settings`

#### Other Route Files

Files that import from organizations module or use org context:
- `server/modules/auth/routes.ts` - May use org context
- `server/modules/clients/routes.ts` - Likely filters by org
- `server/modules/activities/routes.ts` - Uses organizationId parameter
- `server/modules/clientPortal/routes.ts` - May use org context
- `server/routes/shared.ts` - Exports org-related helpers

### 2.2 Frontend Dependencies

#### Auth Hook (`client/src/hooks/use-auth.tsx`)

Expected changes:
- Remove `organization` from auth state
- Remove `organizationRole` from auth state
- Simplify `login()` to not handle org selection
- Simplify `logout()` to not clear org context

#### Admin Page (`client/src/pages/admin.tsx`)

Expected changes:
- Remove organization management tab/section
- Convert organization settings to global settings
- Remove member management (or simplify to user management)
- Remove subscription management (or handle globally)

#### App Component (`client/src/App.tsx`)

Expected changes:
- Remove organization provider/context
- Simplify routing logic

---

## 3. Migration Strategy

### 3.1 Database Migration Approach

**Type**: Destructive migration with data preservation

**Steps**:
1. Create new `appSettings` table
2. Migrate settings from primary/default organization (first org or `isOwner=true`)
3. Remove `organizationId` columns from dependent tables
4. Drop organization-related indexes
5. Drop organization tables (with CASCADE)

**Data Migration Rules**:
- If multiple organizations exist, use the `isOwner=true` org as primary
- If no owner org, use the first created organization
- Merge counters by keeping the highest values
- Settings: Migrate all fields from primary org

### 3.2 Code Migration Approach

**Phase 1: Database** (Safe, reversible)
- Create migration script
- Run in development
- Verify data integrity

**Phase 2: Backend** (Requires db migration)
- Remove organization module
- Update middleware
- Update storage layer
- Update remaining routes

**Phase 3: Frontend** (Requires backend changes)
- Update auth hooks
- Update admin page
- Update app component

**Phase 4: Tests** (Final verification)
- Update test fixtures
- Update test cases
- Run full suite

### 3.3 Rollback Strategy

If issues occur:
1. Restore database from pre-migration backup
2. Revert code changes via git
3. Redeploy previous version

---

## 4. Decisions

### Decision 1: Subscription Tier Handling

**Question**: What happens to subscription tiers when organizations are removed?

**Options**:
- A: Remove subscription checks entirely (open all features)
- B: Convert to global subscription for the single business
- C: Remove tier restrictions, keep feature flags

**Decision**: Option A - Remove subscription checks
**Rationale**: Since this is becoming a single-tenant app for one business, tier restrictions don't make sense. All features should be available.

### Decision 2: User Roles

**Question**: How do user roles work without organizations?

**Options**:
- A: Keep org member roles as global roles (owner, admin, manager, staff)
- B: Simplify to basic roles (admin, user)
- C: Remove roles entirely (all authenticated users are equal)

**Decision**: Option A - Keep roles as global system roles
**Rationale**: Role-based access control is still valuable for permission management within the business.

### Decision 3: Multiple Existing Organizations

**Question**: What if multiple organizations exist with data?

**Options**:
- A: Merge all data into unified view
- B: Keep only primary (owner) org data, archive others
- C: Fail migration, require manual consolidation

**Decision**: Option A - Merge all data
**Rationale**: The specification states "data from multiple organizations can be unified". All data becomes accessible.

### Decision 4: Pending Invites

**Question**: What happens to pending organization invites?

**Options**:
- A: Auto-accept all pending invites
- B: Invalidate/delete all pending invites
- C: Convert to system-level user invites

**Decision**: Option B - Invalidate/delete all pending invites
**Rationale**: Organization invites become meaningless without organizations. Users can be re-invited through a simplified system if needed.

---

## 5. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Data loss during migration | Low | High | Full backup before migration |
| Broken authentication | Medium | High | Thorough testing of auth flow |
| Missing org-scoped data | Low | High | Verify all tables in migration |
| Frontend crashes | Medium | Medium | Gradual rollout, error monitoring |
| Test regressions | High | Medium | Dedicated test update phase |

---

## 6. Open Questions

1. **Data Volume**: How many organizations currently exist in production?
2. **Active Users**: How many users are members of multiple organizations?
3. **Subscription Status**: Are there active paid subscriptions that need handling?
4. **Custom Settings**: Have organizations customized settings that shouldn't be merged?

These questions should be answered before proceeding with implementation.

