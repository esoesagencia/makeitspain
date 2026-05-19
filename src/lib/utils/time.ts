import { Timestamp } from "firebase/firestore";

const SPAIN_TZ = "Europe/Madrid";

export function formatTime(timestamp: Timestamp): string {
  return timestamp.toDate().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: SPAIN_TZ,
  });
}

export function formatDate(timestamp: Timestamp): string {
  return timestamp.toDate().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: SPAIN_TZ,
  });
}

export function formatDateShort(timestamp: Timestamp): string {
  return timestamp.toDate().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: SPAIN_TZ,
  });
}

/** Returns ISO date string (YYYY-MM-DD) in Spain timezone for grouping */
export function toSpainDateKey(timestamp: Timestamp): string {
  return timestamp.toDate().toLocaleDateString("sv-SE", {
    timeZone: SPAIN_TZ,
  });
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export function isNow(start: Timestamp, end: Timestamp): boolean {
  const now = Date.now();
  return start.toMillis() <= now && end.toMillis() >= now;
}

export function isPast(end: Timestamp): boolean {
  return end.toMillis() < Date.now();
}

export function formatDateRange(start: Timestamp, end: Timestamp): string {
  const s = start.toDate();
  const e = end.toDate();
  const sameYear = s.getFullYear() === e.getFullYear();

  const startStr = s.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: SPAIN_TZ,
  });
  const endStr = e.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: SPAIN_TZ,
  });
  return `${startStr} – ${endStr}`;
}
