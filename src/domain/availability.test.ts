import { describe, expect, it } from "vitest";
import { addMinutes, createSlots } from "./availability";
import type { Appointment, Professional, Service } from "./types";

const service: Service = { id: "s", tenantId: "t", name: "Serviço", description: "", priceCents: 1000, durationMin: 60, active: true };
const professional: Professional = { id: "p", tenantId: "t", name: "Profissional", active: true, serviceIds: ["s"] };

describe("availability", () => {
  it("applies professional weekly hours, closed days and breaks like the Worker",()=>{
    const own:Professional={...professional,weeklyHours:{
      "3":{closed:false,startMinute:600,endMinute:900,breakStartMinute:720,breakEndMinute:780},
      "4":{closed:true,startMinute:600,endMinute:900,breakStartMinute:720,breakEndMinute:780},
    }};
    const wednesday=createSlots("2026-11-04",service,own,[]);
    expect(wednesday[0]).toBe("2026-11-04T10:00:00");
    expect(wednesday).toContain("2026-11-04T13:00:00");
    expect(wednesday).not.toContain("2026-11-04T12:00:00");
    expect(wednesday).not.toContain("2026-11-04T09:00:00");
    expect(wednesday).not.toContain("2026-11-04T15:00:00");
    expect(createSlots("2026-11-05",service,own,[])).toEqual([]);
    // 2026-11-04 is Wednesday (3), 2026-11-05 is Thursday (4).
  });

  it("rejects invalid schedules, duration and cross-tenant references",()=>{
    const broken:Professional={...professional,weeklyHours:{
      "3":{closed:false,startMinute:1300,endMinute:1200,breakStartMinute:1100,breakEndMinute:1150},
    }};
    expect(createSlots("2026-11-04",service,broken,[])).toEqual([]);
    expect(createSlots("2026-11-04",{...service,durationMin:0},professional,[])).toEqual([]);
    expect(createSlots("2026-11-04",{...service,tenantId:"b"},professional,[])).toEqual([]);
    expect(createSlots("2026-02-30",service,professional,[])).toEqual([]);
  });

  it("blocks an appointment crossing from the previous day and ignores foreign or cancelled bookings",()=>{
    const candidate="2026-11-04T09:00:00";
    const appointment:Appointment={
      id:"night",tenantId:"t",customerName:"Cliente",customerPhone:"0",
      professionalId:"p",serviceId:"s",status:"confirmed",
      startsAt:"2026-11-03T23:30:00",endsAt:"2026-11-04T09:30:00",
      priceSnapshotCents:1000,durationSnapshotMin:60,createdAt:"",updatedAt:"",
    };
    expect(createSlots("2026-11-04",service,professional,[appointment])).not.toContain(candidate);
    expect(createSlots("2026-11-04",service,professional,[{...appointment,status:"cancelled"}])).toContain(candidate);
    expect(createSlots("2026-11-04",service,professional,[{...appointment,tenantId:"other"}])).toContain(candidate);
  });

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
