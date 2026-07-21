import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireSubscriberWorkspaceAccess } from "./access";
import { getWorkspaceEffectiveEntitlements } from "@/lib/sending-infrastructure/operational";
export async function requirePartnerAccess() { const ctx = await requireSubscriberWorkspaceAccess(); if (process.env.AFFILIATE_ENABLED !== "true") redirect("/dashboard?partner=disabled"); const account = await prisma.affiliateAccount.findFirst({ where: { subscriberUserId: ctx.user.id, workspaceId: ctx.workspace.id, status: "ACTIVE" } }); if (!account) redirect("/dashboard?partner=not-eligible"); return { ...ctx, account }; }
export async function requireWhiteLabelAccess() { const ctx = await requireSubscriberWorkspaceAccess(); if (process.env.WHITE_LABEL_ENABLED !== "true") redirect("/dashboard?white-label=disabled"); const { effective } = await getWorkspaceEffectiveEntitlements(ctx.workspace.id); if (!effective.WHITE_LABEL_ENABLED) redirect("/dashboard?white-label=upgrade"); return ctx; }
