import { randomUUID, timingSafeEqual } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/db/prisma";

export type OperatorBootstrapEnvironment = {
  VERCEL_ENV?: string;
  NODE_ENV?: string;
  BOOTSTRAP_SECRET?: string;
  ADMIN_EMAILS?: string;
};

function resolveAllowlist(env: OperatorBootstrapEnvironment = process.env) {
  return (env.ADMIN_EMAILS ?? process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function resolveBootstrapSecret(env: OperatorBootstrapEnvironment = process.env) {
  return (env.BOOTSTRAP_SECRET ?? process.env.BOOTSTRAP_SECRET ?? "").trim();
}

/** Preview/local only — never production. Fail closed when VERCEL_ENV is production. */
export function isOperatorBootstrapEnvironment(
  env: OperatorBootstrapEnvironment = process.env,
): boolean {
  if (env.VERCEL_ENV === "production") return false;
  return env.VERCEL_ENV === "preview" || env.NODE_ENV === "development";
}

export function assertOperatorBootstrapEnvironment(
  env: OperatorBootstrapEnvironment = process.env,
): void {
  if (!isOperatorBootstrapEnvironment(env)) {
    throw new Error("Operator bootstrap is unavailable in this environment.");
  }
}

export function isValidBootstrapUsername(username: string) {
  return /^[a-z0-9_]{3,32}$/.test(username);
}

function secureEquals(provided: string, expected: string) {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Auth users whose email is on ADMIN_EMAILS (treatable as platform operators). */
export async function countAllowlistedOperators(
  env: OperatorBootstrapEnvironment = process.env,
  db: typeof prisma = prisma,
) {
  const emails = resolveAllowlist(env);
  if (!emails.length) return 0;
  return db.user.count({ where: { email: { in: emails } } });
}

export type OperatorBootstrapGate = {
  available: boolean;
  environmentAllowed: boolean;
  adminEmailsConfigured: boolean;
  operatorsExist: boolean;
  requiresBootstrapSecret: boolean;
  bootstrapSecretConfigured: boolean;
  blockedReason: string | null;
};

export async function getOperatorBootstrapGate(
  env: OperatorBootstrapEnvironment = process.env,
  db: typeof prisma = prisma,
): Promise<OperatorBootstrapGate> {
  const environmentAllowed = isOperatorBootstrapEnvironment(env);
  const allowlist = resolveAllowlist(env);
  const adminEmailsConfigured = allowlist.length > 0;
  const operatorsExist = adminEmailsConfigured
    ? (await db.user.count({ where: { email: { in: allowlist } } })) > 0
    : false;
  const bootstrapSecretConfigured = Boolean(resolveBootstrapSecret(env));
  const requiresBootstrapSecret = operatorsExist;

  let blockedReason: string | null = null;
  if (!environmentAllowed) {
    blockedReason = "Operator bootstrap is only available on Preview and local development.";
  } else if (!adminEmailsConfigured) {
    blockedReason =
      "ADMIN_EMAILS is not configured. Add the operator email to ADMIN_EMAILS in the deployment environment, then redeploy.";
  } else if (operatorsExist && !bootstrapSecretConfigured) {
    blockedReason =
      "An operator account already exists. To create another, set BOOTSTRAP_SECRET in the environment and enter it on this form, or use npm run seed:operator locally.";
  }

  const available =
    environmentAllowed && adminEmailsConfigured && !(operatorsExist && !bootstrapSecretConfigured);

  return {
    available,
    environmentAllowed,
    adminEmailsConfigured,
    operatorsExist,
    requiresBootstrapSecret,
    bootstrapSecretConfigured,
    blockedReason,
  };
}

export type BootstrapOperatorInput = {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  bootstrapSecret?: string | null;
  name?: string | null;
};

export type BootstrapOperatorResult = {
  email: string;
  username: string;
  authUserId: string;
  userProfileId: string;
  createdAuthUser: boolean;
};

/**
 * Create the first (or secret-gated additional) platform operator:
 * Better Auth user + credential account + UserProfile.
 * Email must be on ADMIN_EMAILS so /platform treats them as operator after sign-in.
 */
export async function bootstrapOperator(
  input: BootstrapOperatorInput,
  env: OperatorBootstrapEnvironment = process.env,
  db: typeof prisma = prisma,
): Promise<BootstrapOperatorResult> {
  assertOperatorBootstrapEnvironment(env);

  const email = input.email.trim().toLowerCase();
  const username = input.username.trim().toLowerCase();
  const password = input.password;
  const confirmPassword = input.confirmPassword;
  const name =
    (input.name ?? "").trim() ||
    (username ? username : email.split("@")[0] || "Platform Operator");

  if (!email || !email.includes("@")) {
    throw new Error("A valid email address is required.");
  }
  if (!username || !isValidBootstrapUsername(username)) {
    throw new Error("Username must be 3–32 characters: lowercase letters, numbers, underscores only.");
  }
  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  if (password !== confirmPassword) {
    throw new Error("Passwords do not match.");
  }

  const allowlist = resolveAllowlist(env);
  if (!allowlist.length) {
    throw new Error(
      "ADMIN_EMAILS is not configured. Add the operator email to ADMIN_EMAILS, then retry.",
    );
  }
  if (!allowlist.includes(email)) {
    throw new Error(
      "This email is not on the operator allowlist (ADMIN_EMAILS). Add it to the environment and redeploy before bootstrapping.",
    );
  }

  const existingOperators = await db.user.count({ where: { email: { in: allowlist } } });
  if (existingOperators > 0) {
    const expected = resolveBootstrapSecret(env);
    if (!expected) {
      throw new Error(
        "An operator already exists. Set BOOTSTRAP_SECRET in the environment to authorize another bootstrap.",
      );
    }
    const provided = (input.bootstrapSecret ?? "").trim();
    if (!provided || !secureEquals(provided, expected)) {
      throw new Error("Invalid bootstrap secret.");
    }
  }

  const existingEmail = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existingEmail) {
    throw new Error("An account with this email already exists. Sign in instead.");
  }

  const existingUsername = await db.user.findUnique({ where: { username }, select: { id: true } });
  if (existingUsername) {
    throw new Error("That username is already taken.");
  }

  const existingProfile = await db.userProfile.findUnique({
    where: { email },
    select: { id: true, authUserId: true },
  });
  if (existingProfile?.authUserId) {
    throw new Error("An account with this email already exists. Sign in instead.");
  }

  const now = new Date();
  const authUserId = randomUUID();
  const passwordHash = await hashPassword(password);
  const nameParts = name.trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] ?? "Operator";
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;

  await db.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        id: authUserId,
        name,
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

  const profile = existingProfile
    ? await db.userProfile.update({
        where: { id: existingProfile.id },
        data: {
          authUserId,
          firstName,
          lastName,
        },
      })
    : await db.userProfile.create({
        data: {
          authUserId,
          email,
          firstName,
          lastName,
        },
      });

  return {
    email,
    username,
    authUserId,
    userProfileId: profile.id,
    createdAuthUser: true,
  };
}
