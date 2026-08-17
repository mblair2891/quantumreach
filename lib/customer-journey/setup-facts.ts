import { prisma } from "@/lib/db/prisma";
import { readJoinProfile } from "./profile";
import { subscriberSetupFactsFromRecords, type SubscriberSetupFacts } from "./subscriber-copy";

export async function loadSubscriberSetupFacts(userId: string, workspaceId?: string | null): Promise<SubscriberSetupFacts> {
  const subscriber = await prisma.saasSubscriberProfile.findUnique({ where: { userId } });
  const progress =
    subscriber?.onboardingProgress && typeof subscriber.onboardingProgress === "object" && !Array.isArray(subscriber.onboardingProgress)
      ? (subscriber.onboardingProgress as Record<string, unknown>)
      : {};
  const profileComplete = Boolean(readJoinProfile(progress)) || progress.onboardingComplete === true;
  if (!workspaceId) return subscriberSetupFactsFromRecords({ profileComplete, domains: [], mailboxCount: 0 });

  const [domains, mailboxCount] = await Promise.all([
    prisma.managedDomain.findMany({
      where: { OR: [{ workspaceId }, { assignments: { some: { workspaceId, status: "ACTIVE" } } }] },
      include: { sesIdentity: true },
    }),
    prisma.managedMailbox.count({ where: { workspaceId } }),
  ]);
  return subscriberSetupFactsFromRecords({ profileComplete, domains, mailboxCount });
}

export async function markRequiredSetupComplete(userId: string, workspaceId: string) {
  const subscriber = await prisma.saasSubscriberProfile.findUnique({ where: { userId } });
  const progress =
    subscriber?.onboardingProgress && typeof subscriber.onboardingProgress === "object" && !Array.isArray(subscriber.onboardingProgress)
      ? (subscriber.onboardingProgress as Record<string, unknown>)
      : {};
  await prisma.saasSubscriberProfile.upsert({
    where: { userId },
    create: {
      userId,
      workspaceId,
      subscriberType: "DIRECT_CUSTOMER",
      onboardingProgress: { ...progress, onboardingComplete: true, completedAt: new Date().toISOString() },
    },
    update: {
      workspaceId,
      onboardingProgress: { ...progress, onboardingComplete: true, completedAt: new Date().toISOString() },
    },
  });
}
