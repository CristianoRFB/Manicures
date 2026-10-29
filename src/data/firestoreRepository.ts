import { addDoc, collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import type { Appointment, AuditLog, Membership, Professional, Service, ScheduleBlock, Tenant } from "../domain/types";
import { getFirebaseServices } from "../lib/firebase";
import type { Repository } from "./repository";

function dbOrThrow() {
  const services = getFirebaseServices();
  if (!services) throw new Error("Firebase não configurado.");
  return services.db;
}

function withId<T>(id: string, data: unknown): T {
  return { id, ...(data as object) } as T;
}

export class FirestoreRepository implements Repository {
  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    const db = dbOrThrow();
    const slugSnapshot = await getDoc(doc(db, "tenantSlugs", slug));
    if (!slugSnapshot.exists() || slugSnapshot.data().status !== "active") return null;
    const tenantId = slugSnapshot.data().tenantId as string;
    const tenantSnapshot = await getDoc(doc(db, "tenants", tenantId));
    if (!tenantSnapshot.exists()) return null;
    return withId<Tenant>(tenantSnapshot.id, tenantSnapshot.data());
  }

  async listTenants(): Promise<Tenant[]> {
    const snapshot = await getDocs(collection(dbOrThrow(), "tenants"));
    return snapshot.docs.map((item) => withId<Tenant>(item.id, item.data()));
  }

  async createService(tenantId: string, input: Pick<Service, "name" | "description" | "priceCents" | "durationMin">): Promise<Service> {
    const name=input.name.trim();
    if (name.length<2 || name.length>100 || !Number.isInteger(input.priceCents) || input.priceCents<0 ||
        !Number.isInteger(input.durationMin) || input.durationMin<15 || input.durationMin>480)
      throw new Error("Serviço inválido: confira nome, valor e duração.");
    const record={tenantId,name,description:input.description.trim().slice(0,400),
      priceCents:input.priceCents,durationMin:input.durationMin,active:true};
    const ref=await addDoc(collection(dbOrThrow(),"tenants",tenantId,"services"),record);
    return {id:ref.id,...record};
  }

  async listServices(tenantId: string, options?: {includeInactive?: boolean}): Promise<Service[]> {
    const collectionRef=collection(dbOrThrow(),"tenants",tenantId,"services");
    const snapshot=await getDocs(options?.includeInactive ? collectionRef : query(collectionRef,where("active","==",true)));
    return snapshot.docs.map(item=>withId<Service>(item.id,item.data()));
  }

  async updateService(tenantId:string,serviceId:string,change:Pick<Service,"name"|"description"|"priceCents"|"durationMin"|"active">):Promise<void>{
    const name=change.name.trim();
    if(name.length<2 || name.length>100 || !Number.isSafeInteger(change.priceCents) || change.priceCents<0 ||
      !Number.isSafeInteger(change.durationMin) || change.durationMin<15 || change.durationMin>480 ||
      typeof change.active!=="boolean") throw new Error("Dados de serviço inválidos.");
    await updateDoc(doc(dbOrThrow(),"tenants",tenantId,"services",serviceId),{
      tenantId,name,description:change.description.trim().slice(0,400),
      priceCents:change.priceCents,durationMin:change.durationMin,active:change.active,
    });
  }

  async listProfessionals(tenantId: string, options?: {includeInactive?: boolean}): Promise<Professional[]> {
    const records = collection(dbOrThrow(), "tenants", tenantId, "professionals");
    const snapshot = await getDocs(options?.includeInactive ? records : query(records,where("active","==",true)));
    return snapshot.docs.map((item) => withId<Professional>(item.id, item.data()));
  }

  async listScheduleBlocks(tenantId:string):Promise<ScheduleBlock[]>{
    const snapshot=await getDocs(collection(dbOrThrow(),"tenants",tenantId,"scheduleBlocks"));
    return snapshot.docs.map(item=>withId<ScheduleBlock>(item.id,item.data()));
  }

  async listAppointmentsForCustomer(tenantId:string,customerId:string):Promise<Appointment[]>{
    const appointments=collection(dbOrThrow(),"tenants",tenantId,"appointments");
    const snapshot=await getDocs(query(appointments,where("customerId","==",customerId)));
    return snapshot.docs.map(item=>withId<Appointment>(item.id,item.data()));
  }

  async listAppointmentsForProfessional(tenantId:string,professionalId:string):Promise<Appointment[]>{
    const appointments=collection(dbOrThrow(),"tenants",tenantId,"appointments");
    const snapshot=await getDocs(query(appointments,where("professionalId","==",professionalId)));
    return snapshot.docs.map(item=>withId<Appointment>(item.id,item.data()));
  }

  async listAppointments(tenantId: string): Promise<Appointment[]> {
    const snapshot = await getDocs(collection(dbOrThrow(), "tenants", tenantId, "appointments"));
    return snapshot.docs.map((item) => withId<Appointment>(item.id, item.data()));
  }

  async getMembership(tenantId: string, userId: string): Promise<Membership | null> {
    const snapshot = await getDoc(doc(dbOrThrow(), "memberships", `${tenantId}_${userId}`));
    return snapshot.exists() ? withId<Membership>(snapshot.id, snapshot.data()) : null;
  }

  async isPlatformOwner(userId: string): Promise<boolean> {
    const snapshot = await getDoc(doc(dbOrThrow(), "platformUsers", userId));
    return snapshot.exists() && snapshot.data().role === "platform_owner" && snapshot.data().status !== "disabled";
  }

  async recordAuditLog(log: AuditLog): Promise<void> {
    await setDoc(doc(dbOrThrow(), "tenants", log.tenantId, "auditLogs", log.id), log);
  }
}
