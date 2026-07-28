import { describe, expect, it } from "vitest";
import { resolveSubscriberLifecycle } from "@/lib/customer-journey/lifecycle";
import { joinProfileSchema } from "@/lib/customer-journey/profile";

const profile = { firstName: "Taylor", lastName: "Reed", businessName: "BrightPath Client Growth", businessType: "Client growth", timezone: "America/New_York", country: "us", intendedUse: "Operate a test-safe subscriber workspace.", agreementAccepted: "on" };

describe("subscriber lifecycle", () => {
  it("validates and normalizes the join profile", () => expect(joinProfileSchema.parse(profile).country).toBe("US"));
  it("requires authorized clearance without fabricating payment", () => expect(resolveSubscriberLifecycle({ profileComplete: true, order: { status: "CHECKOUT_PENDING", paymentStatus: "UNPAID" }, infrastructure: { status: "PENDING", selectedProductKey: "LAUNCH_SENDER_PACKAGE", priority: "STANDARD" } })).toMatchObject({ stage: "AWAITING_FINANCIAL_CLEARANCE", dashboardReady: false, route: "/setup/status" }));
  it("makes the dashboard available independently of deferred infrastructure", () => expect(resolveSubscriberLifecycle({ profileComplete: true, order: { status: "FULFILLED", paymentStatus: "PAID" }, infrastructure: { status: "WAITING_ON_PROVIDER", selectedProductKey: "LAUNCH_SENDER_PACKAGE", priority: "STANDARD" }, workspaceReady: true, membershipReady: true, subscriptionReady: true, entitlementsReady: true, onboardingComplete: false })).toMatchObject({ stage: "ONBOARDING_REQUIRED", dashboardReady: true, route: "/dashboard/onboarding" }));
  it("resolves completed onboarding to the dashboard", () => expect(resolveSubscriberLifecycle({ profileComplete: true, order: { status: "FULFILLED", paymentStatus: "PAID" }, infrastructure: { status: "WAITING_ON_PROVIDER", selectedProductKey: "LAUNCH_SENDER_PACKAGE", priority: "STANDARD" }, workspaceReady: true, membershipReady: true, subscriptionReady: true, entitlementsReady: true, onboardingComplete: true })).toMatchObject({ stage: "DASHBOARD_ACTIVE", route: "/dashboard" }));
  it("surfaces retryable provisioning failure", () => expect(resolveSubscriberLifecycle({ profileComplete: true, order: { status: "FAILED", paymentStatus: "PAID" }, infrastructure: { status: "FAILED", selectedProductKey: "LAUNCH_SENDER_PACKAGE", priority: "STANDARD" } })).toMatchObject({ stage: "FAILED", retryable: true }));
});
