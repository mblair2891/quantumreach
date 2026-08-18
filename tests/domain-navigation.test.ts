import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("managed domain and registrant navigation", () => {
  it("shows Sending Domains in the workspace dashboard navigation", () => {
    const shell = read("components/dashboard/shell.tsx");
    const domainNav = read("components/dashboard/domain-navigation.ts");
    const nav = read("lib/saas/navigation.ts");
    expect(shell).toContain("workspaceDomainNavItem");
    expect(domainNav).toContain('"Sending Domains"');
    expect(domainNav).toContain('"/dashboard/sending/domains"');
    expect(nav).toContain('href:"/dashboard/sending/domains"');
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

  it("routes the legacy sending-domains URL to the live BYO page", () => {
    const legacy = read("app/dashboard/sending-domains/page.tsx");
    const page = read("app/dashboard/sending/domains/page.tsx");
    expect(legacy).toContain('redirect("/dashboard/sending/domains")');
    expect(page).toContain("requireSubscriberWorkspaceAccess");
    expect(page).toContain("addByoDomainAction");
    expect(page).toContain("Connect domain");
    expect(page).toContain("Bring your own domain");
    expect(page).not.toContain("not yet self-service");
    expect(page).not.toContain("WORKSPACE_OWNED");
    expect(page).toContain("/dashboard/settings/domain-registrant");
  });

  it("has no broken managed-domain navigation links in the wired pages", () => {
    const sendingDomains = read("app/dashboard/sending/domains/page.tsx");
    const settings = read("app/dashboard/settings/page.tsx");
    const domainNav = read("components/dashboard/domain-navigation.ts");
    expect(domainNav).toContain('"/dashboard/sending/domains"');
    expect(domainNav).toContain('"/dashboard/admin/domains"');
    expect(settings).toContain("/dashboard/settings/domain-registrant");
    expect(sendingDomains).toContain('href="/dashboard/settings/domain-registrant"');
    expect(sendingDomains).toContain("No domains connected yet. Connect a domain you own to start setup.");
    expect(sendingDomains).toContain("Connect a domain you own, or request a managed domain");
    expect(sendingDomains).not.toContain("BYO setup is not yet self-service");
    expect(sendingDomains).not.toContain("WORKSPACE_OWNED");
  });

  it("lets subscribers copy displayed DNS name and value strings", () => {
    const page = read("app/dashboard/sending/domains/page.tsx");
    const button = read("components/dashboard/copy-value-button.tsx");
    expect(page).toContain("Publish these DNS records");
    expect(page).toContain("CopyValueButton");
    expect(page).toContain("displayDnsRecordName");
    expect(page).toContain("value={name.host}");
    expect(page).toContain('value={record.value}');
    expect(page).toContain('ariaLabel="Copy name"');
    expect(page).toContain('ariaLabel="Copy value"');
    expect(page).toContain("If your DNS host adds your domain automatically");
    expect(page).toContain("RemoveByoDomainForm");
    expect(button).toContain("navigator.clipboard.writeText(value)");
    expect(button).toContain("Copy failed");
    expect(button).toContain('status === "copied" ? "Copied"');
  });
});
