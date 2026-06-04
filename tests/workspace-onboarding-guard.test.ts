import { beforeEach, describe, expect, it, vi } from "vitest";

const clerkAuth = vi.fn();
const clerkCurrentUser = vi.fn();
const redirect = vi.fn((path: string) => { throw new Error(`NEXT_REDIRECT:${path}`); });

const prisma = {
  userProfile: { upsert: vi.fn() },
  workspaceMember: { findFirst: vi.fn(), findMany: vi.fn() },
  workspace: { create: vi.fn() }
};

vi.mock("@clerk/nextjs/server", () => ({ auth: clerkAuth, currentUser: clerkCurrentUser }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/db/prisma", () => ({ prisma }));

describe("workspace onboarding guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clerkAuth.mockResolvedValue({ userId: "clerk_user_1" });
    clerkCurrentUser.mockResolvedValue({
      emailAddresses: [{ emailAddress: "owner@example.com" }],
      firstName: "Work",
      lastName: "Space",
      imageUrl: "https://example.com/avatar.png"
    });
    prisma.userProfile.upsert.mockResolvedValue({ id: "user_1", clerkUserId: "clerk_user_1", email: "owner@example.com" });
  });

  it("redirects signed-in users without an active workspace membership to onboarding", async () => {
    const { requireWorkspaceAccess } = await import("@/lib/auth/rbac");
    prisma.workspaceMember.findFirst.mockResolvedValue(null);

    await expect(requireWorkspaceAccess()).rejects.toThrow("NEXT_REDIRECT:/onboarding");

    expect(prisma.workspaceMember.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "user_1", workspaceId: undefined, status: "ACTIVE", workspace: { status: "ACTIVE" } },
      include: { workspace: true },
      orderBy: { createdAt: "asc" }
    }));
  });

  it("allows signed-in users with an active workspace membership through the guard", async () => {
    const { requireWorkspaceAccess } = await import("@/lib/auth/rbac");
    const workspace = { id: "workspace_1", name: "Acme", status: "ACTIVE" };
    const membership = { id: "member_1", userId: "user_1", workspaceId: "workspace_1", workspace };
    prisma.workspaceMember.findFirst.mockResolvedValue(membership);

    await expect(requireWorkspaceAccess("workspace_1")).resolves.toEqual({ user: { id: "user_1", clerkUserId: "clerk_user_1", email: "owner@example.com" }, membership, workspace });

    expect(redirect).not.toHaveBeenCalled();
  });

  it("does not create a duplicate workspace when onboarding runs for a user who already has one", async () => {
    const { createWorkspaceForCurrentUser } = await import("@/lib/auth/rbac");
    const workspace = { id: "workspace_1", name: "Existing Workspace", status: "ACTIVE" };
    prisma.workspaceMember.findFirst.mockResolvedValue({ id: "member_1", workspace });

    await expect(createWorkspaceForCurrentUser("New Workspace")).resolves.toEqual(workspace);

    expect(prisma.workspace.create).not.toHaveBeenCalled();
  });

  it("creates the first workspace and owner membership after onboarding validation", async () => {
    const { createWorkspaceForCurrentUser } = await import("@/lib/auth/rbac");
    const workspace = { id: "workspace_2", name: "First Workspace", status: "ACTIVE" };
    prisma.workspaceMember.findFirst.mockResolvedValue(null);
    prisma.workspace.create.mockResolvedValue(workspace);

    await expect(createWorkspaceForCurrentUser("First Workspace")).resolves.toEqual(workspace);

    expect(prisma.workspace.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      name: "First Workspace",
      ownerId: "user_1",
      members: { create: { userId: "user_1", roleKey: "WORKSPACE_OWNER" } }
    }) });
  });

  it("applies the onboarding guard before rendering the dashboard shell", async () => {
    const { default: DashboardLayout } = await import("@/app/dashboard/layout");
    prisma.workspaceMember.findFirst.mockResolvedValue(null);

    await expect(DashboardLayout({ children: "dashboard" })).rejects.toThrow("NEXT_REDIRECT:/onboarding");
  });
});
