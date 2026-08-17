import "server-only";
import {
  GetIdentityDkimAttributesCommand,
  GetIdentityVerificationAttributesCommand,
  SESClient,
  VerifyDomainDkimCommand,
  VerifyDomainIdentityCommand,
} from "@aws-sdk/client-ses";
import { getSendingGates, sesCredentials } from "./gates";

export type SesIdentityTokens = {
  verificationToken: string;
  dkimTokens: string[];
};

export type SesIdentityPoll = {
  verificationStatus: string;
  dkimStatus: string;
};

function client() {
  const { region, credentials } = sesCredentials();
  return new SESClient({ region, credentials });
}

export async function requestSesDomainIdentity(domainName: string): Promise<SesIdentityTokens | { error: string }> {
  const gates = getSendingGates();
  if (!gates.sesConfigured) return { error: "AWS_SES_NOT_CONFIGURED" };
  try {
    const ses = client();
    const identity = await ses.send(new VerifyDomainIdentityCommand({ Domain: domainName }));
    const dkim = await ses.send(new VerifyDomainDkimCommand({ Domain: domainName }));
    return {
      verificationToken: identity.VerificationToken?.trim() || "",
      dkimTokens: (dkim.DkimTokens ?? []).map((token) => token.trim()).filter(Boolean),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : "SES_IDENTITY_FAILED";
    return { error: message };
  }
}

export async function pollSesDomainIdentity(domainName: string): Promise<SesIdentityPoll | { error: string }> {
  const gates = getSendingGates();
  if (!gates.sesConfigured) return { error: "AWS_SES_NOT_CONFIGURED" };
  try {
    const ses = client();
    const [verification, dkim] = await Promise.all([
      ses.send(new GetIdentityVerificationAttributesCommand({ Identities: [domainName] })),
      ses.send(new GetIdentityDkimAttributesCommand({ Identities: [domainName] })),
    ]);
    const verificationStatus = verification.VerificationAttributes?.[domainName]?.VerificationStatus ?? "Pending";
    const dkimStatus = dkim.DkimAttributes?.[domainName]?.DkimVerificationStatus ?? "Pending";
    return {
      verificationStatus: verificationStatus.toUpperCase() === "SUCCESS" ? "VERIFIED" : verificationStatus.toUpperCase(),
      dkimStatus: dkimStatus.toUpperCase() === "SUCCESS" ? "VERIFIED" : dkimStatus.toUpperCase(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : "SES_POLL_FAILED";
    return { error: message };
  }
}
