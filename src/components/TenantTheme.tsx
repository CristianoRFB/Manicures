import type { CSSProperties, ReactNode } from "react";
import type { Tenant } from "../domain/types";

export function TenantTheme({ tenant, children }: { tenant: Tenant; children: ReactNode }) {
  const style = {
    "--tenant-primary": tenant.branding.primary,
    "--tenant-accent": tenant.branding.accent,
    "--tenant-background": tenant.branding.background,
  } as CSSProperties;
  return <div style={style} className="tenant-theme">{children}</div>;
}
