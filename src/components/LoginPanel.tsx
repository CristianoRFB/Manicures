import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";

export function LoginPanel({ title }: { title: string }) {
  const { configured, signIn, requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  if (!configured) {
    return (
      <section className="page narrow">
        <div className="badge">FIREBASE REQUIRED</div>
        <h1>{title}</h1>
        <p>Configure o Firebase pelo <code>.env</code> ou use a Emulator Suite. Sessão privada fake foi removida.</p>
      </section>
    );
  }

  return (
    <section className="page narrow">
      <div className="badge">FIREBASE AUTH</div>
      <h1>{title}</h1>
      <form className="form" onSubmit={async (event) => {
        event.preventDefault();
        setMessage("");
        try {
          await signIn(email, password);
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Falha no login.");
        }
      }}>
        <label>E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Senha<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        <button className="button primary" type="submit">Entrar</button>
        <button className="button" type="button" onClick={async()=>{
          try{
            await requestPasswordReset(email);
            setMessage("Se a conta estiver cadastrada, você receberá instruções oficiais de recuperação por e-mail.");
          }catch(error){setMessage(error instanceof Error?error.message:"Falha ao solicitar recuperação.");}
        }}>Esqueci minha senha</button>
      </form>
      {message && <div className="callout">{message}</div>}
    </section>
  );
}
