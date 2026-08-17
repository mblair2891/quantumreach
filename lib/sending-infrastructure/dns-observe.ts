import { promises as dns } from "node:dns";

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

export function dnsValueMatches(expected: string, observed: string[]) {
  const want = expected.replace(/\.$/, "").toLowerCase().replace(/^"|"$/g, "");
  return observed.some((value) => {
    const got = value.replace(/\.$/, "").toLowerCase().replace(/^"|"$/g, "");
    return got === want || got.includes(want) || want.includes(got);
  });
}
