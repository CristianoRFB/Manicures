import { describe, expect, it } from "vitest";
import { localCalendarDate, studioCalendarDate } from "./localCalendarDate";

describe("localCalendarDate", () => {
  it("does not shift the selected day through UTC late at night", () => {
    expect(localCalendarDate(0, new Date(2026, 9, 30, 23, 45))).toBe("2026-10-30");
    expect(localCalendarDate(1, new Date(2026, 9, 30, 23, 45))).toBe("2026-10-31");
  });
  it("rolls over months, years and leap days", () => {
    expect(localCalendarDate(1, new Date(2026, 11, 31, 23, 30))).toBe("2027-01-01");
    expect(localCalendarDate(1, new Date(2028, 1, 28, 23, 30))).toBe("2028-02-29");
  });
  it("rejects invalid inputs", () => {
    expect(() => localCalendarDate(Number.NaN)).toThrow("Data inválida.");
    expect(() => localCalendarDate(0, new Date(Number.NaN))).toThrow("Data inválida.");
  });
});

describe("studioCalendarDate", () => {
  it("uses studio timezone even when the visitor is across the world", () => {
    const instant=new Date("2026-11-01T01:30:00Z");
    expect(studioCalendarDate("America/Sao_Paulo",0,instant)).toBe("2026-10-31");
    expect(studioCalendarDate("Asia/Tokyo",0,instant)).toBe("2026-11-01");
    expect(studioCalendarDate("America/Sao_Paulo",1,instant)).toBe("2026-11-01");
  });
  it("handles leap days and DST calendar transitions", () => {
    expect(studioCalendarDate("America/Sao_Paulo",1,new Date("2028-02-28T15:00:00Z"))).toBe("2028-02-29");
    expect(studioCalendarDate("America/New_York",1,new Date("2026-03-08T06:30:00Z"))).toBe("2026-03-09");
  });
  it("rejects invalid timezone and inputs", () => {
    expect(() => studioCalendarDate("Mars/Phobos")).toThrow();
    expect(() => studioCalendarDate("UTC", 1.5)).toThrow("Data inválida.");
  });
});
