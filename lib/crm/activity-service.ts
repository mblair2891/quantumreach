import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/rbac";
import { audit } from "@/lib/audit/service";
import { activityNoteSchema, activityTaskSchema, followUpSchema } from "@/lib/validation/schemas";
import type { RelatedType } from "@/lib/crm/service";

export async function listActivityTimeline(workspaceId: string, relatedType: RelatedType, relatedId: string) {
  await requireWorkspaceAccess(workspaceId);
  const where = { workspaceId, relatedType, relatedId };
  const [activities, notes, tasks, followUps] = await Promise.all([
    prisma.activity.findMany({ where, orderBy: { occurredAt: "desc" } }),
    prisma.note.findMany({ where, orderBy: { createdAt: "desc" } }),
    prisma.task.findMany({ where, orderBy: { createdAt: "desc" } }),
    prisma.followUp.findMany({ where, orderBy: { createdAt: "desc" } })
  ]);
  return [
    ...activities.map((item) => ({ id: item.id, kind: "activity" as const, title: item.title, description: item.description, status: null, occurredAt: item.occurredAt })),
    ...notes.map((item) => ({ id: item.id, kind: "note" as const, title: "Note", description: item.body, status: null, occurredAt: item.createdAt })),
    ...tasks.map((item) => ({ id: item.id, kind: "task" as const, title: item.title, description: item.description, status: item.status, occurredAt: item.createdAt })),
    ...followUps.map((item) => ({ id: item.id, kind: "follow-up" as const, title: item.title, description: item.dueAt ? `Due ${item.dueAt.toLocaleDateString()}` : null, status: item.status, occurredAt: item.createdAt }))
  ].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
}

export async function addNote(workspaceId: string, relatedType: RelatedType, relatedId: string, input: unknown) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const data = activityNoteSchema.parse(input);
  const note = await prisma.note.create({ data: { workspaceId, relatedType, relatedId, body: data.body, createdById: user.id } });
  await prisma.activity.create({ data: { workspaceId, relatedType, relatedId, type: "NOTE", title: "Note added", description: data.body.slice(0, 180), createdById: user.id } });
  await audit(workspaceId, "create", "Note", note.id, user.id, { relatedType, relatedId });
  return note;
}

export async function addTask(workspaceId: string, relatedType: RelatedType, relatedId: string, input: unknown) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const data = activityTaskSchema.parse(input);
  const task = await prisma.task.create({ data: { workspaceId, relatedType, relatedId, title: data.title, description: data.description || undefined, dueAt: data.dueAt ? new Date(data.dueAt) : undefined, priority: data.priority, createdById: user.id } });
  await prisma.activity.create({ data: { workspaceId, relatedType, relatedId, type: "TASK", title: "Task created", description: data.title, createdById: user.id } });
  await audit(workspaceId, "create", "Task", task.id, user.id, { relatedType, relatedId });
  return task;
}

export async function addFollowUp(workspaceId: string, relatedType: RelatedType, relatedId: string, input: unknown) {
  const { user } = await requireWorkspaceAccess(workspaceId);
  const data = followUpSchema.parse(input);
  const followUp = await prisma.followUp.create({ data: { workspaceId, relatedType, relatedId, title: data.title, dueAt: data.dueAt ? new Date(data.dueAt) : undefined, createdById: user.id } });
  await prisma.activity.create({ data: { workspaceId, relatedType, relatedId, type: "FOLLOW_UP", title: "Follow-up created", description: data.title, createdById: user.id } });
  await audit(workspaceId, "create", "FollowUp", followUp.id, user.id, { relatedType, relatedId });
  return followUp;
}
