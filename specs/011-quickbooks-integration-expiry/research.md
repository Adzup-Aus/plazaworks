# Research: QuickBooks Integration Token Expiry Fix

## Decisions

- **Decision**: Rely on existing `getValidQuickBooksConnection` and `proactiveRefreshQuickBooksToken` as the primary mechanisms to keep the QuickBooks connection valid.
  - **Rationale**: These helpers already centralise token refresh logic and are used by sync and scheduled refresh paths; refining their thresholds and error handling directly addresses “expires too quickly” without re-architecting the integration.
  - **Alternatives considered**:
    - Add ad‑hoc refresh logic in every route that touches QuickBooks → rejected as duplicated logic and increased risk of divergence.
    - Introduce a new background worker or job system just for QuickBooks tokens → rejected as unnecessary complexity for a single integration when `setInterval` + existing service are sufficient.

- **Decision**: Keep token expiry and status evaluation on the backend and expose only high‑level connection status to the frontend.
  - **Rationale**: The backend already owns OAuth tokens and expiry timestamps; keeping logic server‑side avoids leaking token semantics to the client and keeps UI code simple.
  - **Alternatives considered**:
    - Let the frontend derive “expired” vs “connected” purely from fields like `enabledAt` or timestamps → rejected because it couples UI to token details and could misinterpret states.

- **Decision**: Treat the integration as “connected” as long as credentials exist and either the access token is valid or can be refreshed with the stored refresh token.
  - **Rationale**: Aligns with the spec’s requirement that the integration should not appear expired when it can still be renewed automatically.
  - **Alternatives considered**:
    - Mark “disconnected” whenever the access token itself is expired → rejected because it causes unnecessary reconnect prompts even though a refresh is possible.

- **Decision**: Use a proactive refresh window that is large enough to cover overnight/weekend gaps but not so aggressive that it risks hitting provider limits.
  - **Rationale**: The existing 24‑hour `PROACTIVE_REFRESH_BUFFER_MS` and 12‑hour interval in `server/index.ts` already target this behaviour; the main focus is ensuring connection status and error handling do not prematurely clear the connection.
  - **Alternatives considered**:
    - Refresh on every request regardless of expiry window → rejected as wasteful and potentially rate‑limited by the provider.

## Open Questions (tracked but not blocking)

- Maximum safe refresh frequency and refresh token lifetime are determined by QuickBooks/Intuit documentation; this plan assumes the current usage pattern (on startup + every 12h with a 24h buffer) is within limits.
- Full end-to-end validation of idle-period behaviour and revoked-token handling requires a live QuickBooks sandbox; automated tests cover token refresh logic and connection state, but manual verification should still be performed using the steps in `quickstart.md`.

