import { randomBytes } from "crypto";
import { Prisma, type Workspace } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { slugify } from "@/lib/utils";

type WorkspaceSlugDb = {
  workspace: {
    findUnique: (args: {
      where: { slug: string };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
    create: (args: { data: Prisma.WorkspaceUncheckedCreateInput }) => Promise<Workspace>;
  };
};

/** Build a deterministic-then-entropic slug candidate (max 80 chars for safety). */
export function buildWorkspaceSlugCandidate(base: string, attempt: number): string {
  const root = (slugify(base) || "workspace").slice(0, 40);
  if (attempt <= 0) return root.slice(0, 80);
  const entropy = `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
  return `${root}-${entropy}`.slice(0, 80);
}

export function isWorkspaceSlugUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const target = error.meta?.target;
  if (Array.isArray(target)) return target.some((field) => String(field).toLowerCase().includes("slug"));
  if (typeof target === "string") return target.toLowerCase().includes("slug");
  // Some drivers omit target; treat any P2002 on workspace create as retryable for slug allocation.
  return true;
}

/**
 * Reserve a free workspace.slug by check-before-create candidates.
 * Always returns a slug that was free at check time; callers should still handle P2002 races.
 */
export async function allocateUniqueWorkspaceSlug(
  base: string,
  db: WorkspaceSlugDb = prisma as unknown as WorkspaceSlugDb,
): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const candidate = buildWorkspaceSlugCandidate(base, attempt);
    const existing = await db.workspace.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  return `ws-${randomBytes(12).toString("hex")}`;
}

/** Create a workspace, retrying with a new slug on unique constraint races. */
export async function createWorkspaceWithUniqueSlug(
  input: {
    name: string;
    slugBase: string;
    ownerId?: string | null;
    settings?: Prisma.InputJsonValue;
    members?: Prisma.WorkspaceUncheckedCreateInput["members"];
  },
  db: WorkspaceSlugDb = prisma as unknown as WorkspaceSlugDb,
): Promise<Workspace> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 8; attempt++) {
    const slug = await allocateUniqueWorkspaceSlug(
      attempt === 0 ? input.slugBase : `${input.slugBase}-r${attempt}`,
      db,
    );
    try {
      return await db.workspace.create({
        data: {
          name: input.name,
          slug,
          ownerId: input.ownerId ?? undefined,
          settings: input.settings ?? undefined,
          members: input.members,
        },
      });
    } catch (error) {
      lastError = error;
      if (isWorkspaceSlugUniqueViolation(error)) continue;
      throw error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Could not allocate a unique workspace slug.");
}

/** Rename a workspace slug so archived/deleted rows stop blocking reuse. */
export function freedWorkspaceSlug(workspaceId: string): string {
  return `deleted-${workspaceId}-${Date.now().toString(36)}`.slice(0, 80);
}
