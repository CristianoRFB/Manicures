import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Role } from "../domain/types";

interface Session {
  userId: string;
  role: Role;
  tenantId?: string;
  displayName: string;
}

interface DemoSessionContextValue {
  session: Session | null;
  loginAsTenantOwner: () => void;
  loginAsPlatformOwner: () => void;
  logout: () => void;
}

const DemoSessionContext = createContext<DemoSessionContextValue | null>(null);

export function DemoSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);

  const value = useMemo<DemoSessionContextValue>(() => ({
    session,
    loginAsTenantOwner: () => setSession({ userId: "demo-owner", role: "tenant_owner", tenantId: "tenant-demo", displayName: "Owner Demo" }),
    loginAsPlatformOwner: () => setSession({ userId: "demo-platform", role: "platform_owner", displayName: "Platform Owner Demo" }),
    logout: () => setSession(null),
  }), [session]);

  return <DemoSessionContext.Provider value={value}>{children}</DemoSessionContext.Provider>;
}

export function useDemoSession() {
  const ctx = useContext(DemoSessionContext);
  if (!ctx) throw new Error("useDemoSession precisa estar dentro de DemoSessionProvider");
  return ctx;
}
