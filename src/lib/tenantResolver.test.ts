import { describe, expect, it } from "vitest";
import { DemoRepository } from "../data/repository";
import { resolveTenant } from "./tenantResolver";

describe("tenant resolver", () => {
  const repo = new DemoRepository();
  it("resolve demo", async () => expect((await resolveTenant(repo, "demo"))?.id).toBe("tenant-demo"));
  it("rejeita rota reservada", async () => expect(await resolveTenant(repo, "platform")).toBeNull());
  it("rejeita slug inexistente", async () => expect(await resolveTenant(repo, "nao-existe")).toBeNull());
});
