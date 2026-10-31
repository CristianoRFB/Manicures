import { describe, expect, it } from "vitest";
import { localCalendarDate } from "./localCalendarDate";

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
