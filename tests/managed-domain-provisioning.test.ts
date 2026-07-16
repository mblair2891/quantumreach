import { beforeEach, describe, expect, it, vi } from "vitest";
const prisma: any = {
  managedDomain: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  managedDomainAssignment: { create: vi.fn(), count: vi.fn() },
  domainAuditEvent: { create: vi.fn() },
  domainDnsRecord: { create: vi.fn() },
  domainSesIdentity: { upsert: vi.fn() },
  domainWarmupPlan: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  domainReputationSnapshot: { create: vi.fn(), count: vi.fn() },
  domainPurchaseRequest: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  suppressionListEntry: { count: vi.fn() },
  senderIdentity: { findFirst: vi.fn() },
  emailSend: { count: vi.fn(), create: vi.fn(), update: vi.fn() },
};
vi.mock("@/lib/db/prisma", () => ({ prisma }));

describe("managed domain provisioning foundation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.DOMAIN_PROVIDER;
    delete process.env.DOMAIN_PURCHASING_ENABLED;
    delete process.env.DNS_PROVIDER;
    process.env.DATABASE_URL = "postgresql://test/test";
    prisma.domainAuditEvent.create.mockResolvedValue({ id: "audit" });
  });
  it("disabled provider cannot purchase and returns safe search/quote state", async () => {
    const { getDomainProvider } =
      await import("@/lib/managed-domains/providers");
    const p = getDomainProvider();
    await expect(
      p.purchaseDomain("example.com", "approved"),
    ).resolves.toMatchObject({
      ok: false,
      safeError: expect.stringContaining("disabled"),
    });
    await expect(p.searchDomains("acme.com")).resolves.toMatchObject({
      ok: false,
    });
  });
  it("mock provider requires approval before purchasing", async () => {
    process.env.DOMAIN_PROVIDER = "mock";
    const { getDomainProvider } =
      await import("@/lib/managed-domains/providers");
    const p = getDomainProvider();
    await expect(p.purchaseDomain("acme.com")).resolves.toMatchObject({
      ok: false,
    });
    await expect(p.purchaseDomain("acme.com", "req1")).resolves.toMatchObject({
      ok: true,
    });
  });
  it("creates inventory, assignment, DNS records, SES identity, and audit events", async () => {
    const {
      createManagedDomain,
      assignManagedDomain,
      createRequiredDnsRecords,
      upsertSesIdentity,
    } = await import("@/lib/managed-domains/service");
    prisma.managedDomain.create.mockResolvedValue({
      id: "d1",
      domainName: "send.acme.com",
    });
    prisma.managedDomain.findUnique.mockResolvedValue({
      id: "d1",
      lifecycleStatus: "AVAILABLE",
    });
    prisma.managedDomainAssignment.create.mockResolvedValue({ id: "a1" });
    prisma.managedDomain.update.mockResolvedValue({ id: "d1" });
    prisma.domainDnsRecord.create.mockImplementation(
      async ({ data }: any) => data,
    );
    prisma.domainSesIdentity.upsert.mockResolvedValue({
      domainId: "d1",
      sesRegion: "us-east-1",
    });
    await createManagedDomain({
      domainName: "Send.Acme.com",
      ownershipType: "QUANTUM_REACH_MANAGED",
    });
    await assignManagedDomain("d1", "w1", "u1");
    const records = await createRequiredDnsRecords("d1", "send.acme.com");
    await upsertSesIdentity("d1", "PENDING");
    expect(records.map((r: any) => r.purpose)).toEqual(
      expect.arrayContaining([
        "SPF",
        "DKIM",
        "DMARC",
        "SES_VERIFICATION",
        "MAIL_FROM",
      ]),
    );
    expect(prisma.domainAuditEvent.create).toHaveBeenCalled();
  });
  it("burned domain cannot become active", async () => {
    const { transitionManagedDomain } =
      await import("@/lib/managed-domains/service");
    prisma.managedDomain.findUnique.mockResolvedValue({
      id: "d1",
      lifecycleStatus: "BURNED",
    });
    await expect(transitionManagedDomain("d1", "ACTIVE")).rejects.toThrow(
      "Burned",
    );
  });
  it("readiness blocks missing DNS/SES/warmup and allows verified warm domain", async () => {
    const { isDomainSendReady } = await import("@/lib/managed-domains/service");
    prisma.managedDomain.findUnique.mockResolvedValueOnce({
      id: "d1",
      workspaceId: "w1",
      lifecycleStatus: "RESERVED",
      assignments: [{ workspaceId: "w1", status: "ACTIVE" }],
      dnsRecords: [],
      sesIdentity: null,
      warmupPlan: null,
    });
    await expect(isDomainSendReady("d1")).resolves.toMatchObject({
      ready: false,
      reason: expect.stringContaining("DNS"),
    });
    prisma.managedDomain.findUnique.mockResolvedValueOnce({
      id: "d1",
      workspaceId: "w1",
      lifecycleStatus: "ACTIVE",
      assignments: [{ workspaceId: "w1", status: "ACTIVE" }],
      dnsRecords: [{ status: "VERIFIED" }],
      sesIdentity: { verificationStatus: "VERIFIED" },
      warmupPlan: { status: "WARMING", currentDailyLimit: 10 },
    });
    await expect(isDomainSendReady("d1")).resolves.toMatchObject({
      ready: true,
      currentDailyLimit: 10,
    });
  });
  it("warmup ramps limits and reputation health changes", async () => {
    const { createWarmupPlan, advanceWarmupPlan, calculateHealthStatus } =
      await import("@/lib/managed-domains/service");
    prisma.domainWarmupPlan.create.mockImplementation(
      async ({ data }: any) => ({ id: "wp1", ...data }),
    );
    await expect(createWarmupPlan("d1")).resolves.toMatchObject({
      currentDailyLimit: 10,
    });
    prisma.domainWarmupPlan.findUnique.mockResolvedValue({
      id: "wp1",
      startingDailyLimit: 10,
      currentDailyLimit: 10,
      targetDailyLimit: 100,
      maxDailyLimit: 100,
      rampDays: 10,
      currentDay: 0,
    });
    prisma.domainWarmupPlan.update.mockImplementation(
      async ({ data }: any) => data,
    );
    await expect(advanceWarmupPlan("wp1")).resolves.toMatchObject({
      currentDailyLimit: 19,
    });
    expect(
      calculateHealthStatus({
        sentCount: 100,
        bounceCount: 12,
        complaintCount: 0,
      }),
    ).toBe("CRITICAL");
  });
  it("managed-domain send gate blocks cross-workspace and warmup limits", async () => {
    const { enforceSendGate } = await import("@/lib/revenue-os/email");
    prisma.suppressionListEntry.count.mockResolvedValue(0);
    process.env.EMAIL_SENDING_ENABLED = "true";
    process.env.EMAIL_SANDBOX_MODE = "false";
    process.env.AWS_SES_REGION = "us-east-1";
    process.env.AWS_SES_ACCESS_KEY_ID = "test";
    process.env.AWS_SES_SECRET_ACCESS_KEY = "test";
    prisma.managedDomain.findFirst.mockResolvedValue(null);
    await expect(
      enforceSendGate({
        workspaceId: "w1",
        to: "a@example.com",
        subject: "s",
        html: "h",
        managedDomainId: "d2",
      }),
    ).resolves.toMatchObject({ allowed: false });
  });
  it("operator summary is safe counts only", async () => {
    const { getOperatorDomainSummary } =
      await import("@/lib/managed-domains/service");
    prisma.managedDomain.count.mockResolvedValue(1);
    prisma.domainPurchaseRequest.count.mockResolvedValue(0);
    await expect(getOperatorDomainSummary()).resolves.toMatchObject({
      total: 1,
      label: "deliverability health signals",
    });
  });
});

describe("OpenSRS Horizon domain provider", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    for (const key of Object.keys(process.env))
      if (key.startsWith("OPENSRS_")) delete process.env[key];
    delete process.env.DOMAIN_PROVIDER;
    delete process.env.DOMAIN_PURCHASING_ENABLED;
  });
  const configure = () => {
    process.env.DOMAIN_PROVIDER = "opensrs";
    process.env.OPENSRS_ENVIRONMENT = "horizon";
    process.env.OPENSRS_USERNAME = "user-secret";
    process.env.OPENSRS_API_KEY = "key-secret";
    process.env.OPENSRS_API_BASE_URL = "https://horizon.opensrs.net:55443";
    process.env.OPENSRS_REG_USERNAME = "registrant-secret";
    process.env.OPENSRS_REG_PASSWORD = "registrant-password-secret";
    process.env.OPENSRS_TEST_CONTACT_FIRST_NAME = "Horizon";
    process.env.OPENSRS_TEST_CONTACT_LAST_NAME = "Operator";
    process.env.OPENSRS_TEST_CONTACT_ORG = "Quantum Reach Test";
    process.env.OPENSRS_TEST_CONTACT_ADDRESS1 = "1 Test Way";
    process.env.OPENSRS_TEST_CONTACT_CITY = "Toronto";
    process.env.OPENSRS_TEST_CONTACT_STATE = "ON";
    process.env.OPENSRS_TEST_CONTACT_POSTAL_CODE = "M5V 2T6";
    process.env.OPENSRS_TEST_CONTACT_COUNTRY = "CA";
    process.env.OPENSRS_TEST_CONTACT_PHONE = "+1.4165550100";
    process.env.OPENSRS_TEST_CONTACT_EMAIL = "horizon-test@example.com";
  };
  const successXml = (items: string) =>
    `<?xml version="1.0"?><OPS_envelope><body><data_block><dt_assoc><item key="is_success">1</item>${items}</dt_assoc></data_block></body></OPS_envelope>`;
  it("selects OpenSRS provider and reports missing env safely", async () => {
    process.env.DOMAIN_PROVIDER = "opensrs";
    const { getDomainProvider } =
      await import("@/lib/managed-domains/providers");
    const p = getDomainProvider();
    expect(p.name).toBe("opensrs");
    expect(p.isConfigured()).toBe(false);
    await expect(p.searchDomains("example.com")).resolves.toMatchObject({
      ok: false,
      safeError: expect.stringContaining("OPENSRS_USERNAME"),
    });
  });
  it("requires Horizon mode readiness", async () => {
    configure();
    const { getOpenSrsReadiness } =
      await import("@/lib/managed-domains/opensrs");
    expect(getOpenSrsReadiness()).toMatchObject({
      ready: true,
      testMode: true,
      environment: "horizon",
    });
    process.env.OPENSRS_ENVIRONMENT = "production";
    expect(getOpenSrsReadiness()).toMatchObject({
      ready: false,
      testMode: false,
    });
  });
  it("parses available and unavailable search responses", async () => {
    configure();
    const { OpenSrsHorizonDomainProvider } =
      await import("@/lib/managed-domains/opensrs");
    const available = new OpenSrsHorizonDomainProvider(async () => ({
      status: 200,
      text: successXml('<item key="status">available</item>'),
    }));
    await expect(available.searchDomains("Acme.COM")).resolves.toMatchObject({
      ok: true,
      data: [{ domainName: "acme.com", available: true, testMode: true }],
    });
    const unavailable = new OpenSrsHorizonDomainProvider(async () => ({
      status: 200,
      text: successXml('<item key="status">taken</item>'),
    }));
    await expect(unavailable.searchDomains("acme.com")).resolves.toMatchObject({
      ok: true,
      data: [{ available: false }],
    });
  });
  it("parses quote pricing", async () => {
    configure();
    const { OpenSrsHorizonDomainProvider } =
      await import("@/lib/managed-domains/opensrs");
    const p = new OpenSrsHorizonDomainProvider(async () => ({
      status: 200,
      text: successXml('<item key="price">12.34</item>'),
    }));
    await expect(p.getDomainQuote("acme.com")).resolves.toMatchObject({
      ok: true,
      data: {
        estimatedCostCents: 1234,
        resalePriceCents: 2468,
        providerQuoteId: "opensrs-horizon-acme.com",
      },
    });
  });
  it("handles provider errors without exposing credentials or signed material", async () => {
    configure();
    const { OpenSrsHorizonDomainProvider } =
      await import("@/lib/managed-domains/opensrs");
    const p = new OpenSrsHorizonDomainProvider(async () => {
      throw new Error("user-secret key-secret X-Signature");
    });
    const result = await p.getDomainQuote("acme.com");
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("user-secret");
    expect(JSON.stringify(result)).not.toContain("key-secret");
    expect(JSON.stringify(result)).not.toContain("X-Signature");
  });

  it("blocks missing Horizon registrant credentials safely", async () => {
    configure();
    delete process.env.OPENSRS_REG_USERNAME;
    const { OpenSrsHorizonDomainProvider } =
      await import("@/lib/managed-domains/opensrs");
    let p = new OpenSrsHorizonDomainProvider(async () => ({
      status: 200,
      text: successXml(""),
    }));
    let result = await p.purchaseDomain("acme.com", "req1");
    expect(result).toMatchObject({
      ok: false,
      safeError: expect.stringContaining("OPENSRS_REG_USERNAME"),
    });
    expect(JSON.stringify(result)).not.toContain("registrant-password-secret");
    configure();
    delete process.env.OPENSRS_REG_PASSWORD;
    p = new OpenSrsHorizonDomainProvider(async () => ({
      status: 200,
      text: successXml(""),
    }));
    result = await p.purchaseDomain("acme.com", "req1");
    expect(result).toMatchObject({
      ok: false,
      safeError: expect.stringContaining("OPENSRS_REG_PASSWORD"),
    });
    expect(JSON.stringify(result)).not.toContain("registrant-secret");
  });
  it("blocks missing Horizon test contact fields safely", async () => {
    configure();
    delete process.env.OPENSRS_TEST_CONTACT_EMAIL;
    const { OpenSrsHorizonDomainProvider } =
      await import("@/lib/managed-domains/opensrs");
    const p = new OpenSrsHorizonDomainProvider(async () => ({
      status: 200,
      text: successXml(""),
    }));
    const result = await p.purchaseDomain("acme.com", "req1");
    expect(result).toMatchObject({
      ok: false,
      safeError: expect.stringContaining("OPENSRS_TEST_CONTACT_EMAIL"),
    });
    expect(JSON.stringify(result)).not.toContain("registrant-password-secret");
  });
  it("builds a deterministic Horizon registration payload with required credentials and contacts", async () => {
    configure();
    const bodies: string[] = [];
    const { OpenSrsHorizonDomainProvider } =
      await import("@/lib/managed-domains/opensrs");
    const p = new OpenSrsHorizonDomainProvider(async (request) => {
      bodies.push(request.body);
      return {
        status: 200,
        text: successXml('<item key="status">completed</item>'),
      };
    });
    await expect(p.purchaseDomain("Acme.COM", "req1")).resolves.toMatchObject({
      ok: true,
    });
    const body = bodies[0];
    expect(body).toContain('<item key="action">sw_register</item>');
    expect(body).toContain('<item key="domain">acme.com</item>');
    expect(body).toContain('<item key="reg_username">registrant-secret</item>');
    expect(body).toContain(
      '<item key="reg_password">registrant-password-secret</item>',
    );
    expect(body).toContain('<item key="period">1</item>');
    expect(body).toContain('<item key="auto_renew">0</item>');
    expect(body).toContain('<item key="custom_nameservers">0</item>');
    expect(body).toContain(
      '<item key="contact_set"><dt_assoc><item key="owner">',
    );
    expect(body).toContain('<item key="admin">');
    expect(body).toContain('<item key="tech">');
    expect(body).toContain('<item key="billing">');
  });
  it("submits Horizon test registrations only with approval", async () => {
    configure();
    const { OpenSrsHorizonDomainProvider } =
      await import("@/lib/managed-domains/opensrs");
    const p = new OpenSrsHorizonDomainProvider(async () => ({
      status: 200,
      text: successXml('<item key="status">completed</item>'),
    }));
    await expect(p.purchaseDomain("acme.com")).resolves.toMatchObject({
      ok: false,
    });
    await expect(p.purchaseDomain("acme.com", "req1")).resolves.toMatchObject({
      ok: true,
      data: { providerDomainId: "opensrs-horizon-acme.com" },
    });
  });

  it("surfaces safe application-level Horizon registration failures from HTTP 200 XML", async () => {
    configure();
    const { OpenSrsHorizonDomainProvider } =
      await import("@/lib/managed-domains/opensrs");
    const failureXml = `<?xml version="1.0"?><OPS_envelope><body><data_block><dt_assoc><item key="is_success">0</item><item key="response_code">415</item><item key="response_text">Missing required field: registrant first_name</item><item key="validation_error">Registrant phone is required</item><item key="secret_echo">user-secret key-secret X-Signature</item></dt_assoc></data_block></body></OPS_envelope>`;
    const p = new OpenSrsHorizonDomainProvider(async () => ({
      status: 200,
      text: failureXml,
    }));
    const result = await p.purchaseDomain("acme.com", "req1");
    expect(result).toMatchObject({
      ok: false,
      safeError: expect.stringContaining("OpenSRS Horizon request failed"),
      providerError: {
        code: "415",
        message: "Missing required field: registrant first_name",
        testMode: true,
        validationReasons: expect.arrayContaining([
          "Registrant phone is required",
        ]),
      },
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("user-secret");
    expect(serialized).not.toContain("key-secret");
    expect(serialized).not.toContain("X-Signature");
    expect(serialized).not.toContain("OPS_envelope");
  });
  it("does not expose raw XML when provider text includes XML or signatures", async () => {
    configure();
    const { OpenSrsHorizonDomainProvider } =
      await import("@/lib/managed-domains/opensrs");
    const p = new OpenSrsHorizonDomainProvider(async () => ({
      status: 200,
      text: `<?xml version="1.0"?><OPS_envelope><body><data_block><dt_assoc><item key="is_success">0</item><item key="response_code">X-Signature</item><item key="response_text">Failure <OPS_envelope>user-secret key-secret</OPS_envelope></item></dt_assoc></data_block></body></OPS_envelope>`,
    }));
    const result = await p.purchaseDomain("acme.com", "req1");
    const serialized = JSON.stringify(result);
    expect(serialized).toContain("[redacted");
    expect(serialized).not.toContain("user-secret");
    expect(serialized).not.toContain("key-secret");
    expect(serialized).not.toContain("X-Signature");
    expect(serialized).not.toContain("<OPS_envelope>");
  });
  it("renders safe TEST provider diagnostics in the operator console", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        "app/dashboard/admin/domains/domain-operator-console.tsx",
        "utf8",
      ),
    );
    expect(source).toContain("Provider TEST diagnostic");
    expect(source).toContain("Provider code:");
    expect(source).toContain("Provider message:");
    expect(source).toContain("Mode: TEST");
    expect(source).not.toContain("OPS_envelope");
    expect(source).not.toContain("X-Signature");
  });
  it("blocks production purchasing", async () => {
    configure();
    process.env.OPENSRS_ENVIRONMENT = "production";
    process.env.OPENSRS_API_BASE_URL = "https://rr-n1-tor.opensrs.net:55443";
    const { OpenSrsHorizonDomainProvider } =
      await import("@/lib/managed-domains/opensrs");
    const p = new OpenSrsHorizonDomainProvider(async () => ({
      status: 200,
      text: successXml(""),
    }));
    await expect(p.purchaseDomain("acme.com", "req1")).resolves.toMatchObject({
      ok: false,
      safeError: expect.stringContaining("Production"),
    });
  });
});
