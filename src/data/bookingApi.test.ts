import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import type {Service,Tenant} from "../domain/types";
import {createProtectedBooking,getProtectedAvailability,parseAvailableSlots,parseBookingReceipt} from "./bookingApi";

const date="2026-11-03";
const slot=date+"T14:00:00";
const input={
  tenant:{id:"tenant-a"} as Tenant,
  service:{id:"service-1"} as Service,
  professionalId:"pro-1",startsAt:slot,customerName:"Cliente Teste",
  customerPhone:"11912345678",
};
const appointment={id:"12345678-1234-1234-1234-123456789abc",
  tenantId:"tenant-a",serviceId:"service-1",professionalId:"pro-1",
  startsAt:slot,endsAt:date+"T15:00:00",
  priceSnapshotCents:4000,durationSnapshotMin:60,status:"pending"};

describe("booking API response validation",()=>{
  beforeEach(()=>vi.stubEnv("VITE_BOOKING_API_BASE_URL","http://worker.local"));
  afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});

  it("accepts only current-day unique valid slot arrays",()=>{
    expect(parseAvailableSlots({slots:[slot,date+"T15:00:00"]},date)).toEqual([slot,date+"T15:00:00"]);
    expect(parseAvailableSlots({slots:[]},date)).toEqual([]);
    for(const body of [{},{slots:null},{slots:"bad"},{slots:[slot,slot]},
      {slots:[date+"T25:10:00"]},{slots:["2026-11-04T14:00:00"]},
      {slots:Array.from({length:145},()=>slot)}])
      expect(()=>parseAvailableSlots(body,date)).toThrow("horários inválidos");
  });

  it("rejects receipts with wrong tenant, date, service or snapshots",()=>{
    expect(parseBookingReceipt({appointment},input)).toMatchObject(appointment);
    for(const replacement of [
      {tenantId:"tenant-b"},{professionalId:"pro-2"},{serviceId:"service-2"},
      {startsAt:date+"T16:00:00"},{priceSnapshotCents:-20},
      {durationSnapshotMin:"60"},{status:"cancelled"},{id:""},
    ]) expect(()=>parseBookingReceipt({appointment:{...appointment,...replacement}},input))
      .toThrow("comprovante não corresponde");
    expect(()=>parseBookingReceipt({error:"something"},input))
      .toThrow("Não foi possível validar o comprovante");
  });

  it("does not convert malformed HTTP 200 availability into a false empty day",async()=>{
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(
      new Response(JSON.stringify({bad:"schema"}),{status:200,headers:{"content-type":"application/json"}})));
    await expect(getProtectedAvailability({tenantId:"tenant-a",serviceId:"service-1",
      professionalId:"pro-1",date})).rejects.toThrow("horários inválidos");
  });

  it("preserves explicit API errors on non-2xx without treating malformed responses as success",async()=>{
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(
      new Response(JSON.stringify({error:"Horário indisponível."}),{status:409,
        headers:{"content-type":"application/json"}})));
    await expect(createProtectedBooking(input)).rejects.toThrow("Horário indisponível.");
  });

  it("does not claim booking failure if HTTP 201 succeeded but receipt was wrong",async()=>{
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(
      new Response(JSON.stringify({appointment:{...appointment,tenantId:"tenant-b"}}),
        {status:201,headers:{"content-type":"application/json"}})));
    await expect(createProtectedBooking(input)).rejects.toThrow("Consulte o studio");
  });

  it("returns validated receipt on successful booking",async()=>{
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(
      new Response(JSON.stringify({appointment}),{status:201,
        headers:{"content-type":"application/json"}})));
    await expect(createProtectedBooking(input)).resolves.toMatchObject(appointment);
  });
});
