"use client";

import { useRef, useState, useCallback, useMemo } from "react";
import { doc, updateDoc, collection } from "firebase/firestore";
import { db, COLLECTIONS, SUBCOLLECTIONS } from "@/lib/firebase/firestore";
import { parseMadridDateTime } from "@/lib/utils/adminDatetime";
import type { Activity, ActivityCategory, Trip } from "@/types";

// ─── Grid constants ───────────────────────────────────────────────────────────

const HOUR_H      = 72;
const COL_W       = 240;
const RULER_W     = 48;
const SNAP_MIN    = 15;
const DRAG_THRESH = 5;
const TOTAL_HOURS = 26;
const GRID_H      = TOTAL_HOURS * HOUR_H;

// ─── Transfer option type (exported so page.tsx can build the map) ────────────

export interface CalTransferOption {
  mode:            "driving" | "walking" | "transit";
  durationMinutes: number;
  durationText:    string;
}

export interface CalTransferInfo {
  gapMinutes:   number;
  travelOptions: CalTransferOption[] | null; // null = still loading
  currentMode:  string;   // "taxi" | "walking" | "transit"
}

// ─── Mode colours & icons ─────────────────────────────────────────────────────

const MODE_COLOR: Record<string, string> = {
  driving: "#D94040",   // coral — taxi
  walking: "#1A9E72",   // green — on foot
  transit: "#1A56DB",   // blue  — public transport
};
const MODE_ICON: Record<string, string> = {
  driving: "🚕",
  walking: "🚶",
  transit: "🚇",
};
const MODE_LABEL: Record<string, string> = {
  driving: "Taxi",
  walking: "Walk",
  transit: "Transit",
};

// ─── Activity category colours ────────────────────────────────────────────────

const CAT_COLOR: Record<ActivityCategory, string> = {
  activity:          "#0D6E4E",
  transfer:          "#1A56DB",
  meal:              "#92570A",
  free_time:         "#5B21B6",
  surprise:          "#6B21A8",
  hotel:             "#9A3412",
  sleep_in_hotel:    "#1E3A8A",
  wellness_grooming: "#BE185D",
};

const CAT_LABEL: Record<ActivityCategory, string> = {
  activity:          "Activity",
  transfer:          "Transfer",
  meal:              "Dining",
  free_time:         "Free Time",
  surprise:          "Surprise",
  hotel:             "Hotel",
  sleep_in_hotel:    "Sleep in Hotel",
  wellness_grooming: "Wellness & Grooming",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SPAIN = "Europe/Madrid";

function dateKeyFromTs(ts: { toDate(): Date }): string {
  return ts.toDate().toLocaleDateString("sv-SE", { timeZone: SPAIN });
}

function minutesFromMidnight(ts: { toDate(): Date }): number {
  const d   = ts.toDate();
  const raw = d.toLocaleString("en-GB", { hour: "numeric", hour12: false, timeZone: SPAIN });
  const h   = raw === "24" ? 0 : Number(raw);
  const m   = Number(d.toLocaleString("en-GB", { minute: "numeric", timeZone: SPAIN }));
  return h * 60 + m;
}

const isHotelMorning = (a: Activity) => a.category === "hotel" && a.estimatedDuration === 0;

function calStartMin(a: Activity): number {
  if (isHotelMorning(a)) return 0;
  return minutesFromMidnight(a.startTime);
}

function calEndMin(a: Activity): number {
  if (isHotelMorning(a)) {
    const eMin = minutesFromMidnight(a.endTime);
    const sMin = minutesFromMidnight(a.startTime);
    return eMin > sMin ? eMin : 8 * 60;
  }
  if (a.category === "sleep_in_hotel") {
    const sMin = minutesFromMidnight(a.startTime);
    return sMin + (a.estimatedDuration > 0 ? a.estimatedDuration : 60);
  }
  if (a.estimatedDuration > 0) return minutesFromMidnight(a.startTime) + a.estimatedDuration;
  return minutesFromMidnight(a.endTime);
}

function minsToY(mins: number): number { return (mins / 60) * HOUR_H; }
function yToMins(px: number):   number { return (px  / HOUR_H) * 60;  }
function snapMins(m: number):   number { return Math.round(m / SNAP_MIN) * SNAP_MIN; }
function clampMins(m: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, m));
}

function fmtMin(m: number): string {
  const total  = ((m % (24 * 60)) + 24 * 60) % (24 * 60);
  const h      = Math.floor(total / 60);
  const mn     = total % 60;
  const suffix = m >= 24 * 60 ? "⁺¹" : "";
  return `${String(h).padStart(2, "0")}:${String(mn).padStart(2, "0")}${suffix}`;
}

function buildTs(dateKey: string, mins: number) {
  let key = dateKey, m = mins;
  if (m >= 24 * 60) {
    const [y, mo, d] = dateKey.split("-").map(Number);
    key = new Date(Date.UTC(y, mo - 1, d + 1)).toISOString().slice(0, 10);
    m  -= 24 * 60;
  }
  return parseMadridDateTime(
    key,
    `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`,
  );
}

function tripDayKeys(trip: Trip): string[] {
  // Parse start/end in Madrid timezone (same as tsToDateInput) to avoid
  // browser-local-timezone shifting the date when the stored Timestamp
  // is midnight Madrid (= 22:00 UTC the day before).
  const startStr = trip.startDate.toDate().toLocaleDateString("sv-SE", { timeZone: SPAIN });
  const endStr   = trip.endDate.toDate().toLocaleDateString("sv-SE", { timeZone: SPAIN });

  const [sy, sm, sd] = startStr.split("-").map(Number);
  const [ey, em, ed] = endStr.split("-").map(Number);

  const keys: string[] = [];
  const s = Date.UTC(sy, sm - 1, sd);
  const e = Date.UTC(ey, em - 1, ed);
  for (let ms = s; ms <= e; ms += 86_400_000) keys.push(new Date(ms).toISOString().slice(0, 10));
  return keys;
}

// ─── Drag state ───────────────────────────────────────────────────────────────

interface DragState {
  type:           "drag" | "resize-bottom";
  activityId:     string;
  origStart:      number;
  origEnd:        number;
  origDateKey:    string;
  startY:         number;
  startX:         number;
  startCol:       number;
  currentCol:     number;
  liveStart:      number;
  liveEnd:        number;
  currentDateKey: string;
  didMove:        boolean;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface TripCalendarViewProps {
  activities:     Activity[];
  trip:           Trip;
  tripId:         string;
  transfers?:     Map<string, CalTransferInfo>;
  onAddActivity:  (dateKey: string, hour: number, minute: number) => void;
  onEditActivity: (activity: Activity) => void;
}

// ─── Transfer gap component ───────────────────────────────────────────────────

function TransferGap({
  gapStart, gapEnd, info,
}: {
  gapStart: number;
  gapEnd:   number;
  info:     CalTransferInfo;
}) {
  const gapH   = minsToY(gapEnd - gapStart);
  const top    = minsToY(gapStart);
  const opts   = info.travelOptions;

  return (
    <div
      className="absolute inset-x-0 pointer-events-none overflow-hidden"
      style={{ top, height: gapH, zIndex: 8 }}
    >
      {opts === null ? (
        /* Still loading */
        <div className="h-full flex items-center justify-center">
          <div className="w-1 h-full mx-1 rounded-full bg-white/10 animate-pulse" />
          <div className="w-1 h-full mx-1 rounded-full bg-white/10 animate-pulse" style={{ animationDelay: "150ms" }} />
          <div className="w-1 h-full mx-1 rounded-full bg-white/10 animate-pulse" style={{ animationDelay: "300ms" }} />
        </div>
      ) : opts.length === 0 ? (
        /* No data — simple dashed line */
        <div className="absolute left-1/2 -translate-x-1/2 w-px h-full border-l border-dashed" style={{ borderColor: "rgba(180,100,90,0.2)" }} />
      ) : (
        /* Three mode bars, each sized to that mode's travel time */
        <div className="absolute inset-x-2 top-0 flex gap-1 items-start justify-center h-full">
          {opts.map((opt) => {
            const barH   = Math.min(minsToY(opt.durationMinutes), gapH);
            const color  = MODE_COLOR[opt.mode] ?? "#6B7280";
            const isOver = opt.durationMinutes > (gapEnd - gapStart);
            const isActive = info.currentMode === opt.mode ||
              (info.currentMode === "taxi" && opt.mode === "driving");
            return (
              <div key={opt.mode} className="flex flex-col items-center" style={{ flex: 1 }}>
                {/* Bar */}
                <div
                  className="w-full rounded-sm relative overflow-visible"
                  style={{
                    height:  barH,
                    background: `${color}${isActive ? "55" : "22"}`,
                    border: `1px solid ${color}${isActive ? "99" : "44"}`,
                    outline: isOver ? `1px solid #E74C3C88` : undefined,
                  }}
                >
                  {/* Icon inside bar if tall enough, else above */}
                  {barH >= 20 && (
                    <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] leading-none select-none">
                      {MODE_ICON[opt.mode]}
                    </span>
                  )}
                </div>
                {/* Duration label below bar */}
                <span
                  className="text-[8px] leading-none mt-0.5 tabular-nums whitespace-nowrap select-none"
                  style={{ color: isOver ? "#E74C3C" : color, opacity: 0.85 }}
                >
                  {opt.durationMinutes}m
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TripCalendarView({
  activities, trip, tripId, transfers, onAddActivity, onEditActivity,
}: TripCalendarViewProps) {
  const dayKeys = useMemo(() => tripDayKeys(trip), [trip]);
  const colRef  = collection(db, COLLECTIONS.TRIPS, tripId, SUBCOLLECTIONS.ACTIVITIES);

  const [pending, setPending]         = useState<Map<string, { start: number; end: number; dateKey: string }>>(new Map());
  const dragRef          = useRef<DragState | null>(null);
  const gridRef          = useRef<HTMLDivElement>(null);
  const suppressClickRef = useRef(false);

  // ── Column hit-test ───────────────────────────────────────────────────────
  const xToCol = useCallback((clientX: number): number | null => {
    if (!gridRef.current) return null;
    const col = Math.floor((clientX - gridRef.current.getBoundingClientRect().left - RULER_W) / COL_W);
    return col < 0 || col >= dayKeys.length ? null : col;
  }, [dayKeys.length]);

  // ── Pointer move ──────────────────────────────────────────────────────────
  const onPointerMove = useCallback((e: PointerEvent) => {
    const ds = dragRef.current;
    if (!ds) return;
    if (!ds.didMove) {
      if (Math.abs(e.clientY - ds.startY) > DRAG_THRESH || Math.abs(e.clientX - ds.startX) > DRAG_THRESH) {
        ds.didMove = true;
      } else return;
    }
    const deltaMin = snapMins(yToMins(e.clientY - ds.startY));
    const colIdx   = xToCol(e.clientX) ?? ds.currentCol;
    const dateKey  = dayKeys[colIdx] ?? ds.currentDateKey;
    let newStart: number, newEnd: number;
    if (ds.type === "drag") {
      const dur = ds.origEnd - ds.origStart;
      newStart  = clampMins(ds.origStart + deltaMin, 0, TOTAL_HOURS * 60 - dur);
      newEnd    = newStart + dur;
    } else {
      newStart = ds.origStart;
      newEnd   = clampMins(ds.origEnd + snapMins(yToMins(e.clientY - ds.startY)), ds.origStart + 15, TOTAL_HOURS * 60);
    }
    ds.liveStart = newStart; ds.liveEnd = newEnd;
    ds.currentCol = colIdx; ds.currentDateKey = dateKey;
    setPending((prev) => { const n = new Map(prev); n.set(ds.activityId, { start: newStart, end: newEnd, dateKey }); return n; });
  }, [dayKeys, xToCol]);

  // ── Pointer up — commit ───────────────────────────────────────────────────
  const onPointerUp = useCallback(async () => {
    const ds = dragRef.current;
    if (!ds) return;
    if (ds.didMove) { suppressClickRef.current = true; setTimeout(() => { suppressClickRef.current = false; }, 50); }
    dragRef.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup",   onPointerUp);
    if (!ds.didMove) { setPending((p) => { const n = new Map(p); n.delete(ds.activityId); return n; }); return; }
    const activity = activities.find((a) => a.id === ds.activityId);
    if (!activity) { setPending((p) => { const n = new Map(p); n.delete(ds.activityId); return n; }); return; }
    const newStartTs = buildTs(ds.currentDateKey, ds.liveStart);
    const newEndTs   = buildTs(ds.currentDateKey, ds.liveEnd);
    try {
      if (isHotelMorning(activity)) {
        await updateDoc(doc(colRef, activity.id), { endTime: newEndTs });
      } else if (activity.category === "sleep_in_hotel") {
        await updateDoc(doc(colRef, activity.id), { startTime: newStartTs, endTime: newEndTs, estimatedDuration: ds.liveEnd - ds.liveStart });
        const [y, mo, d] = ds.currentDateKey.split("-").map(Number);
        const nextDayKey = new Date(Date.UTC(y, mo - 1, d + 1)).toISOString().slice(0, 10);
        const mc = activities.find((a) => isHotelMorning(a) && dateKeyFromTs(a.startTime) === nextDayKey);
        if (mc) await updateDoc(doc(colRef, mc.id), { startTime: buildTs(nextDayKey, 0) });
      } else {
        await updateDoc(doc(colRef, activity.id), { startTime: newStartTs, endTime: newEndTs, estimatedDuration: ds.liveEnd - ds.liveStart, date: newStartTs });
      }
    } catch (err) { console.error("Calendar drag failed:", err); }
    setPending((p) => { const n = new Map(p); n.delete(ds.activityId); return n; });
  }, [activities, colRef, onPointerMove]);

  // ── Start drag ────────────────────────────────────────────────────────────
  function startDrag(e: React.PointerEvent, activity: Activity, type: "drag" | "resize-bottom", dateKey: string, sMin: number, eMin: number) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { type, activityId: activity.id, origStart: sMin, origEnd: eMin, origDateKey: dateKey, startY: e.clientY, startX: e.clientX, startCol: dayKeys.indexOf(dateKey), currentCol: dayKeys.indexOf(dateKey), liveStart: sMin, liveEnd: eMin, currentDateKey: dateKey, didMove: false };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup",   onPointerUp);
  }

  // ── Double-click on empty slot ────────────────────────────────────────────
  function handleColumnDblClick(e: React.MouseEvent, dateKey: string) {
    if (suppressClickRef.current) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const mins = snapMins(yToMins(e.clientY - rect.top));
    onAddActivity(dateKey, Math.floor(mins / 60), mins % 60);
  }

  // ── Activities grouped by day ─────────────────────────────────────────────
  const actsByDay = useMemo(() => {
    const map      = new Map<string, Activity[]>();
    const firstDay = dayKeys[0] ?? "";
    for (const a of activities) {
      const key = dateKeyFromTs(a.startTime);
      if (isHotelMorning(a) && key === firstDay) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return map;
  }, [activities, dayKeys]);

  // ─── Render ───────────────────────────────────────────────────────────────
  const HOURS = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => i);

  return (
    <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: "calc(100vh - 240px)" }}>

      {/* Column headers */}
      <div className="flex sticky top-0 z-30 backdrop-blur-sm" style={{ paddingLeft: RULER_W, background: "rgba(245,237,237,0.97)", borderBottom: "1px solid rgba(180,100,90,0.12)" }}>
        {dayKeys.map((key, i) => {
          const d     = new Date(`${key}T00:00:00Z`);
          const label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
          return (
            <div key={key} className="shrink-0 flex flex-col items-center justify-center py-2.5" style={{ width: COL_W, borderRight: "1px solid rgba(180,100,90,0.1)" }}>
              <span className="text-[10px] font-bold text-[#D94040] tracking-widest uppercase leading-none mb-0.5">Day {i + 1}</span>
              <span className="text-xs text-[#9A7A78]">{label}</span>
            </div>
          );
        })}
        <div className="shrink-0 flex items-center px-3 opacity-40">
          <span className="text-[10px] text-[#9A7A78] italic whitespace-nowrap">double-click to add</span>
        </div>
      </div>

      {/* Grid */}
      <div ref={gridRef} className="relative flex select-none" style={{ height: GRID_H }}>

        {/* Time ruler */}
        <div className="sticky left-0 z-20 shrink-0 bg-[#F5EDED]" style={{ width: RULER_W, borderRight: "1px solid rgba(180,100,90,0.1)" }}>
          {HOURS.map((h) => (
            <div key={h} className="absolute right-0 flex items-center justify-end pr-2" style={{ top: h * HOUR_H - 8, height: 16 }}>
              <span className={`text-[10px] tabular-nums leading-none ${h >= 24 ? "text-[#D94040]/40" : "text-[#9A7A78]/50"}`}>
                {h === 24 ? "00⁺¹" : h === 25 ? "01⁺¹" : h === 26 ? "02⁺¹" : `${String(h).padStart(2, "0")}:00`}
              </span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {dayKeys.map((dateKey) => {
          const colActivities = (actsByDay.get(dateKey) ?? [])
            .slice()
            .sort((a, b) => calStartMin(a) - calStartMin(b));

          return (
            <div
              key={dateKey}
              className="relative shrink-0 cursor-crosshair"
              style={{ borderRight: "1px solid rgba(180,100,90,0.08)", width: COL_W, height: GRID_H }}
              onDoubleClick={(e) => handleColumnDblClick(e, dateKey)}
            >
              {/* Hour lines */}
              {HOURS.map((h) => (
                <div key={h} className="absolute inset-x-0 border-t" style={{ top: h * HOUR_H, borderColor: h >= 24 ? "rgba(217,64,64,0.1)" : h === 0 ? "rgba(180,100,90,0.2)" : "rgba(180,100,90,0.06)" }} />
              ))}
              {/* Half-hour dashes */}
              {HOURS.slice(0, TOTAL_HOURS).map((h) => (
                <div key={`hh-${h}`} className="absolute inset-x-0 border-t border-dashed" style={{ top: h * HOUR_H + HOUR_H / 2, borderColor: "rgba(180,100,90,0.04)" }} />
              ))}
              {/* Past-midnight zone */}
              <div className="absolute inset-x-0 pointer-events-none" style={{ top: 24 * HOUR_H, bottom: 0, background: "rgba(217,64,64,0.02)" }} />

              {/* Transfer gap connectors between consecutive activities */}
              {colActivities.map((a, idx) => {
                const next = colActivities[idx + 1];
                if (!next) return null;
                const thisEnd   = pending.get(a.id)?.end    ?? calEndMin(a);
                const nextStart = pending.get(next.id)?.start ?? calStartMin(next);
                if (nextStart <= thisEnd) return null;
                const info = transfers?.get(`${a.id}->${next.id}`);
                return (
                  <TransferGap
                    key={`gap-${a.id}`}
                    gapStart={thisEnd}
                    gapEnd={nextStart}
                    info={info ?? { gapMinutes: nextStart - thisEnd, travelOptions: [], currentMode: "" }}
                  />
                );
              })}

              {/* Activity cards */}
              {colActivities.map((activity) => {
                const p          = pending.get(activity.id);
                const sMin       = p ? p.start : calStartMin(activity);
                const eMin       = p ? p.end   : calEndMin(activity);
                const top        = minsToY(sMin);
                const height     = Math.max(24, minsToY(eMin - sMin));
                const isMorning  = isHotelMorning(activity);
                const isSleep    = activity.category === "sleep_in_hotel";
                const isTransfer = activity.category === "transfer";
                const isDragging = !!p;

                // Transfer activities: colour by mode
                const transferModeColor = isTransfer
                  ? (activity.transferMode === "walking" ? MODE_COLOR.walking
                    : activity.transferMode === "transit" ? MODE_COLOR.transit
                    : MODE_COLOR.driving)
                  : null;
                const color = transferModeColor ?? CAT_COLOR[activity.category];

                const linkedSleep   = isMorning
                  ? (() => {
                      const [ty, tm, td] = dateKey.split("-").map(Number);
                      const prevKey = new Date(Date.UTC(ty, tm - 1, td - 1)).toISOString().slice(0, 10);
                      return activities.find((a) => a.category === "sleep_in_hotel" && dateKeyFromTs(a.startTime) === prevKey) ?? null;
                    })()
                  : null;

                const displayTitle    = isMorning ? (linkedSleep?.place ?? "Hotel") : activity.title;
                const displaySubtitle = isMorning ? "Hotel: Accommodation"
                  : isTransfer
                    ? (activity.transferMode === "walking" ? "🚶 Walking"
                      : activity.transferMode === "transit" ? "🚇 Transit"
                      : "🚕 Taxi")
                  : CAT_LABEL[activity.category];

                return (
                  <div
                    key={activity.id}
                    className="absolute rounded-[8px] overflow-hidden transition-shadow duration-150"
                    style={{
                      top,
                      height,
                      left:  isTransfer ? 24 : 6,
                      right: isTransfer ? 24 : 6,
                      background: `linear-gradient(135deg, ${color}22 0%, ${color}14 100%)`,
                      border:     `1px solid ${color}44`,
                      boxShadow:  isDragging ? `0 8px 24px ${color}30, 0 0 0 2px ${color}55` : undefined,
                      zIndex:     isDragging ? 50 : isMorning ? 5 : 10,
                      cursor:     isDragging ? "grabbing" : "grab",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (suppressClickRef.current) return;
                      onEditActivity(activity);
                    }}
                    onPointerDown={(e) => {
                      if ((e.target as HTMLElement).dataset.resize) return;
                      e.preventDefault();
                      startDrag(e, activity, "drag", dateKey, sMin, eMin);
                    }}
                  >
                    <div className="h-[3px] w-full" style={{ background: color }} />
                    {isSleep && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-px" style={{ height: 8, background: `${color}55` }} />}
                    <div className="px-2 pt-1 pb-2 flex flex-col gap-0.5 select-none">
                      <span className="text-[9px] font-bold tracking-widest uppercase leading-none" style={{ color }}>
                        {displaySubtitle}
                      </span>
                      <span className="text-[11px] font-semibold leading-tight truncate" style={{ color: "rgba(255,255,255,0.95)" }}>
                        {displayTitle}
                      </span>
                      {height >= 40 && (
                        <span className="text-[10px] tabular-nums" style={{ color: "rgba(255,255,255,0.6)" }}>
                          {fmtMin(sMin)} – {fmtMin(eMin)}
                        </span>
                      )}
                    </div>
                    {(isMorning || height >= 32) && (
                      <div
                        data-resize="1"
                        className="absolute bottom-0 inset-x-0 h-3 cursor-ns-resize flex items-end justify-center pb-0.5 opacity-0 hover:opacity-100 transition-opacity"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          startDrag(e, activity, "resize-bottom", dateKey, sMin, eMin);
                        }}
                      >
                        <div className="w-8 h-0.5 rounded-full" style={{ background: `${color}80` }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
