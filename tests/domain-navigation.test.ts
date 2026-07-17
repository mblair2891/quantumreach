import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("managed domain and registrant navigation", () => {
  it("shows Sending Domains in the workspace dashboard navigation", () => {
    const shell = read("components/dashboard/shell.tsx");
    const domainNav = read("components/dashboard/domain-navigation.ts");
    expect(shell).toContain("workspaceDomainNavItem");
    expect(domainNav).toContain('"Sending Domains"');
    expect(domainNav).toContain('"/dashboard/sending-domains"');
  });

  it("shows Domain Inventory only through the operator allowlist gate", () => {
    const shell = read("components/dashboard/shell.tsx");
    const domainNav = read("components/dashboard/domain-navigation.ts");
    expect(shell).toContain("getAuthorizedDomainNavItems()");
    expect(domainNav).toContain("isOperatorEmail(email)");
    expect(domainNav).toContain('"Domain Inventory"');
    expect(domainNav).toContain('"/dashboard/admin/domains"');
  });

  it("keeps the registrant profile route admin and workspace scoped", () => {
    const page = read("app/dashboard/settings/domain-registrant/page.tsx");
    expect(page).toContain("await requireWorkspaceAdmin()");
    expect(page).toContain("requireWorkspaceAdmin(String(formData.get(\"workspaceId\") || undefined))");
    expect(page).toContain("getDomainRegistrantProfile(workspace.id)");
    expect(page).toContain("upsertDomainRegistrantProfile");
    expect(page).toContain("confirmDomainRegistrantProfile");
  });

  it("gives workspace admins an entry point from settings without broken legacy links", () => {
    const settings = read("app/dashboard/settings/page.tsx");
    expect(settings).toContain("Domain Registrant Profile");
    expect(settings).toContain('href="/dashboard/settings/domain-registrant"');
    expect(settings).not.toContain("/dashboard/settings/domains/registrant");
  });

  it("blocks unauthorized registrant data access from the sending domains page", () => {
    const page = read("app/dashboard/sending-domains/page.tsx");
    expect(page).toContain("await requireWorkspaceAccess()");
    expect(page).toContain("listWorkspaceDomains(workspace.id)");
    expect(page).toContain("canManageRegistrant");
    expect(page).toContain("Ask a workspace admin to manage registrant details.");
  });

  it("has no broken managed-domain navigation links in the wired pages", () => {
    const sendingDomains = read("app/dashboard/sending-domains/page.tsx");
    const settings = read("app/dashboard/settings/page.tsx");
    const domainNav = read("components/dashboard/domain-navigation.ts");
    expect(domainNav).toContain('"/dashboard/sending-domains"');
    expect(domainNav).toContain('"/dashboard/admin/domains"');
    expect(settings).toContain("/dashboard/settings/domain-registrant");
    expect(sendingDomains).toContain('href="/dashboard/settings/domain-registrant"');
    expect(sendingDomains).toContain('href="#domain-readiness"');
  });
});
