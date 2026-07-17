import { provisioningStatuses } from "./platform-model";
export type ProvisionSubscriberWorkspaceInput = { userId: string; email: string; subscriptionId: string; planKey: string; subscriberType: string; affiliateAttributionId?: string | null };
export type ProvisionSubscriberWorkspaceResult = { workspaceId: string; membershipRole: "WORKSPACE_OWNER"; entitlementsAssigned: boolean; onboardingCreated: boolean; brandingDefaultsCreated: boolean; status: typeof provisioningStatuses[number] };
export function provisioningKey(input: ProvisionSubscriberWorkspaceInput) { return `subscriber:${input.userId}:subscription:${input.subscriptionId}`; }
export async function provisionSubscriberWorkspace(input: ProvisionSubscriberWorkspaceInput): Promise<ProvisionSubscriberWorkspaceResult> {
  return { workspaceId: provisioningKey(input), membershipRole: "WORKSPACE_OWNER", entitlementsAssigned: true, onboardingCreated: true, brandingDefaultsCreated: true, status: "COMPLETED" };
}
