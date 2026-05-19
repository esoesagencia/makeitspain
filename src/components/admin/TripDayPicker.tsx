"use client";

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface TripDayPickerProps {
  tripStartDate: string; // "YYYY-MM-DD"
  tripEndDate: string;   // "YYYY-MM-DD"
  value: string;         // "YYYY-MM-DD"
  onChange: (date: string) => void;
}

export function TripDayPicker({ tripStartDate, tripEndDate, value, onChange }: TripDayPickerProps) {
  if (!tripStartDate || !tripEndDate) return null;

  // Build list of every day in the trip.
  // Use Date.UTC to avoid browser-local timezone shifting the date when the
  // ISO string is parsed as local midnight (which is UTC-behind in UTC+N zones).
  const days: { iso: string; label: string; dayNum: number }[] = [];
  const [sy, sm, sd] = tripStartDate.split("-").map(Number);
  const [ey, em, ed] = tripEndDate.split("-").map(Number);
  const startMs = Date.UTC(sy, sm - 1, sd);
  const endMs   = Date.UTC(ey, em - 1, ed);

  for (let ms = startMs; ms <= endMs; ms += 86_400_000) {
    const d   = new Date(ms);
    const iso = d.toISOString().slice(0, 10); // safe: d is exact UTC midnight
    days.push({
      iso,
      label:  `${DAY_SHORT[d.getUTCDay()]} ${d.getUTCDate()}`,
      dayNum: days.length + 1,
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {days.map(({ iso, label, dayNum }) => {
        const active = iso === value;
        return (
          <button
            key={iso}
            type="button"
            onClick={() => onChange(iso)}
            className="flex flex-col items-center px-3 py-2 rounded-[8px] border text-xs font-medium transition-colors"
            style={active
              ? { background: "#D94040", borderColor: "#D94040", color: "white" }
              : { background: "white", borderColor: "rgba(180,100,90,0.2)", color: "#9A7A78" }}
          >
            <span className="text-[9px] font-semibold uppercase tracking-wider opacity-70 mb-0.5">
              Day {dayNum}
            </span>
            {label}
          </button>
        );
      })}
    </div>
  );
}
