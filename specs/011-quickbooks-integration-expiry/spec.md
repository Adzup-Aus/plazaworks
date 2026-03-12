# Feature Specification: QuickBooks Integration Token Expiry Fix

**Feature Branch**: `011-quickbooks-integration-expiry`  
**Created**: 2025-03-12  
**Status**: Draft  
**Input**: User description: "Fix the issue where the QuickBooks integration expires too quickly. and match with the specs ordering > 010"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Integration Stays Connected During Normal Use (Priority: P1)

An admin has connected QuickBooks in Integrations. They use the platform for invoicing and sync to QuickBooks occasionally. The integration should remain connected so that when they trigger a sync (e.g. from an invoice) or view sync status, it works without asking them to reconnect.

**Why this priority**: The core complaint is that the integration "expires too quickly"; keeping it connected during normal use is the main user value.

**Independent Test**: Enable QuickBooks, use the platform without syncing for a period that previously caused expiry (e.g. a few hours or a day). Trigger a sync or open Integrations sync status. The integration remains connected and sync succeeds without re-authorization.

**Acceptance Scenarios**:

1. **Given** QuickBooks is connected and enabled, **When** no sync has run for several hours, **Then** the next sync or status check succeeds without requiring the user to reconnect.
2. **Given** QuickBooks is connected, **When** the user opens the Integrations page or invoice sync option, **Then** the connection is shown as active and usable (no spurious "disconnected" or "expired" state when credentials can still be renewed).

---

### User Story 2 - Reconnection Only When Necessary (Priority: P2)

When the integration can no longer be renewed (e.g. refresh token revoked, user disconnected in QuickBooks), the system shows the connection as disconnected and prompts the user to reconnect. The system does not show "disconnected" or "expired" when the connection can still be renewed automatically.

**Why this priority**: Reduces frustration from being asked to reconnect when the integration could have been kept valid.

**Independent Test**: With a valid connection, verify that the UI does not show disconnected during the period when the system is able to renew the connection in the background. Only after a genuine revocation or long-term inactivity beyond the provider’s limits should reconnection be required.

**Acceptance Scenarios**:

1. **Given** the connection is valid and can be renewed, **When** the user views Integrations or invoice sync, **Then** the integration is shown as connected (not expired).
2. **Given** the provider has revoked the connection or refresh is no longer possible, **When** the user attempts sync or views status, **Then** the system shows disconnected and guides the user to reconnect.

---

### User Story 3 - Sync and Status After Idle Period (Priority: P3)

After the platform has been idle (no syncs, no admin actions) for a period such as overnight or a weekend, the first sync or status check after that period still works without requiring the user to reconnect, as long as the provider still allows renewal.

**Why this priority**: Ensures that occasional users are not surprised by an "expired" integration after a short break.

**Independent Test**: Leave the integration connected and idle for 24–48 hours (or the maximum idle period the product intends to support). Run a sync or open sync status. Sync succeeds or status shows connected without re-authorization.

**Acceptance Scenarios**:

1. **Given** QuickBooks was connected and no sync ran for 24+ hours, **When** an admin triggers a sync or checks sync status, **Then** the operation succeeds and the connection remains valid (or the user is prompted to reconnect only if the provider no longer allows renewal).

---

### Edge Cases

- What happens when the external provider (QuickBooks) revokes the refresh token or the user disconnects the app in QuickBooks? The system should treat the connection as invalid, clear stored credentials, and show disconnected so the user can reconnect.
- How does the system behave when renewal fails temporarily (e.g. network error)? It should retry or allow a subsequent attempt (e.g. on next sync or scheduled job) before clearing the connection and showing disconnected.
- If the system has not run any sync or scheduled refresh for a long time (e.g. server down or job disabled), and the provider’s refresh token has expired, the user must reconnect; the system should make this clear in the UI.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST renew the QuickBooks connection automatically before the connection becomes unusable, so that sync and status checks succeed without user re-authorization during normal and moderate idle periods.
- **FR-002**: The system MUST treat the integration as "connected" in the UI when stored credentials are present and can still be renewed; it MUST NOT show "expired" or "disconnected" solely because a short-lived credential has expired if renewal is possible.
- **FR-003**: When renewal is attempted and succeeds, the system MUST persist the new credentials and expiry so that subsequent syncs and status checks use the renewed connection.
- **FR-004**: When renewal is no longer possible (e.g. refresh token revoked or invalid), the system MUST clear the connection, show the integration as disconnected, and guide the user to reconnect in Integrations.
- **FR-005**: The system MUST attempt or schedule renewal so that the integration remains valid for typical idle periods (e.g. overnight, weekend) without requiring the user to reconnect, within the limits imposed by the external provider.

### Key Entities

- **QuickBooks connection**: Stored link between the platform and a QuickBooks company; includes credentials used for API access and a notion of validity or expiry that the system can evaluate for renewal.
- **Connection status**: The state presented to the user (e.g. connected, disconnected, needs reconnection), derived from whether credentials exist and whether they can still be renewed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users who have connected QuickBooks can trigger a sync or view sync status after 24 hours of no sync activity without having to reconnect in more than 95% of cases where the provider still allows renewal.
- **SC-002**: The integration is shown as "disconnected" or "expired" only when renewal is not possible (e.g. refresh token revoked), not when the connection can still be renewed automatically.
- **SC-003**: Support or user reports of "QuickBooks integration expired too quickly" or "had to reconnect too often" decrease after the change (qualitative measure).
- **SC-004**: After the fix, the typical time between required reconnections (when the user must re-authorize in QuickBooks) is determined only by the provider’s refresh-token lifetime or user revocation, not by short-lived access token expiry alone.

## Assumptions

- The external provider (QuickBooks/Intuit) issues short-lived access tokens and longer-lived refresh tokens; the system can renew access by using the refresh token until the provider revokes it or it expires.
- "Expires too quickly" refers to the integration appearing expired or requiring reconnection sooner than expected (e.g. after hours or a day of no use), not to the provider’s documented refresh-token lifetime.
- The product intends to support at least 24–48 hours of idle time without requiring reconnection, subject to provider limits.
- No change to the provider’s OAuth or token lifetimes is required; the fix is achieved by how and when the platform renews and presents connection status.
