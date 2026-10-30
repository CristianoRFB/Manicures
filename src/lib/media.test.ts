import {describe,expect,it} from "vitest";
import {fitPortfolioDimensions,validatePortfolioSource} from "./media";

describe("browser portfolio media security and budget",()=>{
  it("accepts only supported image MIME and file size",()=>{
    expect(()=>validatePortfolioSource({type:"image/jpeg",size:1024})).not.toThrow();
    expect(()=>validatePortfolioSource({type:"image/png",size:5*1024*1024})).not.toThrow();
    expect(()=>validatePortfolioSource({type:"application/pdf",size:1024})).toThrow();
    expect(()=>validatePortfolioSource({type:"image/webp",size:0})).toThrow();
    expect(()=>validatePortfolioSource({type:"image/webp",size:5*1024*1024+1})).toThrow();
  });
  it("limits edge to 1920 while preserving aspect ratio",()=>{
    expect(fitPortfolioDimensions(4000,2000)).toEqual({width:1920,height:960});
    expect(fitPortfolioDimensions(1000,500)).toEqual({width:1000,height:500});
    expect(fitPortfolioDimensions(1500,3000)).toEqual({width:960,height:1920});
  });
  it("rejects zero dimensions, invalid numbers and excessive pixel count",()=>{
    expect(()=>fitPortfolioDimensions(0,100)).toThrow();
    expect(()=>fitPortfolioDimensions(Infinity,200)).toThrow();
    expect(()=>fitPortfolioDimensions(10000,10000)).toThrow();
  });
});
