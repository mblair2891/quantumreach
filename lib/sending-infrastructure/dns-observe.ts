import { promises as dns } from "node:dns";
import { nameserverProviderHint } from "./dns-display";

export type ObservedDns = { type: string; name: string; values: string[]; error?: string };

function normalizeName(name: string) {
  return name.replace(/\.$/, "").toLowerCase();
}

export async function lookupDnsRecord(type: string, name: string): Promise<ObservedDns> {
  const host = normalizeName(name);
  try {
    if (type === "TXT") {
      const records = await dns.resolveTxt(host);
      return { type, name: host, values: records.map((parts) => parts.join("")) };
    }
    if (type === "CNAME") {
      const records = await dns.resolveCname(host);
      return { type, name: host, values: records.map(normalizeName) };
    }
    if (type === "MX") {
      const records = await dns.resolveMx(host);
      return { type, name: host, values: records.map((row) => row.exchange.toLowerCase()) };
    }
    return { type, name: host, values: [], error: "UNSUPPORTED_RECORD_TYPE" };
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String((error as { code?: string }).code) : "DNS_LOOKUP_FAILED";
    return { type, name: host, values: [], error: code };
  }
}

export async function lookupNameServers(domainName: string): Promise<string[]> {
  const host = normalizeName(domainName);
  try {
    return (await dns.resolveNs(host)).map(normalizeName);
  } catch {
    return [];
  }
}

export async function lookupDnsHostHint(domainName: string, timeoutMs = 1500): Promise<string | null> {
  const nameservers = await Promise.race([
    lookupNameServers(domainName),
    new Promise<string[]>((resolve) => {
      setTimeout(() => resolve([]), timeoutMs);
    }),
  ]);
  return nameserverProviderHint(nameservers);
}

export function normalizeTxtValue(value: string) {
  return value.replace(/"/g, "").replace(/\.$/, "").toLowerCase().trim();
}

export function dnsValueMatches(expected: string, observed: string[]) {
  const want = normalizeTxtValue(expected);
  return observed.some((value) => {
    const got = normalizeTxtValue(value);
    return got === want || got.includes(want) || want.includes(got);
  });
}

export type DnsRecordMatch = {
  ok: boolean;
  status: "VERIFIED" | "PENDING" | "FAILED";
  safeError: string | null;
};

function missingDnsStatus(error?: string): DnsRecordMatch {
  const pending = error === "ENOTFOUND" || error === "ENODATA";
  return { ok: false, status: pending ? "PENDING" : "FAILED", safeError: error ?? "DNS_LOOKUP_FAILED" };
}

/** Apex SPF: one v=spf1 policy that includes amazonses.com. Extra includes (mailbox hosts) are OK. */
export function evaluateSpfTxtRecords(observed: ObservedDns): DnsRecordMatch {
  const values = observed.values.map(normalizeTxtValue).filter(Boolean);
  const spfPolicies = values.filter((value) => value.startsWith("v=spf1"));
  if (spfPolicies.length > 1) {
    return { ok: false, status: "FAILED", safeError: "MULTIPLE_SPF_RECORDS" };
  }
  const amazonsesPresent = values.some((value) => value.includes("include:amazonses.com"));
  if (amazonsesPresent) {
    return { ok: true, status: "VERIFIED", safeError: null };
  }
  if (!values.length) return missingDnsStatus(observed.error);
  return { ok: false, status: "FAILED", safeError: observed.error ?? "VALUE_MISMATCH" };
}

export function evaluateDnsRecordMatch(
  record: { type: string; value: string; purpose?: string | null },
  observed: ObservedDns,
): DnsRecordMatch {
  if ((record.purpose ?? "").toUpperCase() === "SPF" && record.type.toUpperCase() === "TXT") {
    return evaluateSpfTxtRecords(observed);
  }
  if (observed.error && !observed.values.length) return missingDnsStatus(observed.error);
  if (dnsValueMatches(record.value, observed.values)) {
    return { ok: true, status: "VERIFIED", safeError: null };
  }
  return { ok: false, status: "FAILED", safeError: observed.error ?? "VALUE_MISMATCH" };
}
