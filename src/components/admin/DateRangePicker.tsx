"use client";

import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DateRangePickerProps {
  startDate: string;   // "YYYY-MM-DD"
  endDate: string;     // "YYYY-MM-DD"
  onChange: (start: string, end: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_NAMES   = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTH_NAMES = ["January","February","March","April","May","June",
                     "July","August","September","October","November","December"];
const DAY_FULL    = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

function toISO(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseISO(s: string): Date | null {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

/** Monday-first day-of-week (0 = Mon … 6 = Sun) */
function dow(date: Date) {
  return (date.getDay() + 6) % 7;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function addDays(date: Date, n: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isoFromDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Build the ordered list of days in the selected range */
function rangeDayNames(start: string, end: string): string[] {
  const s = parseISO(start);
  const e = parseISO(end);
  if (!s || !e || e < s) return [];
  const names: string[] = [];
  const seen = new Set<number>();
  let cur = new Date(s);
  while (cur <= e) {
    const d = dow(cur); // 0=Mon…6=Sun
    if (!seen.has(d)) { seen.add(d); names.push(DAY_FULL[d].slice(0, 3)); }
    cur = addDays(cur, 1);
    if (names.length === 7) break;
  }
  // sort by weekday order
  return names.sort((a, b) => DAY_FULL.findIndex(d => d.startsWith(a)) - DAY_FULL.findIndex(d => d.startsWith(b)));
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DateRangePicker({ startDate, endDate, onChange }: DateRangePickerProps) {
  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [picking, setPicking] = useState<"start" | "end" | null>(null);
  const [hovered, setHovered]  = useState<string | null>(null);

  const startD = parseISO(startDate);
  const endD   = parseISO(endDate);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  function handleDayClick(iso: string) {
    if (!picking || picking === "start") {
      // Start a new range
      onChange(iso, "");
      setPicking("end");
    } else {
      // Finish the range
      if (iso < startDate) {
        onChange(iso, startDate);
      } else {
        onChange(startDate, iso);
      }
      setPicking(null);
    }
  }

  function isInRange(iso: string) {
    if (!startDate) return false;
    const pivot = picking === "end" ? hovered : endDate;
    if (!pivot) return false;
    const lo = startDate < pivot ? startDate : pivot;
    const hi = startDate < pivot ? pivot : startDate;
    return iso > lo && iso < hi;
  }

  function isStart(iso: string) { return iso === startDate; }
  function isEnd(iso: string)   { return iso === (picking === "end" ? hovered : endDate); }

  // Build calendar grid
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const totalDays    = daysInMonth(viewYear, viewMonth);
  const leadingBlanks = dow(firstOfMonth); // Mon-first offset

  const cells: (string | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => toISO(viewYear, viewMonth, i + 1)),
  ];
  // pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  // Summary
  const nights = startDate && endDate
    ? Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000)
    : null;
  const days  = nights !== null ? nights + 1 : null;
  const dayNames = rangeDayNames(startDate, endDate);

  return (
    <div className="flex flex-col gap-3">
      {/* Calendar */}
      <div className="rounded-[10px] border bg-white p-4 select-none" style={{ borderColor: "rgba(180,100,90,0.15)" }}>

        {/* Month nav */}
        <div className="flex items-center justify-between mb-4">
          <button type="button" onClick={prevMonth} className="p-1 rounded text-[#9A7A78] hover:text-[#1E0E0B] transition-colors">
            <ChevronLeft />
          </button>
          <span className="text-sm font-semibold text-[#1E0E0B]">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <button type="button" onClick={nextMonth} className="p-1 rounded text-[#9A7A78] hover:text-[#1E0E0B] transition-colors">
            <ChevronRight />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_NAMES.map((d) => (
            <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-wider text-[#9A7A78] py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {cells.map((iso, idx) => {
            if (!iso) return <div key={`blank-${idx}`} />;

            const start  = isStart(iso);
            const end    = isEnd(iso);
            const inRange = isInRange(iso);
            const isToday = iso === isoFromDate(today);

            return (
              <button
                key={iso}
                type="button"
                onClick={() => handleDayClick(iso)}
                onMouseEnter={() => picking === "end" && setHovered(iso)}
                onMouseLeave={() => picking === "end" && setHovered(null)}
                className={[
                  "relative h-8 w-full text-sm transition-colors",
                  start || end
                    ? "bg-[#D94040] text-white font-semibold rounded-[6px] z-10"
                    : inRange
                    ? "bg-[rgba(217,64,64,0.1)] text-[#1E0E0B]"
                    : isToday
                    ? "text-[#D94040] font-medium hover:bg-[rgba(217,64,64,0.08)] rounded-[6px]"
                    : "text-[#9A7A78] hover:bg-[rgba(217,64,64,0.06)] hover:text-[#1E0E0B] rounded-[6px]",
                  // Smooth range caps
                  inRange && !start && !end ? "rounded-none" : "",
                ].join(" ")}
              >
                {iso.slice(8)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Instruction */}
      <p className="text-xs text-[#9A7A78] text-center">
        {!startDate
          ? "Click to set start date"
          : picking === "end"
          ? "Now click the end date"
          : !endDate
          ? "Click to set end date"
          : null}
      </p>

      {/* Summary */}
      {days !== null && endDate && (
        <div className="rounded-[8px] px-4 py-2.5 flex items-center justify-between" style={{ background: "rgba(217,64,64,0.06)", border: "1px solid rgba(217,64,64,0.2)" }}>
          <span className="text-sm font-semibold text-[#D94040]">
            {days} day{days !== 1 ? "s" : ""} · {nights} night{nights !== 1 ? "s" : ""}
          </span>
          {dayNames.length > 0 && (
            <div className="flex gap-1.5">
              {dayNames.map((d) => (
                <span key={d} className="text-[10px] font-semibold uppercase tracking-wider text-[#D94040] px-2 py-0.5 rounded-full" style={{ background: "rgba(217,64,64,0.1)" }}>
                  {d}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
