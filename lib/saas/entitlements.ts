export const SaaSPlanKeys = ["STARTER", "PROFESSIONAL", "AGENCY", "ENTERPRISE"] as const;
export type SaaSPlanKey = typeof SaaSPlanKeys[number];
export type EntitlementKey = "contacts"|"users"|"workspaces"|"campaigns"|"monthlyEmailSends"|"managedDomains"|"senderIdentities"|"monthlyAiUsage"|"meetingTranscriptionHours"|"storageGb"|"contracts"|"clientPortals"|"researchRuns";
export const planEntitlements: Record<SaaSPlanKey, Record<EntitlementKey, number | "custom">> = {
 STARTER:{contacts:1000,users:1,workspaces:1,campaigns:3,monthlyEmailSends:1000,managedDomains:1,senderIdentities:1,monthlyAiUsage:100,meetingTranscriptionHours:5,storageGb:10,contracts:10,clientPortals:3,researchRuns:25},
 PROFESSIONAL:{contacts:10000,users:5,workspaces:1,campaigns:20,monthlyEmailSends:10000,managedDomains:3,senderIdentities:5,monthlyAiUsage:1000,meetingTranscriptionHours:25,storageGb:100,contracts:100,clientPortals:25,researchRuns:250},
 AGENCY:{contacts:50000,users:15,workspaces:5,campaigns:100,monthlyEmailSends:50000,managedDomains:15,senderIdentities:25,monthlyAiUsage:5000,meetingTranscriptionHours:100,storageGb:500,contracts:500,clientPortals:100,researchRuns:1000},
 ENTERPRISE:{contacts:"custom",users:"custom",workspaces:"custom",campaigns:"custom",monthlyEmailSends:"custom",managedDomains:"custom",senderIdentities:"custom",monthlyAiUsage:"custom",meetingTranscriptionHours:"custom",storageGb:"custom",contracts:"custom",clientPortals:"custom",researchRuns:"custom"}
};
export function isWithinEntitlement(plan:SaaSPlanKey,key:EntitlementKey,usage:number,adminBypass=false){ if(adminBypass) return true; const limit=planEntitlements[plan][key]; return limit === "custom" || usage <= limit; }
