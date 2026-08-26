import "server-only";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { ACCOUNT_SETUP_TOKEN_TTL_HOURS } from "@/lib/auth/constants";
import { sendViaSmtp } from "@/lib/email/smtp-transport";

export type TransactionalSendResult =
  | { sent: true; messageId: string }
  | { sent: false; reason: string };

export type AccountSetupEmailInput = {
  to: string;
  setupUrl: string;
  expiresAt: Date;
  orderId: string;
};

export type TransactionalTransport = "ses" | "smtp";

const SUBJECT = "Set up your Quantum Reach account";

export function parseTransactionalTransport(value: string | undefined = process.env.EMAIL_TRANSPORT): TransactionalTransport {
  return value?.trim().toLowerCase() === "smtp" ? "smtp" : "ses";
}

function smtpPort(secure: boolean, raw?: string) {
  const parsed = Number(raw?.trim());
  if (Number.isInteger(parsed) && parsed > 0 && parsed <= 65535) return parsed;
  return secure ? 465 : 587;
}

export function getTransactionalEmailConfig() {
  const enabled = process.env.EMAIL_SENDING_ENABLED === "true";
  const transport = parseTransactionalTransport();
  const region = process.env.AWS_SES_REGION?.trim() ?? "";
  const accessKeyId = process.env.AWS_SES_ACCESS_KEY_ID?.trim() ?? "";
  const secretAccessKey = process.env.AWS_SES_SECRET_ACCESS_KEY?.trim() ?? "";
  const fromDomain = process.env.DEFAULT_FROM_DOMAIN?.trim() ?? "";
  const from = process.env.TRANSACTIONAL_FROM_EMAIL?.trim() || (fromDomain ? `noreply@${fromDomain}` : "noreply@quantumreach.app");
  const replyTo = process.env.TRANSACTIONAL_REPLY_TO?.trim() || "";
  const smtpHost = process.env.SMTP_HOST?.trim() ?? "";
  const smtpUser = process.env.SMTP_USER?.trim() ?? "";
  const smtpPass = process.env.SMTP_PASS ?? "";
  const smtpSecure = process.env.SMTP_SECURE === "true";
  const sesConfigured = Boolean(region && accessKeyId && secretAccessKey);
  const smtpConfigured = Boolean(smtpHost && smtpUser && smtpPass);
  return {
    enabled,
    transport,
    region,
    from,
    replyTo,
    sesConfigured,
    smtpConfigured,
    smtpHost,
    smtpPort: smtpPort(smtpSecure, process.env.SMTP_PORT),
    smtpUser,
    smtpPass,
    smtpSecure,
    configured: transport === "smtp" ? smtpConfigured : sesConfigured,
  };
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

function safeReason(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return redactSecrets(error.message);
  return fallback;
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
    `<p><a href="${href}" style="display:inline-block;background:#0369a1;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Set up your account</a></p>`,
    `<p>This link expires in about ${ttl} hours and can be used once.</p>`,
    `<p>Order id (for support): ${orderId}</p>`,
    "<p>If you didn't make this purchase, ignore this email.</p>",
    "</body></html>",
  ].join("");
  return { text, html };
}

async function sendViaSes(input: {
  to: string;
  from: string;
  replyTo: string;
  region: string;
  text: string;
  html: string;
}): Promise<TransactionalSendResult> {
  const client = new SESClient({
    region: input.region,
    credentials: {
      accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID!.trim(),
      secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY!.trim(),
    },
  });
  const response = await client.send(
    new SendEmailCommand({
      Source: input.from,
      Destination: { ToAddresses: [input.to] },
      ReplyToAddresses: input.replyTo ? [input.replyTo] : undefined,
      Message: {
        Subject: { Data: SUBJECT, Charset: "UTF-8" },
        Body: {
          Text: { Data: input.text, Charset: "UTF-8" },
          Html: { Data: input.html, Charset: "UTF-8" },
        },
      },
    }),
  );
  const messageId = response.MessageId?.trim();
  if (!messageId) return { sent: false, reason: "SES_MESSAGE_ID_MISSING" };
  return { sent: true, messageId };
}

/** System mail (account setup). Does not use workspace managed-domain, warmup, or campaign send gates. */
export async function sendAccountSetupEmail(input: AccountSetupEmailInput): Promise<TransactionalSendResult> {
  const config = getTransactionalEmailConfig();
  if (!config.enabled) return { sent: false, reason: "EMAIL_SENDING_DISABLED" };
  if (!config.from) return { sent: false, reason: "FROM_ADDRESS_MISSING" };

  const to = input.to.trim().toLowerCase();
  if (!to) return { sent: false, reason: "RECIPIENT_MISSING" };

  const { text, html } = accountSetupCopy(input);

  if (config.transport === "smtp") {
    if (!config.smtpConfigured) return { sent: false, reason: "SMTP_NOT_CONFIGURED" };
    try {
      const result = await sendViaSmtp({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpSecure,
        user: config.smtpUser,
        pass: config.smtpPass,
        from: config.from,
        replyTo: config.replyTo || undefined,
        to,
        subject: SUBJECT,
        text,
        html,
      });
      return { sent: true, messageId: result.messageId };
    } catch (error) {
      return { sent: false, reason: safeReason(error, "SMTP_SEND_FAILED") };
    }
  }

  if (!config.sesConfigured) return { sent: false, reason: "AWS_SES_NOT_CONFIGURED" };
  try {
    return await sendViaSes({
      to,
      from: config.from,
      replyTo: config.replyTo,
      region: config.region,
      text,
      html,
    });
  } catch (error) {
    return { sent: false, reason: safeReason(error, "SES_SEND_FAILED") };
  }
}

export const ACCOUNT_SETUP_EMAIL_SUBJECT = SUBJECT;
