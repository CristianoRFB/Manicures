import { describe, expect, it } from "vitest";
import { createSlots } from "./availability";
import type { Appointment, Professional, Service } from "./types";

const service: Service = { id: "s", tenantId: "t", name: "Serviço", description: "", priceCents: 1000, durationMin: 60, active: true };
const professional: Professional = { id: "p", tenantId: "t", name: "Profissional", active: true, serviceIds: ["s"] };

describe("availability", () => {
  it("remove almoço e conflito ativo", () => {
    const appointments: Appointment[] = [{
      id: "a", tenantId: "t", customerName: "X", customerPhone: "0", professionalId: "p", serviceId: "s",
      startsAt: "2026-10-10T14:00:00", endsAt: "2026-10-10T15:00:00", priceSnapshotCents: 1000, durationSnapshotMin: 60,
      status: "confirmed", createdAt: "", updatedAt: "",
    }];
    const slots = createSlots("2026-10-10", service, professional, appointments);
    expect(slots).not.toContain("2026-10-10T12:00:00");
    expect(slots).not.toContain("2026-10-10T14:00:00");
    expect(slots).toContain("2026-10-10T09:00:00");
  });
});
