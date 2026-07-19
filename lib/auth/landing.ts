/** Pure routing policy for generic authenticated entry points. */
export type LandingContext = {
  isOperator: boolean;
  hasWorkspaceMembership: boolean;
  isPortalOnly: boolean;
  requiresOnboarding?: boolean;
  requiresSubscription?: boolean;
  requestedPath?: string | null;
};

const authorizedPrefixes = ["/platform", "/dashboard", "/portal", "/onboarding", "/billing"];
export function safeRequestedPath(path?: string | null) {
  if (!path || !path.startsWith("/") || path.startsWith("//") || !authorizedPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return null;
  return path;
}

/** Resolve a generic post-auth destination without overriding an authorized deep link. */
export function resolveAuthenticatedLandingRoute(context: LandingContext) {
  const requested = safeRequestedPath(context.requestedPath);
  if (context.requiresOnboarding || !context.hasWorkspaceMembership) return "/onboarding";
  if (context.isPortalOnly) return requested?.startsWith("/portal") ? requested : "/portal";
  if (context.requiresSubscription) return requested?.startsWith("/billing") ? requested : "/billing";
  if (requested) {
    if (requested.startsWith("/platform") && !context.isOperator) return "/dashboard";
    if (requested.startsWith("/portal")) return "/dashboard";
    return requested;
  }
  return context.isOperator ? "/platform" : "/dashboard";
}
