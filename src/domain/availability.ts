import type { Appointment, Professional, Service } from "./types";

const ACTIVE_STATUSES = new Set(["pending", "confirmed", "in_service"]);

export function createSlots(date: string, service: Service, professional: Professional, appointments: Appointment[]): string[] {
  if (!professional.active || !professional.serviceIds.includes(service.id) || !service.active) return [];

  const startHour = 9;
  const endHour = 18;
  const slots: string[] = [];
  const busy = appointments.filter(
    (a) => a.professionalId === professional.id && a.startsAt.startsWith(date) && ACTIVE_STATUSES.has(a.status),
  );

  for (let minutes = startHour * 60; minutes + service.durationMin <= endHour * 60; minutes += 30) {
    if (minutes < 13 * 60 && minutes + service.durationMin > 12 * 60) continue;

    const start = atMinutes(date, minutes);
    const end = atMinutes(date, minutes + service.durationMin);
    const overlap = busy.some((a) => start < a.endsAt && end > a.startsAt);
    if (!overlap) slots.push(start);
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
