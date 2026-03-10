import type { Express, Request, Response } from "express";
import { z } from "zod";
// @ts-expect-error intuit-oauth is CommonJS, no types
import OAuthClient from "intuit-oauth";
import { storage, isAuthenticated, requirePermission } from "../../routes/shared";
import { encrypt, decrypt } from "../../lib/encrypt";
import { refreshAccessToken } from "../../services/quickbooksClient";
import { getValidQuickBooksConnection } from "../../services/quickbooksSync";

const QB_CALLBACK_PATH = "/api/quickbooks/oauth/callback";
const QB_ENVIRONMENT = process.env.QUICKBOOKS_ENVIRONMENT === "production" ? "production" : "sandbox";
const DEBUG_LOG =
  (loc: string, msg: string, data: Record<string, unknown>) =>
  fetch("http://127.0.0.1:7735/ingest/955633da-0e93-4a3b-a221-925a0e6be9ff", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "c7ce08" },
    body: JSON.stringify({
      sessionId: "c7ce08",
      location: loc,
      message: msg,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});

const putConnectionSchema = z.object({
  clientId: z.string().min(1, "Client ID is required"),
  clientSecret: z.string().min(1, "Client Secret is required"),
});

function isTestOrPlaceholderClientId(id: string): boolean {
  if (process.env.NODE_ENV === "test") return false;
  return id === "test-client-id" || /^test[-_]client[-_]?id$/i.test(id);
}

function getRedirectUri(req: Request): string {
  const path = QB_CALLBACK_PATH;
  const envRedirect = process.env.QUICKBOOKS_REDIRECT_URI;
  const appUrl = process.env.APP_URL;
  const base = envRedirect || appUrl || "";
  const host = req.get("host") ?? null;
  const protocol = req.protocol;
  const xForwardedProto = req.get("x-forwarded-proto") ?? null;
  const finalProtocol = base ? null : (xForwardedProto || protocol || "http");
  const finalHost = base ? null : (host || "localhost");
  const baseNorm = base ? base.replace(/\/$/, "") : "";
  // If base already ends with the callback path (user set full URL), use as-is; otherwise append path
  const redirectUri = baseNorm
    ? baseNorm.endsWith(path)
      ? baseNorm
      : baseNorm + path
    : `${finalProtocol}://${finalHost}${path}`;
  DEBUG_LOG("getRedirectUri", "redirect_uri built", {
    QUICKBOOKS_REDIRECT_URI: envRedirect ? "(set)" : "(unset)",
    APP_URL: appUrl ? "(set)" : "(unset)",
    base: base || "(fallback)",
    host: finalHost ?? host,
    protocol: finalProtocol ?? protocol,
    redirectUri,
  });
  return redirectUri;
}

function createOAuthClient(clientId: string, clientSecret: string, redirectUri: string): InstanceType<typeof OAuthClient> {
  return new OAuthClient({
    clientId,
    clientSecret,
    environment: QB_ENVIRONMENT,
    redirectUri,
  });
}

export function registerQuickBooksRoutes(app: Express): void {
  const adminOnly = [isAuthenticated, requirePermission("admin_settings")] as const;

  // GET /api/quickbooks/redirect-uri - exact URL to add in Intuit app's Redirect URIs (admin only)
  app.get("/api/quickbooks/redirect-uri", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const redirectUri = getRedirectUri(req);
      res.json({ redirectUri });
    } catch (err) {
      console.error("QuickBooks redirect-uri:", err);
      res.status(500).json({ message: "Failed to get redirect URI" });
    }
  });

  // GET /api/quickbooks/status - whether sync is enabled (for invoices page; view_invoices can see)
  app.get(
    "/api/quickbooks/status",
    isAuthenticated,
    requirePermission("view_invoices"),
    async (_req, res) => {
      try {
        const conn = await storage.getQuickBooksConnection();
        const enabled = !!(conn?.realm_id && conn.encrypted_access_token && conn.enabled_at);
        res.json({ enabled });
      } catch (err) {
        console.error("QuickBooks get status:", err);
        res.status(500).json({ message: "Failed to get QuickBooks status" });
      }
    }
  );

  // GET /api/quickbooks/connection - status only, no credentials
  app.get("/api/quickbooks/connection", ...adminOnly, async (_req, res) => {
    try {
      const conn = await storage.getQuickBooksConnection();
      if (!conn) {
        return res.json({ configured: false, connected: false, realmId: null, enabledAt: null });
      }
      const configured = !!(conn.encrypted_client_id && conn.encrypted_client_secret);
      const connected = !!(conn.realm_id && conn.encrypted_access_token);
      res.json({
        configured,
        connected,
        realmId: conn.realm_id ?? null,
        enabledAt: conn.enabled_at ?? null,
      });
    } catch (err) {
      console.error("QuickBooks get connection:", err);
      res.status(500).json({ message: "Failed to get QuickBooks connection status" });
    }
  });

  // PUT /api/quickbooks/connection - save client id/secret (encrypted)
  app.put("/api/quickbooks/connection", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const parsed = putConnectionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid body", errors: parsed.error.flatten() });
      }
      const { clientId, clientSecret } = parsed.data;
      if (isTestOrPlaceholderClientId(clientId)) {
        return res.status(400).json({ message: "Use your real Intuit Development Client ID from developer.intuit.com → Keys & OAuth, not test credentials." });
      }
      const conn = await storage.getQuickBooksConnection();
      const encryptedClientId = encrypt(clientId);
      const encryptedClientSecret = encrypt(clientSecret);
      await storage.upsertQuickBooksConnection({
        id: conn?.id,
        encrypted_client_id: encryptedClientId,
        encrypted_client_secret: encryptedClientSecret,
      });
      const redirectUri = getRedirectUri(req);
      const oauthClient = createOAuthClient(clientId, clientSecret, redirectUri);
      const authUrl = oauthClient.authorizeUri({
        scope: [OAuthClient.scopes.Accounting],
        state: "quickbooks",
      });
      res.json({ saved: true, oauthStartUrl: authUrl });
    } catch (err) {
      console.error("QuickBooks save credentials:", err);
      res.status(500).json({ message: "Failed to save QuickBooks credentials" });
    }
  });

  // GET /api/quickbooks/oauth/start - return URL to redirect user to Intuit
  app.get("/api/quickbooks/oauth/start", ...adminOnly, async (req: Request, res: Response) => {
    try {
      const conn = await storage.getQuickBooksConnection();
      if (!conn?.encrypted_client_id || !conn?.encrypted_client_secret) {
        return res.status(400).json({ message: "QuickBooks credentials not configured. Save Client ID and Client Secret first." });
      }
      const clientId = decrypt(conn.encrypted_client_id);
      const clientSecret = decrypt(conn.encrypted_client_secret);
      if (isTestOrPlaceholderClientId(clientId)) {
        return res.status(400).json({
          message: "Replace test credentials with your real Intuit Client ID and Secret, then Save credentials before Reconnecting.",
        });
      }
      const redirectUri = getRedirectUri(req);
      const oauthClient = createOAuthClient(clientId, clientSecret, redirectUri);
      const url = oauthClient.authorizeUri({
        scope: [OAuthClient.scopes.Accounting],
        state: "quickbooks",
      });
      DEBUG_LOG("oauth/start", "auth URL built by intuit-oauth", {
        QB_ENVIRONMENT,
        clientIdPrefix: clientId ? `${clientId.slice(0, 6)}...` : "(empty)",
        redirectUri,
        authUrl: url,
        scopeUsed: OAuthClient.scopes.Accounting,
      });
      res.json({ url });
    } catch (err) {
      console.error("QuickBooks OAuth start:", err);
      res.status(500).json({ message: "Failed to build OAuth URL" });
    }
  });

  // GET /api/quickbooks/oauth/callback - exchange code for tokens (no auth required for redirect)
  app.get("/api/quickbooks/oauth/callback", async (req: Request, res: Response) => {
    const { code, realmId } = req.query;
    const integrationsPath = "/integrations";
    const base = process.env.APP_URL || (req.get("host") ? `${req.protocol}://${req.get("host")}` : "http://localhost:5000");
    const redirectBase = base.replace(/\/$/, "");

    DEBUG_LOG("oauth/callback", "callback hit", {
      hasCode: !!code,
      hasRealmId: !!realmId,
      realmId: typeof realmId === "string" ? realmId : "(invalid)",
      queryKeys: Object.keys(req.query),
    });

    if (!code || !realmId || typeof code !== "string" || typeof realmId !== "string") {
      return res.redirect(`${redirectBase}${integrationsPath}?quickbooks=error&message=missing_code_or_realm`);
    }
    try {
      const conn = await storage.getQuickBooksConnection();
      if (!conn?.encrypted_client_id || !conn?.encrypted_client_secret) {
        return res.redirect(`${redirectBase}${integrationsPath}?quickbooks=error&message=not_configured`);
      }
      const clientId = decrypt(conn.encrypted_client_id);
      const clientSecret = decrypt(conn.encrypted_client_secret);
      const redirectUri = getRedirectUri(req);
      const fullRedirectUrl = redirectUri + (req.originalUrl.includes("?") ? "?" + req.originalUrl.split("?")[1] : "");

      DEBUG_LOG("oauth/callback", "token exchange start", {
        redirectUri,
        fullRedirectUrl,
        realmId,
      });

      const oauthClient = createOAuthClient(clientId, clientSecret, redirectUri);
      const authResponse = await oauthClient.createToken(fullRedirectUrl);
      const token = authResponse.getToken();

      const refreshTokenVal = typeof token.refresh_token === "string" ? token.refresh_token.trim() : "";
      if (!refreshTokenVal) {
        throw new Error("OAuth token exchange did not return a refresh token");
      }
      const realmIdFromToken = token.realmId || realmId;

      // Use tokens from the refresh endpoint for QuickBooks API. The token from the auth-code
      // exchange can be rejected by the Accounting API (e.g. "Malformed bearer token: too long");
      // the refresh endpoint returns an access_token in the format the API expects.
      const refreshed = await refreshAccessToken(clientId, clientSecret, refreshTokenVal);
      const accessToken = typeof refreshed.access_token === "string" ? refreshed.access_token.trim() : "";
      const storedRefresh = (refreshed.refresh_token && refreshed.refresh_token.trim()) || refreshTokenVal;
      if (!accessToken) {
        throw new Error("Token refresh did not return a valid access token");
      }

      DEBUG_LOG("oauth/callback", "token exchange success", {
        realmId: realmIdFromToken,
        hasAccessToken: !!accessToken,
        expiresIn: refreshed.expires_in,
      });

      const expiresAt = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000);
      await storage.upsertQuickBooksConnection({
        encrypted_access_token: encrypt(accessToken),
        encrypted_refresh_token: encrypt(storedRefresh),
        realm_id: realmIdFromToken,
        token_expires_at: expiresAt,
        enabled_at: new Date(),
      });
      res.redirect(`${redirectBase}${integrationsPath}?quickbooks=connected`);
    } catch (err) {
      console.error("QuickBooks OAuth callback:", err);
      const errObj = err && typeof err === "object" ? err as Record<string, unknown> : {};
      const errMessage = "error" in errObj ? String(errObj.error) : "callback_error";
      DEBUG_LOG("oauth/callback", "token exchange failed", {
        error: errMessage,
        errorDescription: "error_description" in errObj ? String(errObj.error_description) : undefined,
        intuitTid: "intuit_tid" in errObj ? String(errObj.intuit_tid) : undefined,
        keys: Object.keys(errObj),
      });
      res.redirect(`${redirectBase}${integrationsPath}?quickbooks=error&message=${encodeURIComponent(errMessage)}`);
    }
  });

  // POST /api/quickbooks/disconnect - clear tokens, keep credentials
  app.post("/api/quickbooks/disconnect", ...adminOnly, async (_req: Request, res: Response) => {
    try {
      const conn = await storage.getQuickBooksConnection();
      if (!conn) return res.json({ disconnected: true });
      await storage.upsertQuickBooksConnection({
        encrypted_access_token: null,
        encrypted_refresh_token: null,
        realm_id: null,
        token_expires_at: null,
        enabled_at: null,
      });
      res.json({ disconnected: true });
    } catch (err) {
      console.error("QuickBooks disconnect:", err);
      res.status(500).json({ message: "Failed to disconnect QuickBooks" });
    }
  });
}
