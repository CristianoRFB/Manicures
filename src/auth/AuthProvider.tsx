import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createUserWithEmailAndPassword, onAuthStateChanged, reload, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { getFirebaseServices } from "../lib/firebase";

interface AuthContextValue {
  configured: boolean;
  loading: boolean;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  registerCustomer: (email:string,password:string) => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  refreshVerifiedUser: () => Promise<boolean>;
  requestPasswordReset: (email:string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const services = getFirebaseServices();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(services));

  useEffect(() => {
    if (!services) {
      setLoading(false);
      setUser(null);
      return;
    }
    return onAuthStateChanged(services.auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
  }, [services?.auth]);

  const value = useMemo<AuthContextValue>(() => ({
    configured: Boolean(services),
    loading,
    user,
    signIn: async (email, password) => {
      if (!services) throw new Error("Firebase não configurado.");
      await signInWithEmailAndPassword(services.auth, email.trim(), password);
    },
    registerCustomer:async(email,password)=>{
      if(!services)throw new Error("Firebase não configurado.");
      const credentials=await createUserWithEmailAndPassword(services.auth,email.trim(),password);
      await sendEmailVerification(credentials.user);
    },
    sendVerificationEmail:async()=>{
      if(!services?.auth.currentUser)throw new Error("Entre em sua conta primeiro.");
      await sendEmailVerification(services.auth.currentUser);
    },
    refreshVerifiedUser:async()=>{
      if(!services?.auth.currentUser)return false;
      await reload(services.auth.currentUser);
      await services.auth.currentUser.getIdToken(true);
      setUser(services.auth.currentUser);
      return services.auth.currentUser.emailVerified;
    },
    requestPasswordReset:async(email)=>{
      if(!services)throw new Error("Firebase não configurado.");
      const normalized=email.trim();
      if(!normalized||!normalized.includes("@"))throw new Error("Informe o e-mail da conta.");
      await sendPasswordResetEmail(services.auth,normalized);
    },
    logout: async () => {
      if (!services) return;
      await signOut(services.auth);
    },
  }), [services, loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de AuthProvider");
  return ctx;
}
