import { beforeEach, describe, expect, it, vi } from "vitest";

const getBetterAuthSession = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

const prisma = {
  userProfile: {
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  workspaceMember: { findFirst: vi.fn(), findMany: vi.fn() },
  workspace: { create: vi.fn(), findUnique: vi.fn() },
};

vi.mock("@/lib/auth/session", () => ({ getBetterAuthSession }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/db/prisma", () => ({ prisma }));

const authUser = { id: "auth_user_1", email: "owner@example.com", name: "Work Space", image: "https://example.com/avatar.png" };
const profile = { id: "user_1", authUserId: "auth_user_1", email: "owner@example.com", firstName: "Work", lastName: "Space" };

describe("workspace onboarding guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBetterAuthSession.mockResolvedValue({ session: { id: "sess_1" }, user: authUser });
    prisma.userProfile.findUnique.mockImplementation(async ({ where }: { where: Record<string, string> }) => {
      if (where.authUserId === "auth_user_1" || where.email === "owner@example.com") return profile;
      return null;
    });
    prisma.userProfile.update.mockResolvedValue(profile);
    prisma.userProfile.create.mockResolvedValue(profile);
  });

  it("redirects signed-in users without an active workspace membership to onboarding", async () => {
    const { requireWorkspaceAccess } = await import("@/lib/auth/rbac");
    prisma.workspaceMember.findFirst.mockResolvedValue(null);

    await expect(requireWorkspaceAccess()).rejects.toThrow("NEXT_REDIRECT:/onboarding");

    expect(prisma.workspaceMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user_1", workspaceId: undefined, status: "ACTIVE", workspace: { status: "ACTIVE" } },
        include: { workspace: true },
        orderBy: { createdAt: "asc" },
      }),
    );
  });

  it("allows signed-in users with an active workspace membership through the guard", async () => {
    const { requireWorkspaceAccess } = await import("@/lib/auth/rbac");
    const workspace = { id: "workspace_1", name: "Acme", status: "ACTIVE" };
    const membership = { id: "member_1", userId: "user_1", workspaceId: "workspace_1", workspace };
    prisma.workspaceMember.findFirst.mockResolvedValue(membership);

    await expect(requireWorkspaceAccess("workspace_1")).resolves.toEqual({
      user: profile,
      membership,
      workspace,
    });

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
    const workspace = { id: "workspace_2", name: "First Workspace", status: "ACTIVE", slug: "first-workspace" };
    prisma.workspaceMember.findFirst.mockResolvedValue(null);
    prisma.workspace.findUnique.mockResolvedValue(null);
    prisma.workspace.create.mockResolvedValue(workspace);

    await expect(createWorkspaceForCurrentUser("First Workspace")).resolves.toEqual(workspace);

    expect(prisma.workspace.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "First Workspace",
        ownerId: "user_1",
        slug: expect.any(String),
        members: { create: { userId: "user_1", roleKey: "WORKSPACE_OWNER" } },
      }),
    });
  });

  it("applies the onboarding guard before rendering the dashboard shell", async () => {
    const { default: DashboardLayout } = await import("@/app/dashboard/layout");
    prisma.workspaceMember.findFirst.mockResolvedValue(null);

    await expect(DashboardLayout({ children: "dashboard" })).rejects.toThrow("NEXT_REDIRECT:/onboarding");
  });
});
