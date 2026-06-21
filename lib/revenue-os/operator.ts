/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/db/prisma";
export async function getRevenueOperatorSummary(workspaceId: string) {
  const [imports, campaigns, suppressions, bookings, researchRuns, provisioning] = await Promise.all([
    (prisma as any).contactImportBatch.count({ where: { workspaceId } }),
    (prisma as any).emailCampaign.count({ where: { workspaceId } }),
    (prisma as any).suppressionListEntry.count({ where: { workspaceId } }),
    (prisma as any).booking.count({ where: { workspaceId } }),
    (prisma as any).researchRun.count({ where: { workspaceId } }),
    (prisma as any).clientWorkspaceProvisioningRequest.count({ where: { workspaceId } })
  ]);
  return { imports, campaigns, suppressions, bookings, researchRuns, provisioning, email: { configured: process.env.EMAIL_SENDING_ENABLED === "true", sandbox: process.env.EMAIL_SANDBOX_MODE !== "false" }, billing: { enabled: process.env.BILLING_ENABLED === "true", stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET) } };
}
