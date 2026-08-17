import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  confirmationSetupInvitePresentation,
  parseAccountSetupEmailDelivery,
} from "@/lib/auth/account-setup";

const sendMock = vi.hoisted(() => vi.fn());
const prisma = vi.hoisted(() => ({
  customerOrder: { findUniqueOrThrow: vi.fn() },
  accountSetupToken: {
    findUniqueOrThrow: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@aws-sdk/client-ses", () => {
  class SendEmailCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  class SESClient {
    send = sendMock;
  }
  return { SESClient, SendEmailCommand };
});
vi.mock("@/lib/db/prisma", () => ({ prisma }));

const source = (path: string) => readFileSync(path, "utf8");

const envKeys = [
  "EMAIL_SENDING_ENABLED",
  "AWS_SES_REGION",
  "AWS_SES_ACCESS_KEY_ID",
  "AWS_SES_SECRET_ACCESS_KEY",
  "TRANSACTIONAL_FROM_EMAIL",
  "TRANSACTIONAL_REPLY_TO",
  "DEFAULT_FROM_DOMAIN",
  "APP_BASE_URL",
] as const;

const priorEnv = new Map<string, string | undefined>();

function snapshotEnv() {
  for (const key of envKeys) priorEnv.set(key, process.env[key]);
}

function restoreEnv() {
  for (const key of envKeys) {
    const value = priorEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function enableSesEnv() {
  process.env.EMAIL_SENDING_ENABLED = "true";
  process.env.AWS_SES_REGION = "us-east-2";
  process.env.AWS_SES_ACCESS_KEY_ID = "test-key";
  process.env.AWS_SES_SECRET_ACCESS_KEY = "test-secret";
  process.env.TRANSACTIONAL_FROM_EMAIL = "noreply@quantumreach.app";
  process.env.TRANSACTIONAL_REPLY_TO = "support@quantumreach.app";
  process.env.APP_BASE_URL = "https://preview.example";
}

describe("account setup transactional email", () => {
  beforeEach(() => {
    snapshotEnv();
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation(async (work: (tx: typeof prisma) => Promise<unknown>) => work(prisma));
    prisma.customerOrder.findUniqueOrThrow.mockResolvedValue({
      id: "order_1",
      paymentStatus: "PAID",
      purchaserEmail: "Buyer@Example.com",
      userId: null,
    });
    prisma.accountSetupToken.findUniqueOrThrow.mockResolvedValue({ id: "tok_1" });
    sendMock.mockResolvedValue({ MessageId: "010001ses" });
  });

  afterEach(() => {
    restoreEnv();
  });

  it("sends from token issue when email sending is enabled", async () => {
    enableSesEnv();
    const { issueAccountSetupToken } = await import("@/lib/auth/account-setup");
    const issued = await issueAccountSetupToken("order_1");
    expect(issued.emailDelivery).toBe("SENT");
    expect(sendMock).toHaveBeenCalledTimes(1);
    const command = sendMock.mock.calls[0][0] as { input: { Destination: { ToAddresses: string[] }; Message: { Body: { Text: { Data: string } } } } };
    expect(command.input.Destination.ToAddresses).toEqual(["buyer@example.com"]);
    expect(command.input.Message.Body.Text.Data).toContain("/setup/account?token=");
    expect(issued.setupUrl).toContain("/setup/account?token=");
    expect(issued.rawToken.length).toBeGreaterThan(20);
  });

  it("skips send and marks DEFERRED_PREVIEW_LINK when sending is disabled", async () => {
    process.env.EMAIL_SENDING_ENABLED = "false";
    const { issueAccountSetupToken } = await import("@/lib/auth/account-setup");
    const issued = await issueAccountSetupToken("order_1");
    expect(issued.emailDelivery).toBe("DEFERRED_PREVIEW_LINK");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("marks FAILED when sending is enabled but SES returns an error", async () => {
    enableSesEnv();
    sendMock.mockRejectedValue(new Error("MessageRejected"));
    const { issueAccountSetupToken } = await import("@/lib/auth/account-setup");
    const issued = await issueAccountSetupToken("order_1");
    expect(issued.emailDelivery).toBe("FAILED");
    expect(sendMock).toHaveBeenCalledTimes(1);
  });
});

describe("sendAccountSetupEmail SES payload", () => {
  beforeEach(() => {
    snapshotEnv();
    vi.clearAllMocks();
    sendMock.mockResolvedValue({ MessageId: "010001ses" });
  });

  afterEach(() => {
    restoreEnv();
  });

  it("posts to / subject / body containing the setup path", async () => {
    enableSesEnv();
    const { sendAccountSetupEmail, ACCOUNT_SETUP_EMAIL_SUBJECT } = await import("@/lib/email/transactional");
    const setupUrl = "https://preview.example/setup/account?token=abc123token";
    const result = await sendAccountSetupEmail({
      to: "buyer@example.com",
      setupUrl,
      expiresAt: new Date("2026-08-18T00:00:00.000Z"),
      orderId: "order_1",
    });
    expect(result).toEqual({ sent: true, messageId: "010001ses" });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const command = sendMock.mock.calls[0][0] as { input: Record<string, unknown> };
    const input = command.input;
    expect(input.Source).toBe("noreply@quantumreach.app");
    expect(input.Destination).toEqual({ ToAddresses: ["buyer@example.com"] });
    expect(input.ReplyToAddresses).toEqual(["support@quantumreach.app"]);
    const message = input.Message as {
      Subject: { Data: string };
      Body: { Text: { Data: string }; Html: { Data: string } };
    };
    expect(message.Subject.Data).toBe(ACCOUNT_SETUP_EMAIL_SUBJECT);
    expect(message.Body.Text.Data).toContain("/setup/account?token=");
    expect(message.Body.Text.Data).toContain(setupUrl);
    expect(message.Body.Text.Data).toContain("order_1");
    expect(message.Body.Text.Data).toContain("If you didn't make this purchase, ignore this email.");
    expect(message.Body.Html.Data).toContain("/setup/account?token=");
    expect(message.Body.Html.Data).toContain("Set up your account");
  });

  it("does not call SES when sending is disabled", async () => {
    process.env.EMAIL_SENDING_ENABLED = "false";
    const { sendAccountSetupEmail: send } = await import("@/lib/email/transactional");
    await expect(
      send({
        to: "buyer@example.com",
        setupUrl: "https://preview.example/setup/account?token=abc",
        expiresAt: new Date(),
        orderId: "order_1",
      }),
    ).resolves.toEqual({ sent: false, reason: "EMAIL_SENDING_DISABLED" });
    expect(sendMock).not.toHaveBeenCalled();
  });
});

describe("confirmation setup invite presentation", () => {
  it("hides the setup URL when email was sent", () => {
    expect(confirmationSetupInvitePresentation("SENT")).toEqual({
      showCheckEmail: true,
      showOnPageSetupLink: false,
    });
  });

  it("shows the on-page setup link for deferred or failed delivery", () => {
    expect(confirmationSetupInvitePresentation("DEFERRED_PREVIEW_LINK")).toEqual({
      showCheckEmail: false,
      showOnPageSetupLink: true,
    });
    expect(confirmationSetupInvitePresentation("FAILED")).toEqual({
      showCheckEmail: false,
      showOnPageSetupLink: true,
    });
    expect(parseAccountSetupEmailDelivery("RECORDED_INTENT")).toBeNull();
  });

  it("wires SENT vs DEFERRED confirmation copy", () => {
    const page = source("app/setup/confirmation/page.tsx");
    const actions = source("app/setup/confirmation/actions.ts");
    const accountSetup = source("lib/auth/account-setup.ts");
    const transactional = source("lib/email/transactional.ts");
    expect(page).toContain("Check");
    expect(page).toContain("for your secure setup link");
    expect(page).toContain("showCheckEmail");
    expect(page).toContain("showSetupLink");
    expect(page).toContain("Resend setup email");
    expect(page).not.toContain("RECORDED_INTENT");
    expect(actions).toContain("resendAccountSetupEmailAction");
    expect(actions).toContain("emailDelivery");
    expect(accountSetup).toContain("sendAccountSetupEmail");
    expect(accountSetup).toContain('"SENT"');
    expect(accountSetup).not.toContain("RECORDED_INTENT");
    expect(accountSetup).not.toContain("queueOrSendEmail");
    expect(transactional).toContain("@aws-sdk/client-ses");
    expect(transactional).toContain("sendAccountSetupEmail");
    expect(transactional).not.toContain("lib/revenue-os/email");
  });
});
