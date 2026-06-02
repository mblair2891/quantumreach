export const rolePermissions = {
  PLATFORM_OWNER: ["*:*"] as const,
  WORKSPACE_OWNER: ["*:*"] as const,
  ADMIN: ["*:*"] as const,
  MANAGER: ["read:*", "write:*", "manage:crm"] as const,
  STRATEGIST: ["read:*", "write:diagnostics", "write:analysis", "write:reports"] as const,
  SALES_REP: ["read:crm", "write:crm"] as const,
  DELIVERY: ["read:*", "write:projects"] as const,
  VIEWER: ["read:*"] as const
} as const;

export type WorkspaceRole = keyof typeof rolePermissions;

export function can(roleKey: WorkspaceRole, action: string, subject: string) {
  const grants: readonly string[] = rolePermissions[roleKey];
  return grants.includes("*:*") || grants.includes(`${action}:*`) || grants.includes(`${action}:${subject}`);
}
