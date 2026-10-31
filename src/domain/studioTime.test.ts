import {describe,expect,it} from "vitest";
import {studioLocalInstant,validStudioBookingInterval} from "./studioTime";
const allowed=(startsAt:string,endsAt:string,nowMs:number,minLeadMinutes=60,timeZone="America/New_York")=>
  validStudioBookingInterval({startsAt,endsAt,durationMin:60,timeZone,nowMs,bookingHorizonDays:45,minLeadMinutes});
describe("studio civil time",()=>{
  it("resolves Brazil and fractional offsets",()=>{
    expect(new Date(studioLocalInstant("2026-11-03T14:00:00","America/Sao_Paulo")!).toISOString())
      .toBe("2026-11-03T17:00:00.000Z");
    expect(new Date(studioLocalInstant("2026-11-03T14:00:00","Asia/Kathmandu")!).toISOString())
      .toBe("2026-11-03T08:15:00.000Z");
  });
  it("rejects DST gaps, repeated hour, invalid days and zones",()=>{
    expect(studioLocalInstant("2026-03-08T02:30:00","America/New_York")).toBeNull();
    expect(studioLocalInstant("2026-11-01T01:30:00","America/New_York")).toBeNull();
    expect(studioLocalInstant("2026-02-30T10:00:00","America/Sao_Paulo")).toBeNull();
    expect(studioLocalInstant("2026-11-03T14:00:00","Mars/Invalid")).toBeNull();
  });
  it("enforces actual lead time over spring DST rather than wall clock difference",()=>{
    const now=Date.parse("2026-03-08T06:30:00Z");
    expect(allowed("2026-03-08T03:30:00","2026-03-08T04:30:00",now,90)).toBe(false);
    expect(allowed("2026-03-08T03:30:00","2026-03-08T04:30:00",now,60)).toBe(true);
    expect(allowed("2026-03-08T01:30:00","2026-03-08T02:30:00",
      Date.parse("2026-03-07T06:30:00Z"))).toBe(false);
  });
  it("rejects ambiguous autumn slots, preserves unique post-transition time",()=>{
    const now=Date.parse("2026-10-31T12:00:00Z");
    expect(allowed("2026-11-01T01:30:00","2026-11-01T02:30:00",now)).toBe(false);
    expect(allowed("2026-11-01T02:30:00","2026-11-01T03:30:00",now)).toBe(true);
  });
  it("rejects invalid horizon configuration instead of opening time window",()=>{
    expect(validStudioBookingInterval({startsAt:"2026-11-03T14:00:00",
      endsAt:"2026-11-03T15:00:00",durationMin:60,timeZone:"America/Sao_Paulo",
      nowMs:Date.parse("2026-11-03T14:00:00Z"),bookingHorizonDays:0,minLeadMinutes:60})).toBe(false);
  });
});
