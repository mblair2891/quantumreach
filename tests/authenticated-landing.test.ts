import { describe, expect, it } from "vitest";
import { resolveAuthenticatedLandingRoute, safeRequestedPath } from "@/lib/auth/landing";

describe("authenticated landing routing", () => {
  const subscriber = { isOperator: false, hasWorkspaceMembership: true, isPortalOnly: false };
  it("routes generic operators to the platform", () => expect(resolveAuthenticatedLandingRoute({ ...subscriber, isOperator: true })).toBe("/platform"));
  it("routes generic subscribers to the dashboard", () => expect(resolveAuthenticatedLandingRoute(subscriber)).toBe("/dashboard"));
  it("routes portal-only users to the portal", () => expect(resolveAuthenticatedLandingRoute({ ...subscriber, isPortalOnly: true })).toBe("/portal"));
  it("keeps an operator's authorized workspace deep link", () => expect(resolveAuthenticatedLandingRoute({ ...subscriber, isOperator: true, requestedPath: "/dashboard/sending" })).toBe("/dashboard/sending"));
  it("rejects subscriber platform deep links", () => expect(resolveAuthenticatedLandingRoute({ ...subscriber, requestedPath: "/platform/catalog" })).toBe("/dashboard"));
  it("uses onboarding before role destinations", () => expect(resolveAuthenticatedLandingRoute({ ...subscriber, isOperator: true, requiresOnboarding: true })).toBe("/onboarding"));
  it("rejects unsafe return URLs", () => expect(safeRequestedPath("//evil.example")).toBeNull());
});
