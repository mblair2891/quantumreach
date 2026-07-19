import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();

describe("platform workspace directory", () => {
  it("uses persisted workspace data and provides searchable detail links", async () => {
    const page = await readFile(join(root, "app/platform/workspaces/page.tsx"), "utf8");
    const service = await readFile(join(root, "lib/platform/workspaces.ts"), "utf8");
    expect(page).toContain("getWorkspaceDirectory");
    expect(page).toContain("Search name, owner, email, or workspace ID");
    expect(page).toContain("Open Workspace");
    expect(page).toContain("/platform/workspaces/${row.workspace.id}");
    expect(page).toContain("My Workspace");
    expect(page).not.toContain("PlatformPageTemplate");
    expect(service).toContain("prisma.workspace.findMany");
    expect(service).toContain("workspace.members.some");
  });

  it("provides an idempotent persisted operator bootstrap rather than a demo workspace", async () => {
    const service = await readFile(join(root, "lib/platform/workspaces.ts"), "utf8");
    const actions = await readFile(join(root, "app/platform/workspaces/actions.ts"), "utf8");
    const rbac = await readFile(join(root, "lib/auth/rbac.ts"), "utf8");
    expect(actions).toContain("createMyWorkspaceAction");
    expect(service).toContain("tx.workspaceMember.create");
    expect(service).toContain("tx.saasWorkspaceProfile.create");
    expect(rbac).not.toContain("DEMO_WORKSPACE_ID");
  });
});
