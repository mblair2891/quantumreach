export const rolePermissions = {
  PLATFORM_OWNER: ["*:*"] as const,
  WORKSPACE_OWNER: ["*:*"] as const,
  OWNER: ["*:*"] as const,
  ADMIN: ["read:*", "write:*", "manage:workspace", "manage:users", "manage:domains", "manage:integrations", "manage:campaigns", "manage:crm"] as const,
  MANAGER: ["read:*", "write:*", "manage:crm"] as const,
  STRATEGIST: ["read:*", "write:diagnostics", "write:analysis", "write:reports"] as const,
  SALES_REP: ["read:crm", "write:crm", "read:outreach", "write:outreach", "read:meetings", "write:meetings", "read:proposals", "write:proposals"] as const,
  SALES: ["read:crm", "write:crm", "read:outreach", "write:outreach", "read:meetings", "write:meetings", "read:proposals", "write:proposals"] as const,
  CONSULTANT: ["read:meetings", "write:meetings", "read:analysis", "write:analysis", "read:reports", "write:reports", "read:delivery", "write:delivery"] as const,
  OPERATIONS: ["read:imports", "write:imports", "read:campaigns", "write:campaigns", "read:domains", "write:domains", "read:onboarding", "write:onboarding", "read:tasks", "write:tasks"] as const,
  DELIVERY: ["read:*", "write:projects", "write:delivery"] as const,
  VIEWER: ["read:*"] as const,
  CLIENT: ["read:portal"] as const,
} as const;
export type WorkspaceRole = keyof typeof rolePermissions;
export function can(roleKey: WorkspaceRole, action: string, subject: string) { const grants: readonly string[] = rolePermissions[roleKey]; return grants.includes("*:*") || grants.includes(`${action}:*`) || grants.includes(`${action}:${subject}`); }
export function canAccessDashboard(roleKey: string) { return roleKey !== "CLIENT"; }
export function canAccessClientPortal(roleKey: string) { return roleKey === "CLIENT"; }
