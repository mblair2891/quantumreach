import "server-only";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { ACCOUNT_SETUP_TOKEN_TTL_HOURS } from "@/lib/auth/constants";

export type TransactionalSendResult =
  | { sent: true; messageId: string }
  | { sent: false; reason: string };

export type AccountSetupEmailInput = {
  to: string;
  setupUrl: string;
  expiresAt: Date;
  orderId: string;
};

const SUBJECT = "Set up your Quantum Reach account";

export function getTransactionalEmailConfig() {
  const enabled = process.env.EMAIL_SENDING_ENABLED === "true";
  const region = process.env.AWS_SES_REGION?.trim() ?? "";
  const accessKeyId = process.env.AWS_SES_ACCESS_KEY_ID?.trim() ?? "";
  const secretAccessKey = process.env.AWS_SES_SECRET_ACCESS_KEY?.trim() ?? "";
  const fromDomain = process.env.DEFAULT_FROM_DOMAIN?.trim() ?? "";
  const from = process.env.TRANSACTIONAL_FROM_EMAIL?.trim() || (fromDomain ? `noreply@${fromDomain}` : "");
  const replyTo = process.env.TRANSACTIONAL_REPLY_TO?.trim() || "support@quantumreach.app";
  const configured = Boolean(region && accessKeyId && secretAccessKey);
  return { enabled, configured, region, from, replyTo };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function redactSecrets(value: string) {
  return value
    .replace(/token=[^&\s]+/gi, "token=redacted")
    .replace(/AKIA[0-9A-Z]{16}/g, "AKIAREDACTED")
    .slice(0, 300);
}

function safeReason(error: unknown) {
  if (error instanceof Error && error.message) return redactSecrets(error.message);
  return "SES_SEND_FAILED";
}

function accountSetupCopy(input: AccountSetupEmailInput) {
  void input.expiresAt;
  const ttl = ACCOUNT_SETUP_TOKEN_TTL_HOURS;
  const text = [
    "Your Quantum Reach payment is confirmed. Create your password to activate your workspace.",
    "",
    input.setupUrl,
    "",
    `This link expires in about ${ttl} hours and can be used once.`,
    `Order id (for support): ${input.orderId}`,
    "",
    "If you didn't make this purchase, ignore this email.",
    "",
    "— Quantum Reach",
  ].join("\n");
  const href = escapeHtml(input.setupUrl);
  const orderId = escapeHtml(input.orderId);
  const html = [
    "<!DOCTYPE html><html><body>",
    "<p>Your Quantum Reach payment is confirmed. Create your password to activate your workspace.</p>",
    `<p><a href="${href}">Set up your account</a></p>`,
    `<p>This link expires in about ${ttl} hours and can be used once.</p>`,
    `<p>Order id (for support): ${orderId}</p>`,
    "<p>If you didn't make this purchase, ignore this email.</p>",
    "</body></html>",
  ].join("");
  return { text, html };
}

/** System mail (account setup). Does not use workspace managed-domain or warmup send gates. */
export async function sendAccountSetupEmail(input: AccountSetupEmailInput): Promise<TransactionalSendResult> {
  const config = getTransactionalEmailConfig();
  if (!config.enabled) return { sent: false, reason: "EMAIL_SENDING_DISABLED" };
  if (!config.configured) return { sent: false, reason: "AWS_SES_NOT_CONFIGURED" };
  if (!config.from) return { sent: false, reason: "FROM_ADDRESS_MISSING" };

  const to = input.to.trim().toLowerCase();
  if (!to) return { sent: false, reason: "RECIPIENT_MISSING" };

  const { text, html } = accountSetupCopy(input);
  const client = new SESClient({
    region: config.region,
    credentials: {
      accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID!.trim(),
      secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY!.trim(),
    },
  });

  try {
    const response = await client.send(
      new SendEmailCommand({
        Source: config.from,
        Destination: { ToAddresses: [to] },
        ReplyToAddresses: config.replyTo ? [config.replyTo] : undefined,
        Message: {
          Subject: { Data: SUBJECT, Charset: "UTF-8" },
          Body: {
            Text: { Data: text, Charset: "UTF-8" },
            Html: { Data: html, Charset: "UTF-8" },
          },
        },
      }),
    );
    const messageId = response.MessageId?.trim();
    if (!messageId) return { sent: false, reason: "SES_MESSAGE_ID_MISSING" };
    return { sent: true, messageId };
  } catch (error) {
    return { sent: false, reason: safeReason(error) };
  }
}

export const ACCOUNT_SETUP_EMAIL_SUBJECT = SUBJECT;
