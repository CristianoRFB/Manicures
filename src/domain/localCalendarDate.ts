/** Format a date for a date input using the user's calendar, never UTC. */
export function localCalendarDate(offsetDays = 0, now = new Date()): string {
  if (!Number.isInteger(offsetDays) || !Number.isFinite(now.getTime())) throw new Error("Data inválida.");
  const day = new Date(now.getTime());
  // Noon avoids daylight-saving transitions that occur around midnight.
  day.setHours(12, 0, 0, 0);
  day.setDate(day.getDate() + offsetDays);
  return [day.getFullYear(), String(day.getMonth() + 1).padStart(2, "0"), String(day.getDate()).padStart(2, "0")].join("-");
}
