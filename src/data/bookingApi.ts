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

const SLOT_PATTERN = /^\\d{4}-\\d{2}-\\d{2}T(?:[01]\\d|2[0-3]):[0-5]\\d:00$/;

function apiError(body: unknown, fallback: string): string {
  if (body !== null && typeof body === "object" && "error" in body) {
    const error = (body as {error?:unknown}).error;
    if (typeof error === "string" && error.length <= 300 && error.trim()) return error;
  }
  return fallback;
}

/** Reject malformed or cross-request responses instead of showing slots from another day. */
export function parseAvailableSlots(body: unknown, requestedDate: string): string[] {
  const slots = body !== null && typeof body === "object" && "slots" in body
    ? (body as {slots?:unknown}).slots : undefined;
  if (!Array.isArray(slots) || slots.length > 144 ||
      slots.some(item=>typeof item !== "string" || !SLOT_PATTERN.test(item) ||
        !item.startsWith(requestedDate+"T")) ||
      new Set(slots).size !== slots.length) {
    throw new Error("A API retornou horários inválidos. Atualize os horários antes de reservar.");
  }
  return slots as string[];
}

/** A booking may already be stored if a successful response is malformed.
 * Never invite the visitor to retry blindly after HTTP 2xx.
 */
export function parseBookingReceipt(body: unknown, input: CreateBookingInput): Appointment {
  const appointment = body !== null && typeof body === "object" && "appointment" in body
    ? (body as {appointment?:unknown}).appointment : undefined;
  if (!appointment || typeof appointment !== "object") {
    throw new Error("Não foi possível validar o comprovante. Consulte o studio antes de tentar reservar novamente.");
  }
  const record = appointment as Record<string,unknown>;
  const good =
    typeof record.id==="string" && /^[A-Za-z0-9_-]{1,128}$/.test(record.id) &&
    record.tenantId===input.tenant.id && record.serviceId===input.service.id &&
    record.professionalId===input.professionalId && record.startsAt===input.startsAt &&
    typeof record.endsAt==="string" && SLOT_PATTERN.test(record.endsAt) &&
    record.endsAt > input.startsAt &&
    Number.isSafeInteger(record.priceSnapshotCents) && Number(record.priceSnapshotCents)>=0 &&
    Number.isSafeInteger(record.durationSnapshotMin) &&
    Number(record.durationSnapshotMin)>=15 && Number(record.durationSnapshotMin)<=480 &&
    record.status==="pending";
  if(!good)throw new Error("O comprovante não corresponde à solicitação. Consulte o studio antes de tentar reservar novamente.");
  return record as unknown as Appointment;
}

export async function createProtectedBooking(input: CreateBookingInput): Promise<Appointment> {
  const baseUrl = import.meta.env.VITE_BOOKING_API_BASE_URL;
  if (!baseUrl) throw new Error("Booking API não configurada.");
  const response = await fetch(`${baseUrl.replace(/\\/$/, "")}/api/bookings`, {
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
  const payload:unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(apiError(payload, "Não foi possível confirmar o horário."));
  return parseBookingReceipt(payload,input);
}

export async function getProtectedAvailability(params:{tenantId:string;serviceId:string;professionalId:string;date:string}):Promise<string[]> {
  const base=import.meta.env.VITE_BOOKING_API_BASE_URL;
  if(!base)throw new Error("Booking API não configurada.");
  const query=new URLSearchParams(params);
  const response=await fetch(`${base.replace(/\\$/,"")}/api/availability?${query.toString()}`);
  const data:unknown=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(apiError(data,"Não foi possível obter horários disponíveis."));
  return parseAvailableSlots(data,params.date);
}
