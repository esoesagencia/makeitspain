import { Timestamp } from "firebase/firestore";

const TZ = "Europe/Madrid";

// ─── Timestamp → HTML input value ─────────────────────────────────────────────

export function tsToDateInput(ts: Timestamp): string {
  return ts.toDate().toLocaleDateString("sv-SE", { timeZone: TZ }); // "YYYY-MM-DD"
}

export function tsToTimeInput(ts: Timestamp): string {
  return ts.toDate().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ,
  }); // "HH:MM"
}

export function tsToDatetimeLocal(ts: Timestamp): string {
  return `${tsToDateInput(ts)}T${tsToTimeInput(ts)}`; // "YYYY-MM-DDTHH:MM"
}

// ─── HTML input value → Timestamp ─────────────────────────────────────────────

/**
 * Interprets dateStr + timeStr as Europe/Madrid local time and returns
 * the corresponding UTC-based Timestamp.
 */
export function parseMadridDateTime(dateStr: string, timeStr: string): Timestamp {
  // Build a string that Intl can map back to UTC.
  // We find the UTC instant whose Madrid representation equals our input.
  const naive = new Date(`${dateStr}T${timeStr}:00`);
  const madridDisplay = naive.toLocaleString("sv-SE", { timeZone: TZ }); // "YYYY-MM-DD HH:MM:SS"
  const [madridDate, madridTime] = madridDisplay.split(" ");
  const [mH, mM] = madridTime.split(":").map(Number);
  const [iH, iM] = timeStr.split(":").map(Number);
  const offsetMin = (iH * 60 + iM) - (mH * 60 + mM);
  const corrected = new Date(naive.getTime() + offsetMin * 60_000);
  return Timestamp.fromDate(corrected);
}

export function parseMadridDate(dateStr: string): Timestamp {
  return parseMadridDateTime(dateStr, "00:00");
}

export function parseMadridDatetimeLocal(datetimeLocal: string): Timestamp {
  const [date, time] = datetimeLocal.split("T");
  return parseMadridDateTime(date, time.slice(0, 5));
}
