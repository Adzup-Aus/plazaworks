# Data Model: Integrations Center

**Feature**: Integrations Center  
**Date**: 2026-03-09

## Entity Relationship Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Integration   │────<│  Scope (enum)   │     │     Service     │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id (PK)         │     │ id (PK)         │     │ id (PK)         │
│ name            │     │ name            │     │ name            │
│ description     │     │ description     │     │ type            │
│ apiTokenHash    │     │ resource        │     │ description     │
│ tokenExpiryDate │     │ actions[]       │     │ configFields[]  │
│ scopes[]        │     └─────────────────┘     │ createdAt       │
│ status          │                             │ updatedAt       │
│ createdBy (FK)  │                             └─────────────────┘
│ createdAt       │                                       │
│ rotatedAt       │                             ┌─────────▼─────────┐
│ revokedAt       │                             │ ConfigurationField│
└─────────────────┘                             ├─────────────────┤
         │                                      │ name            │
         │                                      │ type            │
         ▼                                      │ label           │
┌─────────────────┐                             │ required        │
│ IntegrationAudit│                             │ defaultValue    │
├─────────────────┤                             └─────────────────┘
│ id (PK)         │
│ integrationId   │
│ action          │
│ performedBy     │
│ performedAt     │
│ details (JSON)  │
└─────────────────┘
```

## Entities

### Integration

Represents a third-party application connection to the API.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PK, auto-gen | Unique identifier |
| name | varchar(255) | NOT NULL, unique | Human-readable name |
| description | text | nullable | Optional description |
| apiTokenHash | varchar(255) | NOT NULL | bcrypt hash of the API token |
| tokenExpiryDate | timestamp | nullable | When token expires (null = never) |
| scopes | text[] | NOT NULL, min 1 | Array of scope identifiers |
| status | enum | NOT NULL | active, revoked |
| createdBy | uuid | FK → users.id | Admin who created it |
| createdAt | timestamp | NOT NULL, default now() | Creation timestamp |
| rotatedAt | timestamp | nullable | Last rotation timestamp |
| revokedAt | timestamp | nullable | When revoked |
| revokedBy | uuid | FK → users.id, nullable | Admin who revoked |

**State Transitions**:
```
created → active → revoked
   ↑         ↓
   └──── rotated (new token, same integration)
```

**Indexes**:
- `idx_integration_status` on status (for filtering active)
- `idx_integration_createdBy` on createdBy (for user's integrations)

---

### Scope

Predefined permission scopes available in the system.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PK, auto-gen | Unique identifier |
| name | varchar(100) | NOT NULL, unique | Scope identifier (e.g., "jobs:read") |
| description | text | NOT NULL | Human-readable description |
| resource | varchar(100) | NOT NULL | Resource domain (e.g., "jobs", "clients") |
| actions | text[] | NOT NULL | Allowed actions: read, write, delete |

**Static Data**: Scopes are seeded at deployment, not user-created.

**Example Scopes**:
| name | resource | actions | description |
|------|----------|---------|-------------|
| jobs:read | jobs | [read] | View jobs and job details |
| jobs:write | jobs | [read, write] | Create and update jobs |
| clients:read | clients | [read] | View client information |
| clients:write | clients | [read, write] | Manage clients |
| quotes:read | quotes | [read] | View quotes |
| quotes:write | quotes | [read, write] | Create and manage quotes |
| invoices:read | invoices | [read] | View invoices |
| invoices:write | invoices | [read, write] | Create and manage invoices |
| schedule:read | schedule | [read] | View schedule |
| schedule:write | schedule | [read, write] | Modify schedule |

---

### Service

Configuration for outbound integrations (external services).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PK, auto-gen | Unique identifier |
| name | varchar(255) | NOT NULL, unique | Service name |
| type | varchar(100) | NOT NULL | Service type category |
| description | text | nullable | Optional description |
| configurationFields | jsonb | NOT NULL | Array of field definitions |
| isActive | boolean | NOT NULL, default true | Whether service is enabled |
| createdAt | timestamp | NOT NULL, default now() | Creation timestamp |
| updatedAt | timestamp | NOT NULL, default now() | Last update timestamp |

**configurationFields JSON Schema**:
```typescript
{
  name: string;           // Field identifier
  type: 'text' | 'password' | 'url' | 'number' | 'email' | 'textarea';
  label: string;          // Display label
  required: boolean;      // Whether field is required
  placeholder?: string;   // Input placeholder
  defaultValue?: string;  // Default value if any
  helpText?: string;      // Helpful description
}
```

---

### IntegrationAuditLog

Audit trail for all integration lifecycle events.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PK, auto-gen | Unique identifier |
| integrationId | uuid | FK → integration.id, NOT NULL | Related integration |
| action | enum | NOT NULL | created, rotated, revoked |
| performedBy | uuid | FK → users.id | Admin who performed action |
| performedAt | timestamp | NOT NULL, default now() | When action occurred |
| details | jsonb | nullable | Additional context (IP, user agent, etc.) |

**Indexes**:
- `idx_audit_integrationId` on integrationId (for integration history)
- `idx_audit_performedAt` on performedAt (for time-based queries)

---

## Relationships

| From | To | Type | Description |
|------|-----|------|-------------|
| Integration | User (createdBy) | Many-to-One | Who created the integration |
| Integration | User (revokedBy) | Many-to-One | Who revoked the integration |
| Integration | Scope | Many-to-Many | Scopes granted to integration |
| IntegrationAuditLog | Integration | Many-to-One | Audit entries for an integration |
| IntegrationAuditLog | User | Many-to-One | Who performed the action |

## Validation Rules

1. **Integration**
   - Name must be unique per organization
   - At least one scope must be selected
   - Cannot un-revoke (create new instead)
   - Token expiry must be in the future if set

2. **Service**
   - Configuration field names must be unique within service
   - Type must be one of allowed values

3. **Audit Log**
   - Immutable - no updates allowed
   - Required for all lifecycle events

## Drizzle Schema (TypeScript)

```typescript
// shared/models/integrations.ts

export const integrationStatusEnum = pgEnum('integration_status', [
  'active',
  'revoked'
]);

export const integrationActionEnum = pgEnum('integration_action', [
  'created',
  'rotated',
  'revoked'
]);

export const integrations = pgTable('integrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  apiTokenHash: varchar('api_token_hash', { length: 255 }).notNull(),
  tokenExpiryDate: timestamp('token_expiry_date'),
  scopes: text('scopes').array().notNull(),
  status: integrationStatusEnum('status').notNull().default('active'),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  rotatedAt: timestamp('rotated_at'),
  revokedAt: timestamp('revoked_at'),
  revokedBy: uuid('revoked_by').references(() => users.id),
});

export const scopes = pgTable('scopes', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: text('description').notNull(),
  resource: varchar('resource', { length: 100 }).notNull(),
  actions: text('actions').array().notNull(),
});

export const services = pgTable('services', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  type: varchar('type', { length: 100 }).notNull(),
  description: text('description'),
  configurationFields: jsonb('configuration_fields').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const integrationAuditLogs = pgTable('integration_audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationId: uuid('integration_id')
    .references(() => integrations.id)
    .notNull(),
  action: integrationActionEnum('action').notNull(),
  performedBy: uuid('performed_by').references(() => users.id).notNull(),
  performedAt: timestamp('performed_at').defaultNow().notNull(),
  details: jsonb('details'),
});
```
