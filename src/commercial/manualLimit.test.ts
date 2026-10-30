import {describe,expect,it} from "vitest";
import {parseManualLimit} from "./manualLimit";

describe("approved plan manual override parser",()=>{
  it("accepts the documented integer range and blank inherits",()=>{
    expect(parseManualLimit("")).toBeUndefined();
    expect(parseManualLimit("  ")).toBeUndefined();
    expect(parseManualLimit("0")).toBe(0);
    expect(parseManualLimit(" 5 ")).toBe(5);
    expect(parseManualLimit("9999")).toBe(9999);
  });
  it("never accepts escaped literal backslashes, letters, negatives or quotas beyond range",()=>{
    for(const bad of ["12345","-1","1.5","12px","1e3",String.raw`\d{1,4}`,"NaN"]){
      expect(()=>parseManualLimit(bad)).toThrow();
    }
  });
});
