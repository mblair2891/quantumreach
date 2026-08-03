import { describe, expect, it } from "vitest";
import { isSimulatedPaymentEnvironment, simulatedPaymentEnvironmentName } from "@/lib/simulated-payment/environment";
import fs from "node:fs";
import path from "node:path";

const source = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("simulated payment environment safety", () => {
  it.each([
    [{ VERCEL_ENV: "preview", NODE_ENV: "production" }, true, "preview"],
    [{ NODE_ENV: "development" }, true, "development"],
    [{ VERCEL_ENV: "production", NODE_ENV: "development" }, false, "unavailable"],
    [{ VERCEL_ENV: "production", NODE_ENV: "production" }, false, "unavailable"],
    [{ NODE_ENV: "production" }, false, "unavailable"],
    [{ VERCEL_ENV: "development", NODE_ENV: "test" }, false, "unavailable"],
  ] as const)("gates %o", (environment, allowed, name) => {
    expect(isSimulatedPaymentEnvironment(environment)).toBe(allowed);
    expect(simulatedPaymentEnvironmentName(environment)).toBe(name);
  });

  it("enforces the same shared gate in UI, action, and service without an override", () => {
    const page = source("app/setup/confirmation/page.tsx");
    const action = source("app/setup/confirmation/actions.ts");
    const service = source("lib/simulated-payment/service.ts");
    expect(page).toContain("isSimulatedPaymentEnvironment()");
    expect(action).toContain("assertSimulatedPaymentEnvironment()");
    expect(service).toContain("assertSimulatedPaymentEnvironment()");
    expect([page, action, service].join("\n")).not.toMatch(/SIMULATED.*ENABLED|ALLOW.*SIMULATED|PUBLIC.*SIMULATED/i);
  });

  it("keeps authorization and canonical fulfillment at the service boundary", () => {
    const service = source("lib/simulated-payment/service.ts");
    expect(service).toContain("order.userId !== input.actorUserId");
    expect(service).toContain("fulfillCustomerOrder(order.id)");
    expect(service).toContain('paymentMethod: "SIMULATED_TEST"');
    expect(service).not.toContain("COMPLIMENTARY");
  });
});
