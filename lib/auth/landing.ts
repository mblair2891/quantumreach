/** Pure routing policy for generic authenticated entry points. */
export type LandingContext = {
  isOperator: boolean;
  hasWorkspaceMembership: boolean;
  isPortalOnly: boolean;
  requiresOnboarding?: boolean;
  requiresSubscription?: boolean;
  requestedPath?: string | null;
};

const authorizedPrefixes = ["/platform", "/dashboard", "/portal", "/onboarding", "/billing", "/app"];

export function safeRequestedPath(path?: string | null) {
  if (
    !path ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    !authorizedPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
  ) {
    return null;
  }
  // /app is a resolver only — treat as "no deep link".
  if (path === "/app" || path.startsWith("/app?")) return null;
  return path;
}

/**
 * Resolve post-auth destination.
 *
 * Operators (ADMIN_EMAILS / platform access) always default to /platform, even when
 * they also have subscriber workspaces. Subscribers go to /dashboard (or onboarding/portal).
 */
export function resolveAuthenticatedLandingRoute(context: LandingContext) {
  const requested = safeRequestedPath(context.requestedPath);

  // Platform operators: prefer platform console. Allow only /platform deep links.
  if (context.isOperator) {
    if (requested?.startsWith("/platform")) return requested;
    return "/platform";
  }

  if (context.requiresOnboarding || !context.hasWorkspaceMembership) return "/onboarding";
  if (context.isPortalOnly) return requested?.startsWith("/portal") ? requested : "/portal";
  if (context.requiresSubscription) return requested?.startsWith("/billing") ? requested : "/billing";
  if (requested) {
    if (requested.startsWith("/platform")) return "/dashboard";
    if (requested.startsWith("/portal") && !context.isPortalOnly) return "/dashboard";
    return requested;
  }
  return "/dashboard";
}
