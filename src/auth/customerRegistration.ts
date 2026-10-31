/** An Auth account is persistent even if the outgoing confirmation email fails.
 * Never report a successfully created account as a failed registration.
 */
export async function createAccountWithVerification<T>(
  createAccount:()=>Promise<T>,sendVerification:(created:T)=>Promise<void>
):Promise<{verificationSent:boolean}>{
  const created=await createAccount();
  try{
    await sendVerification(created);
    return {verificationSent:true};
  }catch{
    return {verificationSent:false};
  }
}
