import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

export const joinProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  businessName: z.string().trim().min(2).max(160),
  businessType: z.string().trim().min(2).max(120),
  timezone: z.string().trim().min(1).max(80),
  country: z.string().trim().length(2).transform(value => value.toUpperCase()),
  intendedUse: z.string().trim().min(10).max(1000),
  agreementAccepted: z.literal("on"),
});

export async function saveJoinProfile(userId: string, input: unknown) {
  const profile = joinProfileSchema.parse(input);
  await prisma.$transaction([
    prisma.userProfile.update({ where: { id: userId }, data: { firstName: profile.firstName, lastName: profile.lastName } }),
    prisma.saasSubscriberProfile.upsert({
      where: { userId },
      create: { userId, subscriberType: "DIRECT_CUSTOMER", onboardingProgress: { joinProfile: profile, joinProfileComplete: true } },
      update: { subscriberType: "DIRECT_CUSTOMER", onboardingProgress: { joinProfile: profile, joinProfileComplete: true } },
    }),
  ]);
  return profile;
}

export function readJoinProfile(progress: unknown) {
  if (!progress || typeof progress !== "object" || Array.isArray(progress)) return null;
  const value = progress as Record<string, unknown>;
  return value.joinProfileComplete === true && value.joinProfile && typeof value.joinProfile === "object"
    ? value.joinProfile as Record<string, string>
    : null;
}
