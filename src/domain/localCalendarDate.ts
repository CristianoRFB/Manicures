/** Format a date for a date input using the user's calendar, never UTC. */
export function localCalendarDate(offsetDays = 0, now = new Date()): string {
  if (!Number.isInteger(offsetDays) || !Number.isFinite(now.getTime())) throw new Error("Data inválida.");
  const day = new Date(now.getTime());
  // Noon avoids daylight-saving transitions that occur around midnight.
  day.setHours(12, 0, 0, 0);
  day.setDate(day.getDate() + offsetDays);
  return [day.getFullYear(), String(day.getMonth() + 1).padStart(2, "0"), String(day.getDate()).padStart(2, "0")].join("-");
}


/** Calendar day of the studio, independent of the visitor's computer timezone.
 * Date arithmetic is performed in UTC after extracting the studio's day, so
 * daylight-saving transitions never shift the intended calendar date.
 */
export function studioCalendarDate(timeZone: string, offsetDays = 0, now = new Date()): string {
  if (!Number.isSafeInteger(offsetDays) || !Number.isFinite(now.getTime()))
    throw new Error("Data inválida.");
  const parts = new Intl.DateTimeFormat("en-US",{
    timeZone, year:"numeric", month:"2-digit", day:"2-digit",
  }).formatToParts(now);
  const value = (key: string): number => {
    const raw = parts.find(part=>part.type===key)?.value;
    return raw ? Number(raw) : NaN;
  };
  const year=value("year"), month=value("month"), day=value("day");
  if (![year,month,day].every(Number.isSafeInteger)) throw new Error("Fuso horário inválido.");
  return new Date(Date.UTC(year, month - 1, day + offsetDays, 12)).toISOString().slice(0,10);
}
