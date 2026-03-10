# Feature Specification: QuickBooks Integration

**Feature Branch**: `009-quickbooks-integration`  
**Created**: 2025-03-09  
**Status**: Draft  
**Input**: User description: "Implement a QuickBooks integration feature. Integration Location: Add QuickBooks in Integrations page, Services tab. Configuration: Client ID and Client Secret saved securely. Scope: Invoices only; sync Platform → QuickBooks; one account → one QuickBooks company; no historical invoices. Invoice and payment changes reflected in QuickBooks. Customer must exist in QuickBooks before invoice; create customer if missing."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure QuickBooks and connect account (Priority: P1)

An administrator goes to the Integrations page, opens the Services tab, and selects QuickBooks. A configuration form appears where they enter Client ID and Client Secret. After saving, the credentials are stored securely and the platform account is linked to a single QuickBooks company. Only new invoices created after this point are synced to QuickBooks.

**Why this priority**: Without configuration and connection, no sync can occur.

**Independent Test**: Can be fully tested by opening Integrations → Services, selecting QuickBooks, entering credentials, saving, and verifying the integration is connected and credentials are persisted (e.g., integration shows as configured).

**Acceptance Scenarios**:

1. **Given** the user is on the Integrations page, **When** they open the Services tab, **Then** QuickBooks appears as an available integration.
2. **Given** the user selects QuickBooks, **When** the configuration form is shown, **Then** the form includes fields for Client ID and Client Secret.
3. **Given** the user enters valid Client ID and Client Secret and saves, **When** the form is submitted, **Then** the credentials are stored securely and the integration is marked as connected for that account.
4. **Given** one platform account, **When** QuickBooks is configured, **Then** that account is linked to exactly one QuickBooks company.

---

### User Story 2 - Sync new invoices and ensure customers exist in QuickBooks (Priority: P2)

When an invoice is created, updated, or its status changes in the platform, the system ensures the related client (customer) exists in QuickBooks. If the customer does not exist, the system creates them in QuickBooks first, then creates or updates the invoice in QuickBooks so it matches the platform.

**Why this priority**: Core value of the integration is invoice and customer sync.

**Independent Test**: Can be tested by creating a new invoice in the platform (after integration is enabled) and verifying a corresponding invoice exists in QuickBooks and the customer exists there if they were missing.

**Acceptance Scenarios**:

1. **Given** QuickBooks is connected and an invoice is created in the platform, **When** the invoice is saved, **Then** the system checks if the invoice’s client exists in QuickBooks; if not, the customer is created in QuickBooks, then the invoice is created in QuickBooks.
2. **Given** the client already exists in QuickBooks, **When** a new invoice is created in the platform for that client, **Then** the system uses the existing QuickBooks customer and creates only the invoice in QuickBooks.
3. **Given** an existing platform invoice is updated or its status changes, **When** the change is saved, **Then** the corresponding invoice in QuickBooks is updated to reflect the change.
4. **Given** a payment is recorded on an invoice in the platform, **When** the payment is saved, **Then** the invoice or payment status in QuickBooks is updated accordingly.

---

### User Story 3 - No historical or reverse sync (Priority: P3)

Only invoices created after the QuickBooks integration is enabled are synced. Existing (historical) invoices are not synced. Changes made in QuickBooks do not sync back to the platform; the platform is the source of truth.

**Why this priority**: Defines scope boundaries and avoids unintended data overwrite.

**Independent Test**: Can be tested by enabling the integration, confirming pre-existing invoices do not appear in QuickBooks, and confirming that edits in QuickBooks do not update the platform.

**Acceptance Scenarios**:

1. **Given** the integration is enabled, **When** there are invoices that existed before the integration was enabled, **Then** those invoices are not synced to QuickBooks.
2. **Given** an invoice has been synced to QuickBooks, **When** someone edits that invoice or payment in QuickBooks, **Then** those changes are not synced back to the platform.
3. **Given** a new invoice is created after the integration is enabled, **When** it is saved, **Then** it is synced to QuickBooks according to the rules in User Story 2.

---

### Edge Cases

- What happens when QuickBooks credentials are invalid or expired? The system should detect authentication/authorization failures and surface a clear message to the admin (e.g., integration needs re-authorization or credential update) without silently failing.
- What happens when the external QuickBooks API is temporarily unavailable? The system should handle failures gracefully (e.g., retry or queue) and inform the user or log so that sync can be retried or investigated.
- What happens when a client has insufficient or invalid data to create a QuickBooks customer? The system should validate required customer data before attempting sync and either block invoice sync with a clear reason or prompt for missing data, depending on business rules.
- What happens when an invoice is deleted in the platform? **Decided**: When an invoice is deleted in the platform, the system MUST void the corresponding invoice in QuickBooks (if it was previously synced). Use QuickBooks “void” semantics (invoice remains in QB but is marked void); do not delete the QB invoice record.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST expose QuickBooks as a new integration in the Integrations page under the Services tab.
- **FR-002**: The system MUST provide a QuickBooks configuration form (within the Integrations page, Services tab) where an admin can enter Client ID and Client Secret.
- **FR-003**: The system MUST store QuickBooks Client ID and Client Secret securely (e.g., encrypted at rest and not exposed in UI or logs after save).
- **FR-004**: The system MUST support only one QuickBooks company per platform account (one-to-one mapping).
- **FR-005**: The system MUST sync only invoices to QuickBooks; no other entity types are in scope for this feature.
- **FR-006**: The system MUST sync only from the platform to QuickBooks; the platform is the source of truth. Changes in QuickBooks MUST NOT sync back to the platform.
- **FR-007**: The system MUST NOT sync historical invoices; only invoices created after the QuickBooks integration is enabled for the account MUST be synced.
- **FR-008**: The system MUST sync to QuickBooks when an invoice is created, updated, or its status changes in the platform.
- **FR-009**: The system MUST update QuickBooks when a payment is recorded on an invoice in the platform (invoice/payment status in QuickBooks reflects the payment).
- **FR-010**: Before creating or updating an invoice in QuickBooks, the system MUST ensure the related client (customer) exists in QuickBooks: if the customer exists, use the existing QuickBooks customer identifier; if not, create the customer in QuickBooks first, then create or update the invoice linked to that customer.
- **FR-011**: The system MUST ensure every new invoice created in the platform (after integration is enabled) has a corresponding invoice in QuickBooks, with customers created in QuickBooks as needed.
- **FR-012**: When an invoice is deleted in the platform, the system MUST void the corresponding invoice in QuickBooks (if a mapping exists). QuickBooks invoice is voided, not deleted.

### Key Entities

- **Integration (QuickBooks)**: Represents the connection of a platform account to a single QuickBooks company; holds configuration (e.g., secure storage of Client ID and Client Secret) and link to the external company.
- **Invoice**: Platform entity that is synced one-way to QuickBooks; create, update, and status changes (including payment) trigger sync to QuickBooks.
- **Client (Customer)**: Platform entity representing the customer for an invoice; must exist in QuickBooks (by lookup or creation) before the related invoice is synced.
- **QuickBooks Customer**: External customer record; created by the system when missing, then referenced when creating QuickBooks invoices.
- **QuickBooks Invoice**: External invoice record; created or updated by the system to mirror platform invoice and payment state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can complete QuickBooks setup (open Integrations → Services, select QuickBooks, enter credentials, save) in under 2 minutes.
- **SC-002**: Every new invoice created in the platform after the integration is enabled results in a corresponding invoice in QuickBooks, with the correct customer linked, under normal conditions (valid credentials and API availability).
- **SC-003**: When a payment is recorded on a platform invoice, the related QuickBooks invoice or payment status is updated so that QuickBooks reflects the payment within one sync cycle.
- **SC-004**: Credentials (Client ID and Client Secret) are not exposed in logs, URLs, or non-admin configuration views after being saved.
- **SC-005**: No historical (pre-enable) invoices are synced to QuickBooks, and no changes made in QuickBooks overwrite or sync back to platform data.

## Assumptions

- QuickBooks connection uses the standard QuickBooks Online accounting API and the documented invoice (and related customer) endpoints.
- “Secure” storage of credentials means at least encryption at rest and access limited to authorized backend processes; exact mechanism is an implementation detail.
- One “platform account” is the same as the scope that has one Integrations configuration (e.g., one tenant or organization).
- Required customer data for creating a QuickBooks customer (e.g., name, contact details) is available or derivable from the platform client record; validation rules align with QuickBooks’ requirements.
- Sync can be synchronous on invoice/payment events or asynchronous (e.g., queue) as long as behavior meets FR-008, FR-009, and success criteria; implementation choice is left to the technical plan.
