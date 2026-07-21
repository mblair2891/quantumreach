import type { DnsRecord } from "./dns";
export type CloudflareHealth = { state: "NOT_CONFIGURED" | "READY" | "ERROR"; safeMessage: string };
type CfRecord = { id: string; type: string; name: string; content: string; ttl?: number; comment?: string };
const managedMarker = "managed-by-quantumreach";
/** Cloudflare's REST boundary. It deliberately only mutates records marked by this app. */
export class CloudflareDnsProvider {
  private token = process.env.CLOUDFLARE_API_TOKEN;
  private accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  enabled() { return process.env.DNS_AUTOMATION_ENABLED === "true"; }
  private async request(path: string, init?: RequestInit) { const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, { ...init, headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) } }); const body = await response.json() as { success: boolean; result?: unknown; errors?: { message?: string }[] }; if (!response.ok || !body.success) throw new Error(body.errors?.[0]?.message || "Cloudflare request failed."); return body.result; }
  async health(): Promise<CloudflareHealth> { if (!this.enabled()) return { state: "NOT_CONFIGURED", safeMessage: "DNS automation is disabled." }; if (!this.token || !this.accountId) return { state: "NOT_CONFIGURED", safeMessage: "Cloudflare API token or account ID is not configured." }; try { await this.request(`/accounts/${this.accountId}`); return { state: "READY", safeMessage: "Cloudflare account check succeeded." }; } catch (error) { return { state: "ERROR", safeMessage: error instanceof Error ? error.message.slice(0, 300) : "Cloudflare health check failed." }; } }
  async findZone(domainName: string) { const zones = await this.request(`/zones?name=${encodeURIComponent(domainName)}`) as { id: string; name: string }[]; return zones[0] ?? null; }
  async listRecords(zoneId: string) { return this.request(`/zones/${zoneId}/dns_records`) as Promise<CfRecord[]>; }
  async upsertManagedRecord(zoneId: string, record: DnsRecord) { if (!this.enabled()) throw new Error("DNS automation is disabled."); const records = await this.listRecords(zoneId); const existing = records.find((item) => item.type === record.type && item.name.toLowerCase() === record.name.toLowerCase() && item.comment === managedMarker); const payload = { type: record.type, name: record.name, content: record.value, ttl: record.ttl ?? 1, comment: managedMarker }; return existing ? this.request(`/zones/${zoneId}/dns_records/${existing.id}`, { method: "PUT", body: JSON.stringify(payload) }) : this.request(`/zones/${zoneId}/dns_records`, { method: "POST", body: JSON.stringify(payload) }); }
  async deleteManagedRecord(zoneId: string, recordId: string) { const records = await this.listRecords(zoneId); if (!records.some((record) => record.id === recordId && record.comment === managedMarker)) throw new Error("Refusing to delete a DNS record not managed by Quantum Reach."); return this.request(`/zones/${zoneId}/dns_records/${recordId}`, { method: "DELETE" }); }
}
