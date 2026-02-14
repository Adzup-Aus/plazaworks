/**
 * Extract the current user ID from the request session.
 * Returns undefined if no user is authenticated.
 */
export function getUserId(req: any): string | undefined {
  return req.session?.userId;
}

/**
 * Extract the current user ID from the request session.
 * Throws 401 if no user is authenticated.
 * Use in routes behind the isAuthenticated middleware.
 */
export function requireUserId(req: any): string {
  const userId = req.session?.userId;
  if (!userId) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
  return userId;
}
