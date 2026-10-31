import {describe,expect,it} from "vitest";
import {publicAuthError} from "./authError";

describe("safe Firebase Auth errors",()=>{
  it("does not expose email enumeration or raw exception text in login",()=>{
    const codes=["auth/user-not-found","auth/wrong-password","auth/invalid-credential",
      "auth/user-disabled","auth/email-already-in-use"];
    for(const code of codes)
      expect(publicAuthError({code,message:"Firebase: sensitive debug info"},"login"))
        .toBe("Não foi possível entrar. Verifique e-mail e senha e tente novamente.");
    expect(publicAuthError(new Error("production secret"),"login")).not.toContain("production secret");
  });
  it("hides registration account-existence details and reset account existence",()=>{
    const registration=publicAuthError({code:"auth/email-already-in-use",message:"email exists"},"register");
    expect(registration).not.toContain("email exists");
    expect(registration).not.toContain("já cadastrado");
    const reset=publicAuthError({code:"auth/user-not-found",message:"not found"},"reset");
    expect(reset).not.toContain("not found");
    expect(reset).not.toContain("não existe");
  });
  it("offers actionable network, rate limit and malformed email feedback",()=>{
    expect(publicAuthError({code:"auth/network-request-failed"},"login")).toContain("conexão");
    expect(publicAuthError({code:"auth/too-many-requests"},"reset")).toContain("Muitas tentativas");
    expect(publicAuthError({code:"auth/invalid-email"},"reset")).toContain("e-mail válido");
    expect(publicAuthError({code:"auth/weak-password"},"register")).toContain("6 caracteres");
  });
});
