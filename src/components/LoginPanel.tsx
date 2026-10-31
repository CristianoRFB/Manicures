import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { publicAuthError } from "../lib/authError";

export function LoginPanel({ title }: { title: string }) {
  const { configured, signIn, requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!configured) {
    return (
      <section className="page narrow">
        <div className="badge">FIREBASE REQUIRED</div>
        <h1>{title}</h1>
        <p>Configure o Firebase pelo <code>.env</code> ou use a Emulator Suite. Sessão privada fake foi removida.</p>
      </section>
    );
  }

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);setMessage("");setIsError(false);
    try { await signIn(email,password); }
    catch (error) { setMessage(publicAuthError(error,"login"));setIsError(true); }
    finally { setBusy(false); }
  }
  async function resetPassword() {
    if (busy) return;
    setBusy(true);setMessage("");setIsError(false);
    try {
      await requestPasswordReset(email);
      setMessage("Se a conta estiver cadastrada, você receberá instruções oficiais de recuperação por e-mail.");
    } catch(error) {
      setMessage(publicAuthError(error,"reset"));setIsError(true);
    } finally {setBusy(false);}
  }

  return (
    <section className="page narrow">
      <div className="badge">FIREBASE AUTH</div>
      <h1>{title}</h1>
      <form className="form" onSubmit={event=>void login(event)} aria-busy={busy}>
        <label>E-mail<input type="email" autoComplete="email" value={email} disabled={busy}
          onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Senha<input type="password" autoComplete="current-password" value={password} disabled={busy}
          onChange={(e) => setPassword(e.target.value)} required /></label>
        <button className="button primary" type="submit" disabled={busy}>{busy?"Entrando…":"Entrar"}</button>
        <button className="button" type="button" disabled={busy}
          onClick={()=>void resetPassword()}>Esqueci minha senha</button>
      </form>
      {message && <div className="callout" role={isError?"alert":"status"}>{message}</div>}
    </section>
  );
}
