import crypto from "node:crypto";
import type { DomainProvider, DomainProviderResult, DomainQuote, DomainProviderSafeError } from "./providers";

export type OpenSrsTransport = (request: { url: string; body: string; headers: Record<string, string> }) => Promise<{ status: number; text: string }>;

const HORIZON_DEFAULT_URL = "https://horizon.opensrs.net:55443";
const SAFE_PROVIDER_ERROR = "OpenSRS Horizon request failed. Check provider configuration or retry later.";
const SAFE_XML_FIELD_KEYS = ["response_code", "response_text", "error", "error_text", "error_message", "message", "reason", "validation_error", "validation_errors", "status", "is_success"];

type OpenSrsConfig = { environment: string; username?: string; apiKey?: string; baseUrl: string };

type OpenSrsParsedResponse = { isSuccess?: boolean; responseCode?: string; responseText?: string; validationReasons: string[] };

export function getOpenSrsConfig(): OpenSrsConfig {
  return {
    environment: (process.env.OPENSRS_ENVIRONMENT || "horizon").toLowerCase(),
    username: process.env.OPENSRS_USERNAME,
    apiKey: process.env.OPENSRS_API_KEY,
    baseUrl: process.env.OPENSRS_API_BASE_URL || HORIZON_DEFAULT_URL,
  };
}

export function getOpenSrsReadiness(config = getOpenSrsConfig()) {
  const missing = [!config.username && "OPENSRS_USERNAME", !config.apiKey && "OPENSRS_API_KEY", !config.baseUrl && "OPENSRS_API_BASE_URL"].filter(Boolean) as string[];
  const horizon = config.environment === "horizon" && config.baseUrl.includes("horizon.opensrs.net");
  return { ready: missing.length === 0 && horizon, missing, environment: config.environment, baseUrl: config.baseUrl, testMode: horizon, safeError: missing.length ? `OpenSRS Horizon is missing required environment values: ${missing.join(", ")}.` : horizon ? undefined : "OpenSRS provider is restricted to the Horizon test environment." };
}

function escapeXml(value: string) { return value.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] || c)); }
function item(key: string, value: string | number | boolean) { return `<item key="${escapeXml(key)}">${escapeXml(String(value))}</item>`; }
function requestXml(action: string, object: string, attributes: Record<string, string | number | boolean>) { return `<?xml version='1.0' encoding='UTF-8'?><OPS_envelope><header><version>0.9</version></header><body><data_block><dt_assoc>${item("protocol", "XCP")}${item("action", action)}${item("object", object)}<item key="attributes"><dt_assoc>${Object.entries(attributes).map(([k, v]) => item(k, v)).join("")}</dt_assoc></item></dt_assoc></data_block></body></OPS_envelope>`; }
function signature(body: string, key: string) { return crypto.createHash("md5").update(crypto.createHash("md5").update(body + key).digest("hex") + key).digest("hex"); }
async function defaultTransport(request: { url: string; body: string; headers: Record<string, string> }) { const response = await fetch(request.url, { method: "POST", body: request.body, headers: request.headers }); return { status: response.status, text: await response.text() }; }
function decodeXml(value?: string) { return String(value || "").replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim(); }
function textForKey(xml: string, key: string) { const m = xml.match(new RegExp(`<item\\s+key=["']${key}["'][^>]*>([\\s\\S]*?)<\\/item>`, "i")); return decodeXml(m?.[1]); }
function allTextsForKey(xml: string, key: string) { return [...xml.matchAll(new RegExp(`<item\\s+key=["']${key}["'][^>]*>([\\s\\S]*?)<\\/item>`, "gi"))].map((m) => decodeXml(m[1])).filter(Boolean); }
function boolish(value?: string) { return ["1", "true", "yes", "available"].includes(String(value).toLowerCase()); }
function falseish(value?: string) { return ["0", "false", "no", "failed", "failure"].includes(String(value).toLowerCase()); }
function cents(value?: string) { const num = Number(String(value || "").replace(/[^0-9.]/g, "")); return Number.isFinite(num) && num > 0 ? Math.round(num * 100) : undefined; }
function normalizeDomain(domainName: string) { return domainName.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, ""); }
function redactOpenSrsSensitive(value: string, config = getOpenSrsConfig()) {
  let safe = value.replace(/<\/?OPS_envelope[\s\S]*$/i, "[redacted OpenSRS XML]").replace(/X-Signature/gi, "[redacted signature header]");
  for (const secret of [config.username, config.apiKey].filter(Boolean) as string[]) safe = safe.split(secret).join("[redacted]");
  return safe.replace(/[a-f0-9]{32}/gi, "[redacted signature]").slice(0, 300);
}
function safeProviderText(value?: string, config = getOpenSrsConfig()) { return redactOpenSrsSensitive(decodeXml(value), config).replace(/[\r\n\t]+/g, " ").trim().slice(0, 240); }
function parseOpenSrsResponse(xml: string, config = getOpenSrsConfig()): OpenSrsParsedResponse {
  const isSuccessText = textForKey(xml, "is_success");
  const responseCode = safeProviderText(textForKey(xml, "response_code") || textForKey(xml, "code"), config) || undefined;
  const responseText = safeProviderText(textForKey(xml, "response_text") || textForKey(xml, "error_text") || textForKey(xml, "error_message") || textForKey(xml, "message") || textForKey(xml, "reason"), config) || undefined;
  const validationReasons = [...new Set(SAFE_XML_FIELD_KEYS.flatMap((key) => allTextsForKey(xml, key).map((text) => safeProviderText(text, config))).filter((text) => text && text !== responseCode && text !== responseText && !/^0|1$/i.test(text)).slice(0, 6))];
  return { isSuccess: boolish(isSuccessText) ? true : falseish(isSuccessText) ? false : undefined, responseCode, responseText, validationReasons };
}
function toProviderError(parsed?: OpenSrsParsedResponse): DomainProviderSafeError {
  return { code: parsed?.responseCode, message: parsed?.responseText || parsed?.validationReasons[0] || SAFE_PROVIDER_ERROR, testMode: true, validationReasons: parsed?.validationReasons.length ? parsed.validationReasons : undefined };
}
type OpenSrsCallResult = { ok: true; xml: string; parsed: OpenSrsParsedResponse } | { ok: false; safeError?: string; providerError?: DomainProviderSafeError };
function safeCatch(): OpenSrsCallResult { return { ok: false, safeError: SAFE_PROVIDER_ERROR }; }

export class OpenSrsHorizonDomainProvider implements DomainProvider {
  name = "opensrs";
  constructor(private readonly transport: OpenSrsTransport = defaultTransport, private readonly config = getOpenSrsConfig()) {}
  isConfigured() { return getOpenSrsReadiness(this.config).ready; }
  readiness() { return getOpenSrsReadiness(this.config); }
  private async call(action: string, object: string, attributes: Record<string, string | number | boolean>): Promise<OpenSrsCallResult> {
    const ready = this.readiness();
    if (!ready.ready || !this.config.username || !this.config.apiKey) return { ok: false as const, safeError: ready.safeError };
    const body = requestXml(action, object, attributes);
    const headers = { "Content-Type": "text/xml", "X-Username": this.config.username, "X-Signature": signature(body, this.config.apiKey) };
    try { const response = await this.transport({ url: this.config.baseUrl, body, headers }); if (response.status < 200 || response.status >= 300) return { ok: false as const, safeError: SAFE_PROVIDER_ERROR }; return { ok: true as const, xml: response.text, parsed: parseOpenSrsResponse(response.text, this.config) }; } catch { return safeCatch(); }
  }
  async searchDomains(query: string): Promise<DomainProviderResult<DomainQuote[]>> {
    const domainName = normalizeDomain(query); const r = await this.call("lookup", "domain", { domain: domainName }); if (!r.ok) return r;
    const available = r.parsed.isSuccess === true && !["taken", "unavailable"].includes(String(textForKey(r.xml, "status") || "").toLowerCase());
    return { ok: true, data: [{ domainName, available, providerQuoteId: `opensrs-horizon-${domainName}`, testMode: true } as DomainQuote] };
  }
  async getDomainQuote(domainName: string): Promise<DomainProviderResult<DomainQuote>> {
    const domain = normalizeDomain(domainName); const r = await this.call("get_price", "domain", { domain, period: 1, type: "new" }); if (!r.ok) return r;
    const cost = cents(textForKey(r.xml, "price") || textForKey(r.xml, "registration_price") || textForKey(r.xml, "total"));
    return { ok: true, data: { domainName: domain, available: true, estimatedCostCents: cost, resalePriceCents: cost ? Math.ceil(cost * 2) : undefined, providerQuoteId: `opensrs-horizon-${domain}`, testMode: true } as DomainQuote };
  }
  async createPurchaseRequest(domainName: string, workspaceId?: string | null): Promise<DomainProviderResult<{ domainName: string; workspaceId?: string | null; requiresApproval: boolean }>> { return { ok: true, data: { domainName: normalizeDomain(domainName), workspaceId, requiresApproval: true }, safeError: "Horizon test registration requires an operator-only approval path." }; }
  async purchaseDomain(domainName: string, approvedRequestId?: string): Promise<DomainProviderResult<{ providerDomainId: string }>> {
    if (!approvedRequestId) return { ok: false, safeError: "Operator approval is required before Horizon test registration." };
    const ready = this.readiness(); if (!ready.testMode) return { ok: false, safeError: "Production OpenSRS registration is blocked. Horizon test mode is required." };
    const domain = normalizeDomain(domainName); const r = await this.call("sw_register", "domain", { domain, period: 1, reg_type: "new", custom_tech_contact: 0, custom_nameservers: 0 }); if (!r.ok) return r;
    return r.parsed.isSuccess === true ? { ok: true, data: { providerDomainId: `opensrs-horizon-${domain}` } } : { ok: false, safeError: SAFE_PROVIDER_ERROR, providerError: toProviderError(r.parsed) };
  }
  async getDomainStatus(providerDomainId: string): Promise<DomainProviderResult<{ status: string }>> { const domain = normalizeDomain(providerDomainId.replace(/^opensrs-horizon-/, "")); const r = await this.call("get", "domain", { domain, type: "status" }); if (!r.ok) return r; return { ok: true, data: { status: textForKey(r.xml, "status") || "unknown_test_status" } }; }
  async getRenewalStatus(): Promise<DomainProviderResult<{ autoRenew: boolean; expirationDate?: Date }>> { return { ok: false, safeError: "OpenSRS Horizon renewal automation is not enabled." }; }
  async setAutoRenew(): Promise<DomainProviderResult<{ autoRenew: boolean }>> { return { ok: false, safeError: "OpenSRS Horizon auto-renew changes are not enabled." }; }
}
