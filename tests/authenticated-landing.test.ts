import { describe, expect, it } from "vitest";
import { resolveAuthenticatedLandingRoute, safeRequestedPath } from "@/lib/auth/landing";

describe("authenticated landing routing", () => {
  const subscriber = { isOperator: false, hasWorkspaceMembership: true, isPortalOnly: false };

  it("routes generic operators to the platform", () => {
    expect(resolveAuthenticatedLandingRoute({ ...subscriber, isOperator: true })).toBe("/platform");
  });

  it("routes dual-role operators to the platform even with workspace membership", () => {
    expect(
      resolveAuthenticatedLandingRoute({
        isOperator: true,
        hasWorkspaceMembership: true,
        isPortalOnly: false,
        requestedPath: "/dashboard",
      }),
    ).toBe("/platform");
  });

  it("keeps operator platform deep links", () => {
    expect(
      resolveAuthenticatedLandingRoute({
        ...subscriber,
        isOperator: true,
        requestedPath: "/platform/subscribers",
      }),
    ).toBe("/platform/subscribers");
  });

  it("does not send operators to onboarding when they lack a workspace", () => {
    expect(
      resolveAuthenticatedLandingRoute({
        isOperator: true,
        hasWorkspaceMembership: false,
        isPortalOnly: false,
        requiresOnboarding: true,
      }),
    ).toBe("/platform");
  });

  it("routes generic subscribers to the dashboard", () => {
    expect(resolveAuthenticatedLandingRoute(subscriber)).toBe("/dashboard");
  });

  it("routes portal-only users to the portal", () => {
    expect(resolveAuthenticatedLandingRoute({ ...subscriber, isPortalOnly: true })).toBe("/portal");
  });

  it("rejects subscriber platform deep links", () => {
    expect(resolveAuthenticatedLandingRoute({ ...subscriber, requestedPath: "/platform/catalog" })).toBe("/dashboard");
  });

  it("uses onboarding for subscribers without membership", () => {
    expect(
      resolveAuthenticatedLandingRoute({
        ...subscriber,
        hasWorkspaceMembership: false,
        requiresOnboarding: true,
      }),
    ).toBe("/onboarding");
  });

  it("rejects unsafe return URLs", () => {
    expect(safeRequestedPath("//evil.example")).toBeNull();
  });

  it("ignores /app as a deep link", () => {
    expect(safeRequestedPath("/app")).toBeNull();
  });
});
