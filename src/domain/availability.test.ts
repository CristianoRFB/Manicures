import { describe, expect, it } from "vitest";
import { addMinutes, createSlots } from "./availability";
import type { Appointment, Professional, Service } from "./types";

const service: Service = { id: "s", tenantId: "t", name: "Serviço", description: "", priceCents: 1000, durationMin: 60, active: true };
const professional: Professional = { id: "p", tenantId: "t", name: "Profissional", active: true, serviceIds: ["s"] };

describe("availability", () => {
  it("normalizes midnight across calendar days and leap years",()=>{
    expect(addMinutes("2026-11-03T22:00:00",120)).toBe("2026-11-04T00:00:00");
    expect(addMinutes("2028-02-29T23:30:00",60)).toBe("2028-03-01T00:30:00");
  });
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
  it("não oferece 11:30 para serviço que atravessa a pausa das 12h", () => {
    const slots = createSlots("2026-10-28", service, professional, []);
    expect(slots).not.toContain("2026-10-28T11:30:00");
    expect(slots).not.toContain("2026-10-28T12:00:00");
    expect(slots).toContain("2026-10-28T13:00:00");
  });

});
