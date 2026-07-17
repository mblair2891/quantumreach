import crypto from "node:crypto";
import { getDomainServiceContact, type RegistrantContact } from "./registrant";
import type {
  DomainProvider,
  DomainProviderResult,
  DomainQuote,
  DomainProviderSafeError,
} from "./providers";

export type OpenSrsTransport = (request: {
  url: string;
  body: string;
  headers: Record<string, string>;
}) => Promise<{ status: number; text: string }>;

const HORIZON_DEFAULT_URL = "https://horizon.opensrs.net:55443";
const SAFE_PROVIDER_ERROR =
  "OpenSRS Horizon request failed. Check provider configuration or retry later.";
const SAFE_XML_FIELD_KEYS = [
  "response_code",
  "response_text",
  "error",
  "error_text",
  "error_message",
  "message",
  "reason",
  "validation_error",
  "validation_errors",
  "status",
  "is_success",
];

type OpenSrsValue = string | number | boolean | OpenSrsAttributes;
type OpenSrsAttributes = { [key: string]: OpenSrsValue };
type OpenSrsConfig = {
  environment: string;
  username?: string;
  apiKey?: string;
  baseUrl: string;
  regUsername?: string;
  regPassword?: string;
  serviceContact: Record<string, string | undefined>;
  testContact: Record<string, string | undefined>;
};

type OpenSrsPurchaseContext = {
  id?: string;
  workspaceId?: string | null;
  ownershipType?: string;
  registrantSnapshot?: RegistrantContact | null;
};

type OpenSrsParsedResponse = {
  isSuccess?: boolean;
  responseCode?: string;
  responseText?: string;
  validationReasons: string[];
};

export function getOpenSrsConfig(): OpenSrsConfig {
  return {
    environment: (process.env.OPENSRS_ENVIRONMENT || "horizon").toLowerCase(),
    username: process.env.OPENSRS_USERNAME,
    apiKey: process.env.OPENSRS_API_KEY,
    baseUrl: process.env.OPENSRS_API_BASE_URL || HORIZON_DEFAULT_URL,
    regUsername: process.env.OPENSRS_REG_USERNAME,
    regPassword: process.env.OPENSRS_REG_PASSWORD,
    serviceContact: {
      first_name: process.env.DOMAIN_SERVICE_CONTACT_FIRST_NAME,
      last_name: process.env.DOMAIN_SERVICE_CONTACT_LAST_NAME,
      org_name: process.env.DOMAIN_SERVICE_CONTACT_ORG,
      address1: process.env.DOMAIN_SERVICE_CONTACT_ADDRESS1,
      city: process.env.DOMAIN_SERVICE_CONTACT_CITY,
      state: process.env.DOMAIN_SERVICE_CONTACT_STATE,
      postal_code: process.env.DOMAIN_SERVICE_CONTACT_POSTAL_CODE,
      country: process.env.DOMAIN_SERVICE_CONTACT_COUNTRY,
      phone: process.env.DOMAIN_SERVICE_CONTACT_PHONE,
      email: process.env.DOMAIN_SERVICE_CONTACT_EMAIL,
    },
    testContact: {
      first_name: process.env.OPENSRS_TEST_CONTACT_FIRST_NAME,
      last_name: process.env.OPENSRS_TEST_CONTACT_LAST_NAME,
      org_name: process.env.OPENSRS_TEST_CONTACT_ORG,
      address1: process.env.OPENSRS_TEST_CONTACT_ADDRESS1,
      city: process.env.OPENSRS_TEST_CONTACT_CITY,
      state: process.env.OPENSRS_TEST_CONTACT_STATE,
      postal_code: process.env.OPENSRS_TEST_CONTACT_POSTAL_CODE,
      country: process.env.OPENSRS_TEST_CONTACT_COUNTRY,
      phone: process.env.OPENSRS_TEST_CONTACT_PHONE,
      email: process.env.OPENSRS_TEST_CONTACT_EMAIL,
    },
  };
}

export function getOpenSrsReadiness(config = getOpenSrsConfig()) {
  const missing = [
    !config.username && "OPENSRS_USERNAME",
    !config.apiKey && "OPENSRS_API_KEY",
    !config.baseUrl && "OPENSRS_API_BASE_URL",
  ].filter(Boolean) as string[];
  const horizon =
    config.environment === "horizon" &&
    config.baseUrl.includes("horizon.opensrs.net");
  return {
    ready: missing.length === 0 && horizon,
    missing,
    environment: config.environment,
    baseUrl: config.baseUrl,
    testMode: horizon,
    safeError: missing.length
      ? `OpenSRS Horizon is missing required environment values: ${missing.join(", ")}.`
      : horizon
        ? undefined
        : "OpenSRS provider is restricted to the Horizon test environment.",
  };
}

export function mapOpenSrsContact(
  contact: RegistrantContact,
): Record<string, string> {
  return {
    first_name: contact.legalFirstName,
    last_name: contact.legalLastName,
    org_name:
      contact.organizationName ||
      `${contact.legalFirstName} ${contact.legalLastName}`,
    address1: contact.address1,
    address2: contact.address2 || "",
    city: contact.city,
    state: contact.stateProvince,
    postal_code: contact.postalCode,
    country: contact.countryCode,
    phone: contact.phone,
    email: contact.email,
  };
}
export function buildOpenSrsContactSet(input: {
  registrant: RegistrantContact;
  ownershipType?: string;
  useServiceForAdminTech?: boolean;
  useServiceForBilling?: boolean;
}) {
  const registrant = mapOpenSrsContact(input.registrant);
  const service = getDomainServiceContact();
  const serviceContact = service ? mapOpenSrsContact(service) : registrant;
  return {
    owner: registrant,
    admin: input.useServiceForAdminTech ? serviceContact : registrant,
    tech: input.useServiceForAdminTech ? serviceContact : registrant,
    billing: input.useServiceForBilling ? serviceContact : registrant,
  };
}

function escapeXml(value: string) {
  return value.replace(
    /[<>&'"]/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        "'": "&apos;",
        '"': "&quot;",
      })[c] || c,
  );
}
function isAssoc(value: OpenSrsValue): value is OpenSrsAttributes {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function item(key: string, value: OpenSrsValue): string {
  return isAssoc(value)
    ? `<item key="${escapeXml(key)}"><dt_assoc>${Object.entries(value)
        .map(([k, v]) => item(k, v))
        .join("")}</dt_assoc></item>`
    : `<item key="${escapeXml(key)}">${escapeXml(String(value))}</item>`;
}
function requestXml(
  action: string,
  object: string,
  attributes: OpenSrsAttributes,
) {
  return `<?xml version='1.0' encoding='UTF-8'?><OPS_envelope><header><version>0.9</version></header><body><data_block><dt_assoc>${item("protocol", "XCP")}${item("action", action)}${item("object", object)}${item("attributes", attributes)}</dt_assoc></data_block></body></OPS_envelope>`;
}
function signature(body: string, key: string) {
  return crypto
    .createHash("md5")
    .update(
      crypto
        .createHash("md5")
        .update(body + key)
        .digest("hex") + key,
    )
    .digest("hex");
}
async function defaultTransport(request: {
  url: string;
  body: string;
  headers: Record<string, string>;
}) {
  const response = await fetch(request.url, {
    method: "POST",
    body: request.body,
    headers: request.headers,
  });
  return { status: response.status, text: await response.text() };
}
function decodeXml(value?: string) {
  return String(value || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}
function textForKey(xml: string, key: string) {
  const m = xml.match(
    new RegExp(`<item\\s+key=["']${key}["'][^>]*>([\\s\\S]*?)<\\/item>`, "i"),
  );
  return decodeXml(m?.[1]);
}
function allTextsForKey(xml: string, key: string) {
  return [
    ...xml.matchAll(
      new RegExp(
        `<item\\s+key=["']${key}["'][^>]*>([\\s\\S]*?)<\\/item>`,
        "gi",
      ),
    ),
  ]
    .map((m) => decodeXml(m[1]))
    .filter(Boolean);
}
function boolish(value?: string) {
  return ["1", "true", "yes", "available"].includes(
    String(value).toLowerCase(),
  );
}
function falseish(value?: string) {
  return ["0", "false", "no", "failed", "failure"].includes(
    String(value).toLowerCase(),
  );
}
function cents(value?: string) {
  const num = Number(String(value || "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(num) && num > 0 ? Math.round(num * 100) : undefined;
}
function normalizeDomain(domainName: string) {
  return domainName
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
}
function redactOpenSrsSensitive(value: string, config = getOpenSrsConfig()) {
  let safe = value
    .replace(/<\/?OPS_envelope[\s\S]*$/i, "[redacted OpenSRS XML]")
    .replace(/X-Signature/gi, "[redacted signature header]");
  for (const secret of [
    config.username,
    config.apiKey,
    config.regUsername,
    config.regPassword,
  ].filter(Boolean) as string[])
    safe = safe.split(secret).join("[redacted]");
  return safe.replace(/[a-f0-9]{32}/gi, "[redacted signature]").slice(0, 300);
}
function safeProviderText(value?: string, config = getOpenSrsConfig()) {
  return redactOpenSrsSensitive(decodeXml(value), config)
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, 240);
}
function parseOpenSrsResponse(
  xml: string,
  config = getOpenSrsConfig(),
): OpenSrsParsedResponse {
  const isSuccessText = textForKey(xml, "is_success");
  const responseCode =
    safeProviderText(
      textForKey(xml, "response_code") || textForKey(xml, "code"),
      config,
    ) || undefined;
  const responseText =
    safeProviderText(
      textForKey(xml, "response_text") ||
        textForKey(xml, "error_text") ||
        textForKey(xml, "error_message") ||
        textForKey(xml, "message") ||
        textForKey(xml, "reason"),
      config,
    ) || undefined;
  const validationReasons = [
    ...new Set(
      SAFE_XML_FIELD_KEYS.flatMap((key) =>
        allTextsForKey(xml, key).map((text) => safeProviderText(text, config)),
      )
        .filter(
          (text) =>
            text &&
            text !== responseCode &&
            text !== responseText &&
            !/^0|1$/i.test(text),
        )
        .slice(0, 6),
    ),
  ];
  return {
    isSuccess: boolish(isSuccessText)
      ? true
      : falseish(isSuccessText)
        ? false
        : undefined,
    responseCode,
    responseText,
    validationReasons,
  };
}
function toProviderError(
  parsed?: OpenSrsParsedResponse,
): DomainProviderSafeError {
  return {
    code: parsed?.responseCode,
    message:
      parsed?.responseText ||
      parsed?.validationReasons[0] ||
      SAFE_PROVIDER_ERROR,
    testMode: true,
    validationReasons: parsed?.validationReasons.length
      ? parsed.validationReasons
      : undefined,
  };
}
type OpenSrsCallResult =
  | { ok: true; xml: string; parsed: OpenSrsParsedResponse }
  | { ok: false; safeError?: string; providerError?: DomainProviderSafeError };
type OpenSrsRegistrationBuildResult =
  | { ok: true; attributes: OpenSrsAttributes }
  | { ok: false; safeError: string };
function safeCatch(): OpenSrsCallResult {
  return { ok: false, safeError: SAFE_PROVIDER_ERROR };
}

export class OpenSrsHorizonDomainProvider implements DomainProvider {
  name = "opensrs";
  constructor(
    private readonly transport: OpenSrsTransport = defaultTransport,
    private readonly config = getOpenSrsConfig(),
  ) {}
  isConfigured() {
    return getOpenSrsReadiness(this.config).ready;
  }
  readiness() {
    return getOpenSrsReadiness(this.config);
  }
  private async call(
    action: string,
    object: string,
    attributes: OpenSrsAttributes,
  ): Promise<OpenSrsCallResult> {
    const ready = this.readiness();
    if (
      (!ready.ready && ready.missing.length > 0) ||
      !this.config.username ||
      !this.config.apiKey
    )
      return { ok: false as const, safeError: ready.safeError };
    const body = requestXml(action, object, attributes);
    const headers = {
      "Content-Type": "text/xml",
      "X-Username": this.config.username,
      "X-Signature": signature(body, this.config.apiKey),
    };
    try {
      const response = await this.transport({
        url: this.config.baseUrl,
        body,
        headers,
      });
      if (response.status < 200 || response.status >= 300)
        return { ok: false as const, safeError: SAFE_PROVIDER_ERROR };
      return {
        ok: true as const,
        xml: response.text,
        parsed: parseOpenSrsResponse(response.text, this.config),
      };
    } catch {
      return safeCatch();
    }
  }
  async searchDomains(
    query: string,
  ): Promise<DomainProviderResult<DomainQuote[]>> {
    const domainName = normalizeDomain(query);
    const r = await this.call("lookup", "domain", { domain: domainName });
    if (!r.ok) return r;
    const available =
      r.parsed.isSuccess === true &&
      !["taken", "unavailable"].includes(
        String(textForKey(r.xml, "status") || "").toLowerCase(),
      );
    return {
      ok: true,
      data: [
        {
          domainName,
          available,
          providerQuoteId: `opensrs-horizon-${domainName}`,
          testMode: true,
        } as DomainQuote,
      ],
    };
  }
  async getDomainQuote(
    domainName: string,
  ): Promise<DomainProviderResult<DomainQuote>> {
    const domain = normalizeDomain(domainName);
    const r = await this.call("get_price", "domain", {
      domain,
      period: 1,
      type: "new",
    });
    if (!r.ok) return r;
    const cost = cents(
      textForKey(r.xml, "price") ||
        textForKey(r.xml, "registration_price") ||
        textForKey(r.xml, "total"),
    );
    return {
      ok: true,
      data: {
        domainName: domain,
        available: true,
        estimatedCostCents: cost,
        resalePriceCents: cost ? Math.ceil(cost * 2) : undefined,
        providerQuoteId: `opensrs-horizon-${domain}`,
        testMode: true,
      } as DomainQuote,
    };
  }
  async createPurchaseRequest(
    domainName: string,
    workspaceId?: string | null,
  ): Promise<
    DomainProviderResult<{
      domainName: string;
      workspaceId?: string | null;
      requiresApproval: boolean;
    }>
  > {
    return {
      ok: true,
      data: {
        domainName: normalizeDomain(domainName),
        workspaceId,
        requiresApproval: true,
      },
      safeError:
        "Horizon test registration requires an operator-only approval path.",
    };
  }

  private horizonRegistrationAttributes(
    domain: string,
  ): OpenSrsRegistrationBuildResult {
    if (!this.config.regUsername)
      return {
        ok: false,
        safeError:
          "OpenSRS Horizon test registration is missing required environment value: OPENSRS_REG_USERNAME.",
      };
    if (!this.config.regPassword)
      return {
        ok: false,
        safeError:
          "OpenSRS Horizon test registration is missing required environment value: OPENSRS_REG_PASSWORD.",
      };
    const requiredContact = [
      "first_name",
      "last_name",
      "org_name",
      "address1",
      "city",
      "state",
      "postal_code",
      "country",
      "phone",
      "email",
    ];
    const missing = requiredContact.filter(
      (key) => !this.config.testContact[key],
    );
    if (missing.length)
      return {
        ok: false,
        safeError: `OpenSRS Horizon test registration is missing required contact environment values: ${missing.map((key) => `OPENSRS_TEST_CONTACT_${key === "org_name" ? "ORG" : key.toUpperCase()}`).join(", ")}.`,
      };
    const contact = Object.fromEntries(
      requiredContact.map((key) => [
        key,
        this.config.testContact[key] as string,
      ]),
    );
    return {
      ok: true,
      attributes: {
        domain,
        reg_type: "new",
        period: 1,
        reg_username: this.config.regUsername,
        reg_password: this.config.regPassword,
        auto_renew: 0,
        custom_nameservers: 0,
        custom_tech_contact: 0,
        contact_set: {
          owner: contact,
          admin: contact,
          tech: contact,
          billing: contact,
        },
      },
    };
  }

  private productionRegistrationAttributes(
    domain: string,
    purchaseRequest?: OpenSrsPurchaseContext,
  ): OpenSrsRegistrationBuildResult {
    if (
      !process.env.DOMAIN_PURCHASING_ENABLED ||
      process.env.DOMAIN_PURCHASING_ENABLED !== "true"
    )
      return {
        ok: false,
        safeError:
          "Production OpenSRS purchasing is disabled until DOMAIN_PURCHASING_ENABLED=true and billing gates pass.",
      };
    const snapshot = purchaseRequest?.registrantSnapshot;
    let registrant: RegistrantContact | null = snapshot || null;
    if (purchaseRequest?.ownershipType === "QUANTUM_REACH_MANAGED")
      registrant = getDomainServiceContact();
    if (!registrant)
      return {
        ok: false,
        safeError:
          "Production registration requires a purchase registrant snapshot or configured Quantum Reach service contact for Quantum Reach-owned domains.",
      };
    const regUsername =
      process.env.OPENSRS_PRODUCTION_REG_USERNAME ||
      `${purchaseRequest?.workspaceId || "qr"}-${purchaseRequest?.id || domain}`.slice(
        0,
        48,
      );
    const regPassword =
      process.env.OPENSRS_PRODUCTION_REG_PASSWORD ||
      crypto.randomBytes(18).toString("base64url");
    return {
      ok: true,
      attributes: {
        domain,
        reg_type: "new",
        period: 1,
        reg_username: regUsername,
        reg_password: regPassword,
        auto_renew: 0,
        custom_nameservers: 0,
        custom_tech_contact: 1,
        contact_set: buildOpenSrsContactSet({
          registrant,
          useServiceForAdminTech: true,
          useServiceForBilling:
            process.env.DOMAIN_SERVICE_CONTACT_USE_FOR_BILLING === "true",
        }),
      },
    };
  }

  async purchaseDomain(
    domainName: string,
    approvedRequestId?: string,
    purchaseRequest?: OpenSrsPurchaseContext,
  ): Promise<DomainProviderResult<{ providerDomainId: string }>> {
    if (!approvedRequestId)
      return {
        ok: false,
        safeError:
          "Operator approval is required before Horizon test registration.",
      };
    const ready = this.readiness();
    const domain = normalizeDomain(domainName);
    const built = ready.testMode
      ? this.horizonRegistrationAttributes(domain)
      : this.productionRegistrationAttributes(domain, purchaseRequest);
    if (!built.ok) return built;
    const r = await this.call("sw_register", "domain", built.attributes);
    if (!r.ok) return r;
    return r.parsed.isSuccess === true
      ? { ok: true, data: { providerDomainId: `opensrs-horizon-${domain}` } }
      : {
          ok: false,
          safeError: SAFE_PROVIDER_ERROR,
          providerError: toProviderError(r.parsed),
        };
  }
  async getDomainStatus(
    providerDomainId: string,
  ): Promise<DomainProviderResult<{ status: string }>> {
    const domain = normalizeDomain(
      providerDomainId.replace(/^opensrs-horizon-/, ""),
    );
    const r = await this.call("get", "domain", { domain, type: "status" });
    if (!r.ok) return r;
    return {
      ok: true,
      data: { status: textForKey(r.xml, "status") || "unknown_test_status" },
    };
  }
  async getRenewalStatus(): Promise<
    DomainProviderResult<{ autoRenew: boolean; expirationDate?: Date }>
  > {
    return {
      ok: false,
      safeError: "OpenSRS Horizon renewal automation is not enabled.",
    };
  }
  async setAutoRenew(): Promise<DomainProviderResult<{ autoRenew: boolean }>> {
    return {
      ok: false,
      safeError: "OpenSRS Horizon auto-renew changes are not enabled.",
    };
  }
}
