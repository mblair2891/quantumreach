import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import {
  allocateUniqueWorkspaceSlug,
  buildWorkspaceSlugCandidate,
  createWorkspaceWithUniqueSlug,
  freedWorkspaceSlug,
  isWorkspaceSlugUniqueViolation,
} from "@/lib/workspaces/slug";

describe("workspace slug allocation", () => {
  it("slugifies the base candidate on first attempt", () => {
    expect(buildWorkspaceSlugCandidate("Acme Advisory!", 0)).toBe("acme-advisory");
  });

  it("adds entropy on later attempts", () => {
    const second = buildWorkspaceSlugCandidate("Acme Advisory", 1);
    expect(second.startsWith("acme-advisory-")).toBe(true);
    expect(second.length).toBeGreaterThan("acme-advisory-".length);
  });

  it("frees deleted workspace slugs with a stable prefix", () => {
    expect(freedWorkspaceSlug("clxyz123")).toMatch(/^deleted-clxyz123-/);
  });

  it("classifies Prisma slug unique violations", () => {
    const error = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
      meta: { target: ["slug"] },
    });
    expect(isWorkspaceSlugUniqueViolation(error)).toBe(true);
    expect(isWorkspaceSlugUniqueViolation(new Error("nope"))).toBe(false);
  });

  it("skips existing slugs when allocating", async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce({ id: "existing" })
      .mockResolvedValueOnce(null);
    const db = { workspace: { findUnique, create: vi.fn() } };

    const slug = await allocateUniqueWorkspaceSlug("subscriber-user1", db as never);
    expect(slug).not.toBe("subscriber-user1");
    expect(slug.startsWith("subscriber-user1")).toBe(true);
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it("retries createWorkspaceWithUniqueSlug on P2002 races", async () => {
    const uniqueError = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
      meta: { target: ["slug"] },
    });
    const create = vi
      .fn()
      .mockRejectedValueOnce(uniqueError)
      .mockResolvedValueOnce({ id: "ws_ok", name: "Acme", slug: "acme-retry", ownerId: "u1" });
    const findUnique = vi.fn().mockResolvedValue(null);
    const db = { workspace: { findUnique, create } };

    const workspace = await createWorkspaceWithUniqueSlug(
      { name: "Acme", slugBase: "subscriber-u1", ownerId: "u1" },
      db as never,
    );

    expect(workspace.id).toBe("ws_ok");
    expect(create).toHaveBeenCalledTimes(2);
  });
});
