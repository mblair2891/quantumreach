import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { ACCOUNT_SETUP_TOKEN_TTL_HOURS } from "@/lib/auth/constants";
import { generateRawSetupToken, hashSetupToken } from "@/lib/auth/setup-token-crypto";
import { hashPassword } from "better-auth/crypto";
import { ensureUserProfileForAuthUser } from "@/lib/auth/rbac";
import { fulfillCustomerOrder } from "@/lib/customer-journey/service";
import { lockAffiliateAttribution } from "@/lib/affiliates/service";

export { generateRawSetupToken, hashSetupToken } from "@/lib/auth/setup-token-crypto";

export type AccountSetupTokenIssue = {
  tokenId: string;
  rawToken: string;
  setupUrl: string;
  expiresAt: Date;
  email: string;
  emailDelivery: "DEFERRED_PREVIEW_LINK" | "RECORDED_INTENT";
};

function appBaseUrl() {
  const base = (process.env.APP_BASE_URL || process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return base;
}

/** Issue a single-use setup token for a paid order. Invalidates prior unused tokens for the same order. */
export async function issueAccountSetupToken(orderId: string): Promise<AccountSetupTokenIssue> {
  const order = await prisma.customerOrder.findUniqueOrThrow({ where: { id: orderId } });
  if (order.paymentStatus !== "PAID") throw new Error("Account setup is only available after payment is verified.");
  const email = (order.purchaserEmail ?? "").trim().toLowerCase();
  if (!email) throw new Error("Purchaser email is required for account setup.");
  if (order.userId) throw new Error("This order is already linked to an account.");

  const rawToken = generateRawSetupToken();
  const tokenHash = hashSetupToken(rawToken);
  const expiresAt = new Date(Date.now() + ACCOUNT_SETUP_TOKEN_TTL_HOURS * 60 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.accountSetupToken.updateMany({
      where: { customerOrderId: orderId, usedAt: null },
      data: { usedAt: new Date() },
    });
    await tx.accountSetupToken.create({
      data: { customerOrderId: orderId, email, tokenHash, expiresAt },
    });
  });

  const token = await prisma.accountSetupToken.findUniqueOrThrow({ where: { tokenHash } });
  const setupUrl = `${appBaseUrl()}/setup/account?token=${encodeURIComponent(rawToken)}`;
  return {
    tokenId: token.id,
    rawToken,
    setupUrl,
    expiresAt,
    email,
    emailDelivery: process.env.EMAIL_SENDING_ENABLED === "true" ? "RECORDED_INTENT" : "DEFERRED_PREVIEW_LINK",
  };
}

export async function getActiveSetupTokenByRaw(rawToken: string) {
  const tokenHash = hashSetupToken(rawToken);
  const record = await prisma.accountSetupToken.findUnique({
    where: { tokenHash },
    include: { order: { include: { items: true } } },
  });
  if (!record) return { ok: false as const, reason: "INVALID" as const };
  if (record.usedAt) return { ok: false as const, reason: "USED" as const };
  if (record.expiresAt.getTime() <= Date.now()) return { ok: false as const, reason: "EXPIRED" as const };
  if (record.order.paymentStatus !== "PAID") return { ok: false as const, reason: "UNPAID" as const };
  if (record.order.userId) return { ok: false as const, reason: "ALREADY_CLAIMED" as const };
  return { ok: true as const, record };
}

export type CompleteAccountSetupInput = {
  rawToken: string;
  password: string;
  firstName: string;
  lastName: string;
  username?: string | null;
};

/**
 * Completes pay-first account setup: Better Auth user + profile + claim order + fulfill.
 * Idempotent against concurrent reuse via usedAt claim.
 */
export async function completeAccountSetup(input: CompleteAccountSetupInput) {
  const password = input.password;
  if (!password || password.length < 8) throw new Error("Password must be at least 8 characters.");
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!firstName || !lastName) throw new Error("First and last name are required.");

  const resolved = await getActiveSetupTokenByRaw(input.rawToken);
  if (!resolved.ok) throw new Error(`SETUP_TOKEN_${resolved.reason}`);

  const { record } = resolved;
  const email = record.email.toLowerCase();
  const username = input.username?.trim().toLowerCase() || null;
  if (username && !/^[a-z0-9_]{3,32}$/.test(username)) {
    throw new Error("Username must be 3–32 characters: letters, numbers, underscores.");
  }

  // Atomic claim of the token before creating auth credentials.
  const claim = await prisma.accountSetupToken.updateMany({
    where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (claim.count !== 1) throw new Error("SETUP_TOKEN_USED");

  const existingAuth = await prisma.user.findUnique({ where: { email } });
  if (existingAuth) {
    // Allow linking existing BA user if they own the email — still need password verified? Safer: reject if email already has BA account.
    // For pay-first private beta: reject and ask to sign in, then claim via support path.
    // Actually if they already have account, we should claim order to them after sign-in. Phase 3: create only if new.
    await prisma.accountSetupToken.update({ where: { id: record.id }, data: { usedAt: null } }).catch(() => undefined);
    throw new Error("An account with this email already exists. Sign in instead.");
  }

  if (username) {
    const taken = await prisma.user.findUnique({ where: { username } });
    if (taken) {
      await prisma.accountSetupToken.update({ where: { id: record.id }, data: { usedAt: null } }).catch(() => undefined);
      throw new Error("That username is already taken.");
    }
  }

  const now = new Date();
  const authUserId = randomUUID();
  const passwordHash = await hashPassword(password);
  const displayName = `${firstName} ${lastName}`.trim();

  await prisma.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        id: authUserId,
        name: displayName,
        email,
        emailVerified: true,
        username,
        displayUsername: username,
        createdAt: now,
        updatedAt: now,
      },
    });
    await tx.account.create({
      data: {
        id: randomUUID(),
        accountId: authUserId,
        providerId: "credential",
        userId: authUserId,
        password: passwordHash,
        createdAt: now,
        updatedAt: now,
      },
    });
  });

  const profile = await ensureUserProfileForAuthUser({
    id: authUserId,
    email,
    name: displayName,
    image: null,
  });

  // Apply purchaser business profile onto SaaS subscriber progress for fulfillment.
  await prisma.saasSubscriberProfile.upsert({
    where: { userId: profile.id },
    create: {
      userId: profile.id,
      subscriberType: "DIRECT_CUSTOMER",
      onboardingProgress: {
        joinProfileComplete: true,
        joinProfile: {
          firstName,
          lastName,
          businessName: record.order.businessName ?? `${firstName} ${lastName}`.trim(),
          businessType: record.order.businessType ?? "Business",
          timezone: record.order.timezone ?? "America/New_York",
          country: record.order.country ?? "US",
          intendedUse: record.order.intendedUse ?? "Quantum Reach subscription",
          agreementAccepted: "on",
        },
      },
    },
    update: {
      onboardingProgress: {
        joinProfileComplete: true,
        joinProfile: {
          firstName,
          lastName,
          businessName: record.order.businessName ?? `${firstName} ${lastName}`.trim(),
          businessType: record.order.businessType ?? "Business",
          timezone: record.order.timezone ?? "America/New_York",
          country: record.order.country ?? "US",
          intendedUse: record.order.intendedUse ?? "Quantum Reach subscription",
          agreementAccepted: "on",
        },
      },
    },
  });

  await prisma.userProfile.update({
    where: { id: profile.id },
    data: { firstName, lastName },
  });

  await prisma.customerOrder.update({
    where: { id: record.customerOrderId },
    data: { userId: profile.id },
  });

  if (record.order.acquisitionSessionId) {
    await prisma.acquisitionSession.update({
      where: { id: record.order.acquisitionSessionId },
      data: { userId: profile.id },
    }).catch(() => undefined);
    try {
      await prisma.$transaction(async (tx) => {
        await lockAffiliateAttribution({
          acquisitionSessionId: record.order.acquisitionSessionId!,
          orderId: record.customerOrderId,
          customerUserId: profile.id,
        }, tx);
      });
    } catch {
      // Attribution may already be locked or absent.
    }
  }

  const workspace = await fulfillCustomerOrder(record.customerOrderId);
  return { profile, workspace, authUserId, email };
}
