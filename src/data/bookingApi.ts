import type { Appointment, Service, Tenant } from "../domain/types";

interface CreateBookingInput {
  tenant: Tenant;
  service: Service;
  professionalId: string;
  startsAt: string;
  customerName: string;
  customerPhone: string;
  authToken?: string;
}

export async function createProtectedBooking(input: CreateBookingInput): Promise<Appointment> {
  const baseUrl = import.meta.env.VITE_BOOKING_API_BASE_URL;
  if (!baseUrl) throw new Error("Booking API não configurada.");
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/bookings`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(input.authToken?{authorization:`Bearer ${input.authToken}`}:{}) },
    body: JSON.stringify({
      tenantId: input.tenant.id,
      serviceId: input.service.id,
      professionalId: input.professionalId,
      startsAt: input.startsAt,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
    }),
  });
  const payload = await response.json().catch(() => ({})) as { appointment?: Appointment; error?: string };
  if (!response.ok || !payload.appointment) throw new Error(payload.error ?? "Não foi possível confirmar o horário.");
  return payload.appointment;
}

export async function getProtectedAvailability(params:{tenantId:string;serviceId:string;professionalId:string;date:string}):Promise<string[]> {
  const base=import.meta.env.VITE_BOOKING_API_BASE_URL;
  if(!base)throw new Error("Booking API não configurada.");
  const query=new URLSearchParams(params);
  const response=await fetch(`${base.replace(/\/$/,"")}/api/availability?${query.toString()}`);
  const data=await response.json().catch(()=>({})) as {error?:string;slots?:string[]};
  if(!response.ok) throw new Error(data.error ?? "Não foi possível obter horários disponíveis.");
  return data.slots ?? [];
}
