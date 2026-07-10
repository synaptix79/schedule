export const DAY_NAMES = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado"
];

export function dateToISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseISODate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function todayISO(): string {
  return dateToISO(new Date());
}

export function addDays(date: string, days: number): string {
  const next = parseISODate(date);
  next.setDate(next.getDate() + days);
  return dateToISO(next);
}

export function isSunday(date: string): boolean {
  return parseISODate(date).getDay() === 0;
}

export function dayName(date: string): string {
  return DAY_NAMES[parseISODate(date).getDay()];
}

export function formatDisplayDate(date: string): string {
  const parsed = parseISODate(date);
  return new Intl.DateTimeFormat("es", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(parsed);
}

export function startOfWeek(date: string): string {
  const parsed = parseISODate(date);
  const day = parsed.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  parsed.setDate(parsed.getDate() + diff);
  return dateToISO(parsed);
}

export function getWeekDates(date: string): string[] {
  const monday = startOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

export function nextOperationalDate(date: string, includeSundays: boolean): string {
  let cursor = addDays(date, 1);
  while (!includeSundays && isSunday(cursor)) {
    cursor = addDays(cursor, 1);
  }
  return cursor;
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function isTaskLate(date: string, endTime: string, status: string): boolean {
  if (status !== "pending" || date !== todayISO()) {
    return false;
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return currentMinutes > timeToMinutes(endTime);
}
