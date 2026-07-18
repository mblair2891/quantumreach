export type ProviderReadiness = { state: "NOT_CONFIGURED"|"CONFIGURED"|"DEGRADED"|"READY"|"ERROR"; safeMessage: string; missing?: string[] };
export type MailboxRequest = { workspaceId: string; domainName: string; localPart: string; displayName?: string; idempotencyKey: string };
export type MailboxResult = { providerMailboxId?: string; emailAddress: string; status: "PENDING"|"PROVISIONING"|"ACTIVE"|"FAILED"; safeMessage?: string };
export interface MailboxProvider { key: string; getProviderHealth(): ProviderReadiness; createMailbox(input: MailboxRequest): Promise<MailboxResult>; suspendMailbox(emailAddress: string): Promise<MailboxResult>; reactivateMailbox(emailAddress: string): Promise<MailboxResult>; deleteMailbox(emailAddress: string): Promise<MailboxResult>; rotateMailboxPassword(emailAddress: string): Promise<{ ok: boolean; safeMessage: string }>; listMailboxes(domainName: string): Promise<MailboxResult[]>; }

export class DisabledMailboxProvider implements MailboxProvider {
  key = "DISABLED";
  getProviderHealth(): ProviderReadiness { return { state: "NOT_CONFIGURED", safeMessage: "Mailbox provider is disabled; no live mailbox operation will run." }; }
  async createMailbox(input: MailboxRequest): Promise<MailboxResult> { return { emailAddress: `${input.localPart}@${input.domainName}`.toLowerCase(), status: "PENDING", safeMessage: "Mailbox provisioning is disabled." }; }
  async suspendMailbox(emailAddress: string): Promise<MailboxResult> { return { emailAddress, status: "PENDING", safeMessage: "Mailbox provider disabled." }; }
  async reactivateMailbox(emailAddress: string): Promise<MailboxResult> { return { emailAddress, status: "PENDING", safeMessage: "Mailbox provider disabled." }; }
  async deleteMailbox(emailAddress: string): Promise<MailboxResult> { return { emailAddress, status: "PENDING", safeMessage: "Mailbox provider disabled." }; }
  async rotateMailboxPassword(): Promise<{ ok: boolean; safeMessage: string }> { return { ok: false, safeMessage: "Password rotation requires a configured mailbox provider." }; }
  async listMailboxes(): Promise<MailboxResult[]> { return []; }
}
export function getMailboxProvider(): MailboxProvider { return new DisabledMailboxProvider(); }
export function getProviderReadiness() { return { domainProvider: process.env.DOMAIN_PROVIDER || "opensrs", mailbox: getMailboxProvider().getProviderHealth(), emailSendingEnabled: process.env.EMAIL_SENDING_ENABLED === "true", sandboxMode: process.env.EMAIL_SANDBOX_MODE !== "false", dnsAutomationEnabled: process.env.DNS_AUTOMATION_ENABLED === "true", inboundSyncEnabled: process.env.INBOUND_EMAIL_SYNC_ENABLED === "true" }; }
