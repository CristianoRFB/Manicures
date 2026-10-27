import {describe,expect,it} from "vitest";
import {parseBRLToCents} from "./currency";
describe("Valores BRL em serviços",()=>{
 it("interpreta centavos corretamente sem float rounding",()=>{
  expect(parseBRLToCents("49,90")).toBe(4990);
  expect(parseBRLToCents("49.90")).toBe(4990);
  expect(parseBRLToCents("5,5")).toBe(550);
  expect(parseBRLToCents("120")).toBe(12000);
  expect(parseBRLToCents(" 0,01 ")).toBe(1);
 });
 it("nega formatos ambíguos e valores inválidos",()=>{
  for(const value of ["1.000,00","49,999","-1,00","NaN"," ","1e5","12,34.56"])
   expect(()=>parseBRLToCents(value)).toThrow();
 });
});
