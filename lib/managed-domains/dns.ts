/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
export type RequiredDnsRecord = { type: string; name: string; value: string; priority?: number; ttl?: number; purpose: "SPF"|"DKIM"|"DMARC"|"SES_VERIFICATION"|"MAIL_FROM"|"TRACKING"|"OTHER" };
export interface DnsProvider { name: string; isConfigured(): boolean; listZones(): Promise<any>; findZone(domainName: string): Promise<any>; upsertDnsRecord(domainId: string, record: RequiredDnsRecord): Promise<any>; deleteDnsRecord(domainId: string, recordId: string): Promise<any>; checkDnsRecord(domainName: string, type: string, expectedValue: string): Promise<any>; applyRequiredRecords(domainId: string): Promise<any>; }
const safeError = "DNS automation is disabled or provider credentials are missing. No DNS records were changed.";
export function generateRequiredDnsRecords(domainName: string, sesToken = "ses-verification-token", dkimTokens: string[] = []): RequiredDnsRecord[] {
  const dkim = (dkimTokens.length ? dkimTokens : ["dkim-token-1", "dkim-token-2", "dkim-token-3"]).map((token) => ({ type: "CNAME", name: `${token}._domainkey.${domainName}`, value: `${token}.dkim.amazonses.com`, purpose: "DKIM" as const, ttl: 300 }));
  return [
    { type: "TXT", name: domainName, value: "v=spf1 include:amazonses.com -all", purpose: "SPF", ttl: 300 },
    { type: "TXT", name: `_dmarc.${domainName}`, value: "v=DMARC1; p=quarantine; rua=mailto:dmarc@quantumreach.app", purpose: "DMARC", ttl: 300 },
    { type: "TXT", name: `_amazonses.${domainName}`, value: sesToken, purpose: "SES_VERIFICATION", ttl: 300 },
    { type: "MX", name: `mail.${domainName}`, value: "feedback-smtp.us-east-1.amazonses.com", priority: 10, purpose: "MAIL_FROM", ttl: 300 },
    { type: "CNAME", name: `track.${domainName}`, value: "tracking.quantumreach.app", purpose: "TRACKING", ttl: 300 },
    ...dkim,
  ];
}
export class DisabledDnsProvider implements DnsProvider { name = "disabled"; isConfigured(){return false;} async listZones(): Promise<any>{return {ok:false,safeError};} async findZone(): Promise<any>{return {ok:false,safeError};} async upsertDnsRecord(_domainId?: string, _record?: RequiredDnsRecord): Promise<any>{return {ok:false,safeError};} async deleteDnsRecord(): Promise<any>{return {ok:false,safeError};} async checkDnsRecord(): Promise<any>{return {ok:false,safeError};} async applyRequiredRecords(): Promise<any>{return {ok:false,safeError};} }
export class CloudflareDnsProvider extends DisabledDnsProvider { name = "cloudflare"; isConfigured(){return process.env.DNS_AUTOMATION_ENABLED === "true" && process.env.DNS_PROVIDER === "cloudflare" && Boolean(process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID);} }
export class TestDnsProvider extends DisabledDnsProvider { name = "test"; isConfigured(){return true;} async upsertDnsRecord(domainId:string, record:RequiredDnsRecord): Promise<any>{return {ok:true,data:{providerRecordId:`test-${domainId}-${record.purpose}`}};} async checkDnsRecord(): Promise<any>{return {ok:true,data:{verified:true}};} }
export function getDnsProvider(): DnsProvider { if (process.env.DNS_PROVIDER === "test") return new TestDnsProvider(); if (process.env.DNS_PROVIDER === "cloudflare") return new CloudflareDnsProvider(); return new DisabledDnsProvider(); }
