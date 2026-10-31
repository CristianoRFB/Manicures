import {describe,expect,it,vi} from "vitest";
import {createAccountWithVerification} from "./customerRegistration";
describe("customer account creation and verification outcome",()=>{
  it("reports a created account even when delivery of verification fails",async()=>{
    const create=vi.fn().mockResolvedValue({uid:"uid-123"});
    const send=vi.fn().mockRejectedValue(new Error("rate-limited"));
    await expect(createAccountWithVerification(create,send)).resolves.toEqual({verificationSent:false});
    expect(create).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith({uid:"uid-123"});
  });
  it("only reports verificationSent when verification request succeeded",async()=>{
    await expect(createAccountWithVerification(async()=>({uid:"x"}),async()=>undefined))
      .resolves.toEqual({verificationSent:true});
  });
  it("still propagates failed account creation and never requests a verification email",async()=>{
    const send=vi.fn();
    await expect(createAccountWithVerification(async()=>{throw new Error("creation failed");},send))
      .rejects.toThrow("creation failed");
    expect(send).not.toHaveBeenCalled();
  });
});
