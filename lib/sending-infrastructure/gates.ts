/** Kill-switch gates for managed sending. Transactional system mail uses lib/email/transactional.ts. */

export type SendingGates = {
  emailSendingEnabled: boolean;
  sandboxMode: boolean;
  managedSendingEnabled: boolean;
  warmupWorkerEnabled: boolean;
  domainPurchasingEnabled: boolean;
  dnsAutomationEnabled: boolean;
  sesConfigured: boolean;
  sesRegion: string;
  configurationSet: string | null;
};

export function getSendingGates(env: Record<string, string | undefined> = process.env): SendingGates {
  const sesRegion = (env.AWS_SES_REGION || env.AWS_REGION || "us-east-2").trim();
  const accessKeyId = (env.AWS_SES_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = (env.AWS_SES_SECRET_ACCESS_KEY || env.AWS_SECRET_ACCESS_KEY || "").trim();
  return {
    emailSendingEnabled: env.EMAIL_SENDING_ENABLED === "true",
    sandboxMode: env.EMAIL_SANDBOX_MODE !== "false",
    managedSendingEnabled: env.MANAGED_SENDING_ENABLED === "true",
    warmupWorkerEnabled: env.WARMUP_WORKER_ENABLED !== "false",
    domainPurchasingEnabled: env.DOMAIN_PURCHASING_ENABLED === "true",
    dnsAutomationEnabled: env.DNS_AUTOMATION_ENABLED === "true",
    sesConfigured: Boolean(sesRegion && accessKeyId && secretAccessKey),
    sesRegion,
    configurationSet: env.AWS_SES_CONFIGURATION_SET?.trim() || null,
  };
}

export function sesCredentials(env: Record<string, string | undefined> = process.env) {
  const gates = getSendingGates(env);
  return {
    region: gates.sesRegion,
    credentials: {
      accessKeyId: (env.AWS_SES_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID || "").trim(),
      secretAccessKey: (env.AWS_SES_SECRET_ACCESS_KEY || env.AWS_SECRET_ACCESS_KEY || "").trim(),
    },
  };
}

export function unavailableMessage(feature: string) {
  return `${feature} is unavailable in this environment.`;
}

export function isSesIdentityVerified(status?: string | null) {
  const value = (status ?? "").toUpperCase();
  return value === "VERIFIED" || value === "SUCCESS";
}
