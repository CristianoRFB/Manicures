import {describe,expect,it} from "vitest";
import {applyConfirmedAppointmentStatus} from "./appointmentStatus";
import type {Appointment} from "./types";
describe("professional status receipt",()=>{
  it("updates only the matching appointment and keeps other appointments untouched",()=>{
    const rows=[{id:"one",status:"pending",tenantId:"a"},
      {id:"two",status:"confirmed",tenantId:"a"}] as Appointment[];
    const updated=applyConfirmedAppointmentStatus(rows,"one","confirmed");
    expect(updated.map(x=>x.status)).toEqual(["confirmed","confirmed"]);
    expect(rows[0].status).toBe("pending");
    expect(updated[1]).toBe(rows[1]);
  });
});
