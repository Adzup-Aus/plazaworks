import type { RequestWithApiIntegration } from "./middleware/apiAuth";

/**
 * Extract the current user ID from the request (session or API token).
 * Returns session userId, or apiIntegration.createdBy when authenticated via Bearer token, or undefined.
 */
export function getUserId(req: RequestWithApiIntegration | any): string | undefined {
  return req.session?.userId ?? req.apiIntegration?.createdBy;
}

/**
 * Extract the current user ID from the request (session or API token).
 * Throws 401 if no user is authenticated.
 * Use in routes behind the isAuthenticated middleware.
 */
export function requireUserId(req: RequestWithApiIntegration | any): string {
  const userId = getUserId(req);
  if (!userId) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
  return userId;
}
