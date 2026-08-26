import "server-only";
import nodemailer from "nodemailer";

export type SmtpSendInput = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  replyTo?: string;
  to: string;
  subject: string;
  text: string;
  html: string;
};

/** Platform system mail only. Never import this from campaign/outbound send paths. */
export async function sendViaSmtp(input: SmtpSendInput): Promise<{ messageId: string }> {
  const transporter = nodemailer.createTransport({
    host: input.host,
    port: input.port,
    secure: input.secure,
    auth: { user: input.user, pass: input.pass },
  });
  const info = await transporter.sendMail({
    from: input.from,
    to: input.to,
    replyTo: input.replyTo || undefined,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
  const messageId = String(info.messageId ?? "").trim();
  if (!messageId) throw new Error("SMTP_MESSAGE_ID_MISSING");
  return { messageId };
}
