import type { Appointment, Professional, Service } from "./types";

const ACTIVE_STATUSES = new Set(["pending", "confirmed", "in_service"]);

type Hours = {closed:boolean;startMinute:number;endMinute:number;breakStartMinute:number;breakEndMinute:number};
const DEFAULT_HOURS:Hours={closed:false,startMinute:540,endMinute:1080,breakStartMinute:720,breakEndMinute:780};

function validHours(h: Hours): boolean {
  return typeof h.closed==="boolean" &&
    [h.startMinute,h.endMinute,h.breakStartMinute,h.breakEndMinute].every(Number.isSafeInteger) &&
    h.startMinute>=0 && h.startMinute<1440 && h.endMinute>h.startMinute && h.endMinute<=1440 &&
    h.breakStartMinute>=h.startMinute && h.breakEndMinute<=h.endMinute &&
    h.breakStartMinute<=h.breakEndMinute;
}

/** Demo slots mirror the Worker's weekly opening hours and active booking overlap.
 * They remain read-only and are never used as authorization to create a booking.
 */
export function createSlots(date: string, service: Service, professional: Professional, appointments: Appointment[]): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isSafeInteger(service.durationMin) || service.durationMin<15 || service.durationMin>480 ||
      !professional.active || !professional.serviceIds.includes(service.id) || !service.active ||
      service.tenantId!==professional.tenantId) return [];

  const day=new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0,10)!==date) return [];
  const weekday=String(day.getUTCDay());
  const hours:Hours=professional.weeklyHours?.[weekday] ?? DEFAULT_HOURS;
  if (!validHours(hours)||hours.closed) return [];
  const busy=appointments.filter(a=>a.tenantId===service.tenantId &&
    a.professionalId===professional.id && ACTIVE_STATUSES.has(a.status));

  const slots:string[]=[];
  for (let minute=hours.startMinute;minute+service.durationMin<=hours.endMinute;minute+=30) {
    const endMinute=minute+service.durationMin;
    if(minute<hours.breakEndMinute && endMinute>hours.breakStartMinute)continue;
    const start=atMinutes(date,minute),end=atMinutes(date,endMinute);
    if(!busy.some(a=>start<a.endsAt && end>a.startsAt))slots.push(start);
  }
  return slots;
}

export function atMinutes(date: string, minutes: number): string {
  const midnight=Date.parse(`${date}T00:00:00Z`);
  return new Date(midnight+minutes*60000).toISOString().slice(0,19);
}

export function addMinutes(isoLocal: string, minutes: number): string {
  const [date, time] = isoLocal.split("T");
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return atMinutes(date, total);
}
