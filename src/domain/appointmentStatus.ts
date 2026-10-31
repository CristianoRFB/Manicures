import type {Appointment} from "./types";

/** Reflect a confirmed Worker write locally before attempting a potentially failing re-read. */
export function applyConfirmedAppointmentStatus(
  rows: Appointment[], appointmentId:string, status:Appointment["status"]
): Appointment[] {
  return rows.map(item=>item.id===appointmentId ? {...item,status} : item);
}
