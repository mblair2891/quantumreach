export const UNSUBSCRIBE_TAG_RE = /\{\{\s*unsubscribe_url\s*\}\}/gi;

export function hasUnsubscribeMergeTag(...parts: Array<string | null | undefined>) {
  return parts.some((part) => Boolean(part && /\{\{\s*unsubscribe_url\s*\}\}/i.test(part)));
}

export function appBaseUrl() {
  return (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function buildUnsubscribeUrl(token: string) {
  return `${appBaseUrl()}/unsubscribe/${encodeURIComponent(token)}`;
}

export type WorkspaceSendingIdentity = {
  legalName: string;
  physicalMailingAddress: string;
};

export function workspaceSendingIdentity(
  workspace: { name?: string | null; legalName?: string | null; physicalMailingAddress?: string | null; settings?: unknown } | null | undefined,
): WorkspaceSendingIdentity {
  const settings =
    workspace?.settings && typeof workspace.settings === "object" && !Array.isArray(workspace.settings)
      ? (workspace.settings as Record<string, unknown>)
      : {};
  const legalName =
    (typeof workspace?.legalName === "string" && workspace.legalName.trim()) ||
    (typeof settings.legalName === "string" && settings.legalName.trim()) ||
    workspace?.name?.trim() ||
    "";
  const physicalMailingAddress =
    (typeof workspace?.physicalMailingAddress === "string" && workspace.physicalMailingAddress.trim()) ||
    (typeof settings.physicalMailingAddress === "string" && settings.physicalMailingAddress.trim()) ||
    "";
  return { legalName, physicalMailingAddress };
}

export function assertInstantlyCompliance(input: { subject: string; body: string; identity: WorkspaceSendingIdentity }) {
  if (!input.identity.physicalMailingAddress) {
    throw new Error("Set a physical mailing address in workspace settings before starting a campaign.");
  }
  if (!hasUnsubscribeMergeTag(input.subject, input.body)) {
    throw new Error("Campaign body must include the {{unsubscribe_url}} merge tag.");
  }
}

export function applyOutreachMergeTags(
  template: string,
  contact: { firstName?: string | null; lastName?: string | null; email?: string | null },
  extras: { unsubscribeUrl?: string } = {},
) {
  let out = template
    .replaceAll(/\{\{\s*FirstName\s*\}\}/gi, contact.firstName?.trim() || "")
    .replaceAll(/\{\{\s*LastName\s*\}\}/gi, contact.lastName?.trim() || "")
    .replaceAll(/\{\{\s*Email\s*\}\}/gi, contact.email?.trim() || "");
  if (extras.unsubscribeUrl) {
    out = out.replaceAll(/\{\{\s*unsubscribe_url\s*\}\}/gi, extras.unsubscribeUrl);
  }
  return out;
}

export function appendCommercialFooter(
  body: string,
  identity: WorkspaceSendingIdentity,
  unsubscribeUrl: string,
) {
  const footer = [
    "",
    identity.legalName,
    identity.physicalMailingAddress,
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join("\n");
  if (body.includes(identity.physicalMailingAddress) && body.includes(unsubscribeUrl)) return body;
  return `${body.trimEnd()}\n${footer}`;
}
