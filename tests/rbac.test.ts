import { describe, expect, it } from "vitest";
import { can } from "@/lib/auth/rbac";

describe("rbac foundation", () => {
  it("allows owners to manage every subject", () => expect(can("WORKSPACE_OWNER", "delete", "crm")).toBe(true));
  it("limits viewers to read-only access", () => { expect(can("VIEWER", "read", "crm")).toBe(true); expect(can("VIEWER", "write", "crm")).toBe(false); });
  it("allows sales reps to write CRM records", () => expect(can("SALES_REP", "write", "crm")).toBe(true));
});
