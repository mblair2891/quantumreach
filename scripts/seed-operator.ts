/**
 * Create or link a Better Auth operator account + UserProfile.
 *
 * Usage:
 *   OPERATOR_EMAIL=you@example.com OPERATOR_PASSWORD='...' npm run seed:operator
 *   npm run seed:operator -- --email you@example.com --password '...'
 *
 * The email must appear in ADMIN_EMAILS (comma-separated).
 * Idempotent: existing users are linked; password is only updated with --update-password.
 */
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const prisma = new PrismaClient();

type Args = {
  email: string;
  password: string;
  name: string;
  username: string | null;
  updatePassword: boolean;
};

function parseArgs(argv: string[]): Args {
  const getFlag = (name: string) => {
    const idx = argv.indexOf(`--${name}`);
    if (idx === -1) return undefined;
    return argv[idx + 1];
  };

  const email = (getFlag("email") ?? process.env.OPERATOR_EMAIL ?? "").trim().toLowerCase();
  const password = getFlag("password") ?? process.env.OPERATOR_PASSWORD ?? "";
  const name =
    (getFlag("name") ?? process.env.OPERATOR_NAME ?? "Platform Operator").trim() || "Platform Operator";
  const rawUsername = (getFlag("username") ?? process.env.OPERATOR_USERNAME ?? "").trim().toLowerCase();
  const username = rawUsername || null;
  const updatePassword =
    argv.includes("--update-password") || process.env.OPERATOR_SEED_UPDATE_PASSWORD === "true";

  return { email, password, name, username, updatePassword };
}

function isValidUsername(username: string) {
  return /^[a-z0-9_]{3,32}$/.test(username);
}

function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "Operator",
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : null,
  };
}

function usageAndExit(message?: string): never {
  if (message) console.error(`Error: ${message}\n`);
  console.error(`Seed a Better Auth operator (email + password) and link UserProfile.

Required:
  --email / OPERATOR_EMAIL
  --password / OPERATOR_PASSWORD

Optional:
  --name / OPERATOR_NAME              (default: "Platform Operator")
  --username / OPERATOR_USERNAME      login handle (a-z, 0-9, underscore; 3-32 chars)
  --update-password                   update credential if user already exists
  OPERATOR_SEED_UPDATE_PASSWORD=true   same as --update-password

Also required:
  ADMIN_EMAILS must include the operator email
  DATABASE_URL (and Better Auth tables migrated)

Examples:
  OPERATOR_EMAIL=founder@example.com OPERATOR_PASSWORD='choose-a-strong-password' \\
    ADMIN_EMAILS=founder@example.com npm run seed:operator

  npm run seed:operator -- --email founder@example.com --password 'choose-a-strong-password' \\
    --name 'Founder Name' --username founder
`);
  process.exit(1);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.email) usageAndExit("Email is required (--email or OPERATOR_EMAIL).");
  if (!args.password) usageAndExit("Password is required (--password or OPERATOR_PASSWORD).");
  if (args.password.length < 8) usageAndExit("Password must be at least 8 characters.");
  if (args.username && !isValidUsername(args.username)) {
    usageAndExit("Username must be 3–32 characters: lowercase letters, numbers, underscores only.");
  }

  const allowlist = adminEmails();
  if (!allowlist.length) {
    usageAndExit("ADMIN_EMAILS is empty. Set it to a comma-separated list that includes the operator email.");
  }
  if (!allowlist.includes(args.email)) {
    usageAndExit(
      `Email ${args.email} is not in ADMIN_EMAILS. Current allowlist: ${allowlist.join(", ")}`,
    );
  }

  if (args.username) {
    const taken = await prisma.user.findFirst({
      where: { username: args.username, NOT: { email: args.email } },
      select: { id: true },
    });
    if (taken) usageAndExit(`Username "${args.username}" is already taken by another account.`);
  }

  const { firstName, lastName } = splitName(args.name);
  const now = new Date();
  let createdAuthUser = false;
  let updatedCredential = false;

  let authUser = await prisma.user.findUnique({ where: { email: args.email } });
  if (!authUser) {
    const id = randomUUID();
    authUser = await prisma.user.create({
      data: {
        id,
        name: args.name,
        email: args.email,
        emailVerified: true,
        username: args.username,
        displayUsername: args.username,
        createdAt: now,
        updatedAt: now,
      },
    });
    createdAuthUser = true;
  } else if (args.username && authUser.username !== args.username) {
    authUser = await prisma.user.update({
      where: { id: authUser.id },
      data: { username: args.username, displayUsername: args.username, updatedAt: now },
    });
  }

  const credential = await prisma.account.findFirst({
    where: { userId: authUser.id, providerId: "credential" },
  });
  const passwordHash = await hashPassword(args.password);

  if (!credential) {
    await prisma.account.create({
      data: {
        id: randomUUID(),
        accountId: authUser.id,
        providerId: "credential",
        userId: authUser.id,
        password: passwordHash,
        createdAt: now,
        updatedAt: now,
      },
    });
    updatedCredential = true;
  } else if (args.updatePassword) {
    await prisma.account.update({
      where: { id: credential.id },
      data: { password: passwordHash, updatedAt: now },
    });
    updatedCredential = true;
  }

  if (authUser.name !== args.name) {
    await prisma.user.update({
      where: { id: authUser.id },
      data: { name: args.name, updatedAt: now },
    });
  }

  let profile = await prisma.userProfile.findUnique({ where: { authUserId: authUser.id } });
  if (!profile) {
    profile = await prisma.userProfile.findUnique({ where: { email: args.email } });
  }

  if (profile) {
    profile = await prisma.userProfile.update({
      where: { id: profile.id },
      data: {
        authUserId: authUser.id,
        email: args.email,
        firstName: firstName ?? profile.firstName,
        lastName: lastName ?? profile.lastName,
      },
    });
  } else {
    profile = await prisma.userProfile.create({
      data: {
        authUserId: authUser.id,
        email: args.email,
        firstName,
        lastName,
      },
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        email: args.email,
        username: authUser.username,
        authUserId: authUser.id,
        userProfileId: profile.id,
        createdAuthUser,
        credentialCreatedOrUpdated: updatedCredential,
        passwordUpdated: Boolean(credential && args.updatePassword),
        operatorAllowlisted: true,
        signInPath: "/sign-in",
        notes: [
          createdAuthUser
            ? "Created new Better Auth user + credential."
            : credential
              ? args.updatePassword
                ? "Existing user; password updated."
                : "Existing user; password left unchanged (pass --update-password to rotate)."
              : "Existing user; credential account created.",
          "Sign in at /sign-in with email or username + password.",
          "Operators land on /platform after login.",
          "Ensure ADMIN_EMAILS includes this email in the running app environment.",
        ],
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
