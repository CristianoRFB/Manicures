import type { Tenant } from "../domain/types";
import type { Repository } from "../data/repository";

export async function resolveTenant(repo: Repository, slug: string | undefined): Promise<Tenant | null> {
  if (!slug) return null;
  const normalized = slug.trim().toLowerCase();
  if (!normalized || ["app", "platform", "api"].includes(normalized)) return null;
  const tenant = await repo.getTenantBySlug(normalized);
  if (!tenant || tenant.status !== "active") return null;
  return tenant;
}
