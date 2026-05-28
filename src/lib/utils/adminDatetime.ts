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
 *
 * This implementation is browser-timezone-agnostic: it does NOT rely on
 * new Date("YYYY-MM-DDTHH:MM") being parsed in local time.  Instead it
 * treats the input as a UTC anchor and walks the Madrid offset directly,
 * so the result is correct regardless of the machine's timezone.
 *
 * Madrid is always UTC+1 (CET, winter) or UTC+2 (CEST, summer).
 * We try both offsets and pick whichever makes the round-trip check pass.
 */
export function parseMadridDateTime(dateStr: string, timeStr: string): Timestamp {
  const [sy, sm, sd]   = dateStr.split("-").map(Number);
  const [sh, smin]     = timeStr.split(":").map(Number);
  // UTC milliseconds if we pretend the Madrid local time IS UTC (naive anchor)
  const anchorMs = Date.UTC(sy, sm - 1, sd, sh, smin, 0);

  // Try each possible Madrid UTC offset (CEST = +2h, CET = +1h)
  for (const offsetH of [2, 1]) {
    const candidateMs = anchorMs - offsetH * 3_600_000;
    const candidate   = new Date(candidateMs);
    // Verify round-trip: does Madrid show dateStr T timeStr for this UTC instant?
    const check = candidate.toLocaleString("sv-SE", { timeZone: TZ }); // "YYYY-MM-DD HH:MM:SS"
    const expected = `${dateStr} ${String(sh).padStart(2, "0")}:${String(smin).padStart(2, "0")}:00`;
    if (check === expected) {
      return Timestamp.fromDate(candidate);
    }
  }

  // Fallback: use CEST (UTC+2) — handles ambiguous DST edge cases gracefully
  return Timestamp.fromDate(new Date(anchorMs - 2 * 3_600_000));
}

export function parseMadridDate(dateStr: string): Timestamp {
  return parseMadridDateTime(dateStr, "00:00");
}

export function parseMadridDatetimeLocal(datetimeLocal: string): Timestamp {
  const [date, time] = datetimeLocal.split("T");
  return parseMadridDateTime(date, time.slice(0, 5));
}
