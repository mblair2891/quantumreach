/* eslint-disable @typescript-eslint/no-unused-vars */
import { OpenSrsHorizonDomainProvider } from "./opensrs";
export type DomainProviderSafeError = {
  code?: string;
  message: string;
  testMode?: boolean;
  validationReasons?: string[];
};
export type DomainProviderResult<T = unknown> = {
  ok: boolean;
  data?: T;
  safeError?: string;
  providerError?: DomainProviderSafeError;
};
export type DomainQuote = {
  domainName: string;
  available: boolean;
  estimatedCostCents?: number;
  resalePriceCents?: number;
  providerQuoteId?: string;
  testMode?: boolean;
};
export interface DomainProvider {
  name: string;
  isConfigured(): boolean;
  searchDomains(query: string): Promise<DomainProviderResult<DomainQuote[]>>;
  getDomainQuote(
    domainName: string,
  ): Promise<DomainProviderResult<DomainQuote>>;
  createPurchaseRequest(
    domainName: string,
    workspaceId?: string | null,
  ): Promise<
    DomainProviderResult<{
      domainName: string;
      workspaceId?: string | null;
      requiresApproval: boolean;
    }>
  >;
  purchaseDomain(
    domainName: string,
    approvedRequestId?: string,
    purchaseRequest?: unknown,
  ): Promise<DomainProviderResult<{ providerDomainId: string }>>;
  getDomainStatus(
    providerDomainId: string,
  ): Promise<DomainProviderResult<{ status: string }>>;
  getRenewalStatus(
    providerDomainId: string,
  ): Promise<
    DomainProviderResult<{ autoRenew: boolean; expirationDate?: Date }>
  >;
  setAutoRenew(
    providerDomainId: string,
    enabled: boolean,
  ): Promise<DomainProviderResult<{ autoRenew: boolean }>>;
}
const disabled = "Domain provider not configured. Live purchasing is disabled.";
export class DisabledDomainProvider implements DomainProvider {
  name = "disabled";
  isConfigured() {
    return false;
  }
  async searchDomains(
    query: string,
  ): Promise<DomainProviderResult<DomainQuote[]>> {
    return {
      ok: false,
      data: [{ domainName: query, available: false }],
      safeError: disabled,
    };
  }
  async getDomainQuote(
    domainName: string,
  ): Promise<DomainProviderResult<DomainQuote>> {
    return {
      ok: false,
      data: { domainName, available: false },
      safeError: disabled,
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
      data: { domainName, workspaceId, requiresApproval: true },
      safeError:
        "Purchase request can be drafted, but live purchasing is disabled.",
    };
  }
  async purchaseDomain(
    domainName?: string,
    approvedRequestId?: string,
    purchaseRequest?: unknown,
  ): Promise<DomainProviderResult<{ providerDomainId: string }>> {
    return { ok: false, safeError: disabled };
  }
  async getDomainStatus(): Promise<DomainProviderResult<{ status: string }>> {
    return { ok: false, safeError: disabled };
  }
  async getRenewalStatus(): Promise<
    DomainProviderResult<{ autoRenew: boolean; expirationDate?: Date }>
  > {
    return { ok: false, safeError: disabled };
  }
  async setAutoRenew(): Promise<DomainProviderResult<{ autoRenew: boolean }>> {
    return { ok: false, safeError: disabled };
  }
}
export class MockDomainProvider extends DisabledDomainProvider {
  name = "mock";
  isConfigured() {
    return (
      process.env.NODE_ENV === "test" || process.env.DOMAIN_PROVIDER === "mock"
    );
  }
  async searchDomains(
    query: string,
  ): Promise<DomainProviderResult<DomainQuote[]>> {
    return {
      ok: true,
      data: ["com", "net"].map((tld) => ({
        domainName: `${query.replace(/\..*/, "")}.${tld}`,
        available: true,
        estimatedCostCents: 1200,
        resalePriceCents: 2400,
      })),
    };
  }
  async getDomainQuote(
    domainName: string,
  ): Promise<DomainProviderResult<DomainQuote>> {
    return {
      ok: true,
      data: {
        domainName,
        available: true,
        estimatedCostCents: 1200,
        resalePriceCents: 2400,
        providerQuoteId: `mock-${domainName}`,
      },
    };
  }
  async purchaseDomain(
    domainName: string,
    approvedRequestId?: string,
    purchaseRequest?: unknown,
  ): Promise<DomainProviderResult<{ providerDomainId: string }>> {
    return approvedRequestId
      ? { ok: true, data: { providerDomainId: `mock-domain-${domainName}` } }
      : {
          ok: false,
          safeError: "Operator approval is required before domain purchase.",
        };
  }
}
export class GenericRegistrarProvider extends DisabledDomainProvider {
  name = process.env.DOMAIN_PROVIDER || "generic-registrar";
}
export function getDomainProvider(): DomainProvider {
  if (process.env.DOMAIN_PROVIDER === "opensrs")
    return new OpenSrsHorizonDomainProvider();
  if (process.env.DOMAIN_PROVIDER === "mock") return new MockDomainProvider();
  if (
    process.env.DOMAIN_PURCHASING_ENABLED === "true" &&
    process.env.DOMAIN_PROVIDER_API_KEY
  )
    return new GenericRegistrarProvider();
  return new DisabledDomainProvider();
}
