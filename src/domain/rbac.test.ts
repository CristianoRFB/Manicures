import { describe, expect, it } from "vitest";
import { can } from "./rbac";

describe("rbac", () => {
  it("platform owner administra tenants", () => expect(can("platform_owner", "platform:manage-tenants")).toBe(true));
  it("customer não administra tenant", () => expect(can("customer", "tenant:manage")).toBe(false));
});
