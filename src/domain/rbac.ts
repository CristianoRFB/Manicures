import type { Role } from "./types";

export type Permission =
  | "platform:manage-tenants"
  | "tenant:manage"
  | "tenant:view-agenda"
  | "tenant:manage-availability"
  | "customer:book";

const permissions: Record<Role, Permission[]> = {
  platform_owner: ["platform:manage-tenants", "tenant:manage", "tenant:view-agenda", "tenant:manage-availability", "customer:book"],
  tenant_owner: ["tenant:manage", "tenant:view-agenda", "tenant:manage-availability", "customer:book"],
  tenant_admin: ["tenant:manage", "tenant:view-agenda", "tenant:manage-availability", "customer:book"],
  professional: ["tenant:view-agenda", "tenant:manage-availability", "customer:book"],
  customer: ["customer:book"],
};

export function can(role: Role, permission: Permission): boolean {
  return permissions[role].includes(permission);
}
