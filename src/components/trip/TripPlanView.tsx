"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { toSpainDateKey } from "@/lib/utils/time";
import { ActivityPlanCard } from "./ActivityPlanCard";
import { TransferPlanCard } from "./TransferPlanCard";
import type { TripTab } from "./BottomNav";
import type { Activity, Trip } from "@/types";

// ─── Day group ────────────────────────────────────────────────────────────────

interface DayGroup {
  dateKey: string;
  dayNumber: number;
  shortLabel: string;
  longLabel: string;
  activities: Activity[];
}

function buildDayGroups(activities: Activity[]): DayGroup[] {
  const map = new Map<string, Activity[]>();
  for (const a of activities) {
    const key = toSpainDateKey(a.startTime);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(a);
  }
  for (const group of map.values()) {
    group.sort((a, b) => a.startTime.toMillis() - b.startTime.toMillis());
  }
  const sortedKeys = [...map.keys()].sort();
  return sortedKeys.map((key, i) => {
    const d = map.get(key)![0].startTime.toDate();
    return {
      dateKey: key,
      dayNumber: i + 1,
      shortLabel: d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", timeZone: "Europe/Madrid" }),
      longLabel:  d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "Europe/Madrid" }),
      activities: map.get(key)!,
    };
  });
}

function detectActiveDay(groups: DayGroup[], nowMs: number): string | null {
  if (groups.length === 0) return null;
  for (const g of groups)
    for (const a of g.activities)
      if (a.startTime.toMillis() <= nowMs && a.endTime.toMillis() >= nowMs) return g.dateKey;
  for (const g of groups)
    if (g.activities.some((a) => a.startTime.toMillis() > nowMs)) return g.dateKey;
  return groups[groups.length - 1].dateKey;
}

// ─── Sidebar nav button ───────────────────────────────────────────────────────

function SidebarNavBtn({
  label,
  active,
  onClick,
  animDelay,
  icon,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  animDelay: string;
  icon: (color: string) => React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);

  const iconColor  = hovered ? "#fff" : active ? "#D94040" : "#C07060";
  const textColor  = hovered ? "#fff" : active ? "#D94040" : "#9A7A78";
  const bg         = hovered
    ? "#D94040"
    : "linear-gradient(135deg, rgba(217,64,64,0.13) 0%, rgba(255,130,80,0.09) 100%)";
  const border     = hovered ? "1px solid #D94040" : "1px solid rgba(217,64,64,0.22)";
  const shadow     = hovered
    ? "0 6px 20px rgba(217,64,64,0.35)"
    : "0 2px 8px rgba(180,80,60,0.1)";

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex flex-1 flex-col items-center gap-1 px-2 py-3 rounded-2xl select-none"
      style={{
        background: bg,
        border,
        boxShadow: shadow,
        cursor: onClick ? "pointer" : "default",
        transform: hovered ? "scale(1.06)" : "scale(1)",
        transition: "transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease, border-color 0.18s ease",
      }}
    >
      <span style={{ animation: `iconPop 0.55s ease both ${animDelay}`, display: "flex" }}>
        {icon(iconColor)}
      </span>
      <span style={{
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: "0.05em",
        color: textColor,
        transition: "color 0.18s ease",
        animation: `iconPop 0.55s ease both ${animDelay}`,
      }}>
        {label}
      </span>
      <span style={{
        height: 2,
        width: 16,
        borderRadius: 999,
        background: hovered ? "rgba(255,255,255,0.7)" : active ? "#D94040" : "transparent",
        transition: "background 0.18s ease",
      }} />
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

interface TripPlanViewProps {
  activities: Activity[];
  trip: Trip;
  nowMs: number;
  onTabChange?: (tab: TripTab) => void;
}

export function TripPlanView({ activities, trip, nowMs, onTabChange }: TripPlanViewProps) {
  const router = useRouter();
  const dayGroups = useMemo(() => buildDayGroups(activities), [activities]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const pillsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (dayGroups.length > 0 && selectedKey === null)
      setSelectedKey(detectActiveDay(dayGroups, nowMs));
  }, [dayGroups, nowMs, selectedKey]);

  useEffect(() => {
    if (!pillsRef.current || !selectedKey) return;
    const btn = pillsRef.current.querySelector(`[data-key="${selectedKey}"]`) as HTMLElement | null;
    btn?.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
  }, [selectedKey]);

  const selectedGroup = dayGroups.find((g) => g.dateKey === selectedKey);

  if (dayGroups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 text-center px-6">
        <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center"
          style={{ boxShadow: "0 4px 20px rgba(217,64,64,0.1)", border: "1px solid rgba(217,64,64,0.15)" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke="#D94040" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </div>
        <div>
          <p className="font-display text-xl text-[#1E0E0B] mb-1">Plan being prepared</p>
          <p className="text-sm text-[#9A7A78]">Your coordinator is crafting your perfect itinerary.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="lg:flex lg:min-h-screen lg:max-w-[1400px] lg:mx-auto">

      {/* ── Desktop Sidebar column ── */}
      <div className="hidden lg:flex flex-col shrink-0 w-60 xl:w-72 sticky top-[81px] self-start ml-10 mt-4 mb-4 gap-3" style={{ maxHeight: "calc(100vh - 89px)" }}>

        {/* Itinerary card */}
        <aside className="flex flex-col bg-white rounded-2xl overflow-y-auto"
          style={{
            border: "1px solid rgba(180,100,90,0.12)",
            boxShadow: "0 4px 20px rgba(120,60,50,0.08)",
            maxHeight: "calc(100vh - 89px - 88px)",
          }}>

          {/* Coral top stripe */}
          <div className="h-[3px] rounded-t-2xl bg-[#D94040]" />

          <div className="px-5 pt-7 pb-5">
            <p className="text-[10px] font-semibold tracking-[0.25em] uppercase text-[#9A7A78] mb-1.5">Your Itinerary</p>
            <h2 className="font-display text-xl font-semibold leading-tight" style={{ color: "#D94040" }}>{trip.tripName}</h2>
            {trip.destination && (
              <p className="mt-1 text-xs text-[#9A7A78] flex items-center gap-1.5">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                  <circle cx="12" cy="9" r="2.5"/>
                </svg>
                {trip.destination}
              </p>
            )}
          </div>

          <div className="mx-5 mb-4 h-px bg-[#D94040]/10" />

          <nav className="px-3 flex flex-col gap-1 pb-6">
            {dayGroups.map((g) => {
              const active = g.dateKey === selectedKey;
              const hasCurrent = g.activities.some((a) => a.startTime.toMillis() <= nowMs && a.endTime.toMillis() >= nowMs);
              return (
                <button key={g.dateKey} data-key={g.dateKey}
                  onClick={() => setSelectedKey(g.dateKey)}
                  className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200"
                  style={active ? { background: "rgba(217,64,64,0.08)" } : {}}
                >
                  <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                    style={active
                      ? { background: "#D94040", color: "white" }
                      : { background: "rgba(217,64,64,0.08)", color: "#D94040" }
                    }>{g.dayNumber}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: active ? "#D94040" : "#6B4845" }}>
                      {g.shortLabel}
                    </p>
                    <p className="text-[10px] truncate text-[#9A7A78]">
                      {g.activities.length} {g.activities.length === 1 ? "experience" : "experiences"}
                    </p>
                  </div>
                  {hasCurrent && <span className="w-2 h-2 rounded-full bg-[#D94040] animate-pulse shrink-0" />}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* ── Nav buttons below the card ── */}
        <div className="flex items-stretch gap-2">

          <SidebarNavBtn
            label="Trip Plan"
            active
            animDelay="0.05s"
            icon={(c) => (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
                <line x1="8" y1="14" x2="10" y2="14"/><line x1="8" y1="18" x2="14" y2="18"/>
              </svg>
            )}
          />

          <SidebarNavBtn
            label="My Group"
            animDelay="0.15s"
            onClick={() => router.push(`/trip/${trip.id}/group`)}
            icon={(c) => (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            )}
          />

          <SidebarNavBtn
            label="Trip Info"
            animDelay="0.25s"
            onClick={() => onTabChange?.("info")}
            icon={(c) => (
              <svg width="20" height="20" viewBox="0 0 512 512" fill="none"
                stroke={c} strokeWidth="26.624" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M204.055 213.905q-18.12-5.28-34.61-9a145.92 145.92 0 0 1-6.78-44.33c0-65.61 42.17-118.8 94.19-118.8 52.02 0 94.15 53.14 94.15 118.76a146.3 146.3 0 0 1-6.16 42.32q-20.52 4.3-43.72 11.05c-22 6.42-39.79 12.78-48.56 16.05-8.72-3.27-26.51-9.63-48.51-16.05zm-127.95 84.94a55.16 55.16 0 1 0 55.16 55.15 55.16 55.16 0 0 0-55.16-55.15zm359.79 0a55.16 55.16 0 1 0 55.16 55.15 55.16 55.16 0 0 0-55.15-55.15zm-71.15 55.15a71.24 71.24 0 0 1 42.26-65v-77.55c-64.49 0-154.44 35.64-154.44 35.64s-89.95-35.64-154.44-35.64v74.92a71.14 71.14 0 0 1 0 135.28v7c64.49 0 154.44 41.58 154.44 41.58s89.99-41.55 154.44-41.55v-9.68a71.24 71.24 0 0 1-42.26-65z"/>
              </svg>
            )}
          />

        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 min-w-0">
        {/* Mobile day pills */}
        <div className="lg:hidden sticky top-[57px] z-10 bg-[#F5EDED]/95 backdrop-blur-md border-b py-2.5"
          style={{ borderColor: "rgba(217,64,64,0.1)" }}>
          <div ref={pillsRef} className="flex gap-2 px-4 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: "none" }}>
            {dayGroups.map((g) => {
              const active = g.dateKey === selectedKey;
              const hasCurrent = g.activities.some((a) => a.startTime.toMillis() <= nowMs && a.endTime.toMillis() >= nowMs);
              return (
                <button key={g.dateKey} data-key={g.dateKey}
                  onClick={() => setSelectedKey(g.dateKey)}
                  className={cn("flex-shrink-0 flex flex-col items-center px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 relative",
                    active ? "text-white" : "text-[#9A7A78]"
                  )}
                  style={active ? { background: "#D94040", boxShadow: "0 2px 10px rgba(217,64,64,0.3)" } : { background: "white", border: "1px solid rgba(217,64,64,0.15)" }}
                >
                  <span className="text-[10px] font-bold tracking-widest uppercase leading-none mb-0.5">Day {g.dayNumber}</span>
                  <span className="text-[11px] leading-none">{g.shortLabel}</span>
                  {hasCurrent && !active && <span className="absolute top-0.5 right-1 w-1.5 h-1.5 rounded-full bg-[#D94040]" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mobile progress bar — sticky just below the pills bar, above heading */}
        {selectedGroup && (
          <div className="lg:hidden sticky z-[9] bg-[#F5EDED]/95 backdrop-blur-md px-4 pt-2 pb-1"
            style={{ top: STICKY_BASE_TOP, borderBottom: "1px solid rgba(217,64,64,0.07)" }}>
            <DayProgressBar dayKey={selectedGroup.dateKey} />
          </div>
        )}

        {/* Day heading */}
        {selectedGroup && (
          <div className="px-4 lg:px-10 pt-6 pb-3 lg:pt-8 lg:pb-5">
            <div className="hidden lg:block">
              <p className="text-[10px] font-semibold tracking-[0.3em] uppercase text-[#9A7A78] mb-1.5">Day {selectedGroup.dayNumber}</p>
              <h2 className="font-display text-4xl xl:text-5xl font-light text-[#1E0E0B] leading-tight">{selectedGroup.longLabel}</h2>
              <div className="mt-3">
                <span className="text-xs text-[#9A7A78] tracking-widest uppercase">
                  {selectedGroup.activities.length} {selectedGroup.activities.length === 1 ? "experience" : "experiences"}
                </span>
              </div>
            </div>
            <div className="lg:hidden">
              <h2 className="font-display text-base font-semibold text-[#1E0E0B]">
                <span className="text-[#D94040]">Day {selectedGroup.dayNumber}</span>
                <span className="text-[#C4AAA8] mx-2">—</span>
                <span>{selectedGroup.longLabel}</span>
              </h2>
            </div>
          </div>
        )}

        {/* Desktop progress bar — sticky below the heading, above cards */}
        {selectedGroup && (
          <div className="hidden lg:sticky lg:block z-10 bg-[#F5EDED]/95 backdrop-blur-md px-10 pt-2 pb-2"
            style={{ top: 65, borderBottom: "1px solid rgba(217,64,64,0.07)" }}>
            <DayProgressBar dayKey={selectedGroup.dateKey} />
          </div>
        )}

        {selectedGroup && <DayPlan group={selectedGroup} nowMs={nowMs} />}
      </div>
    </div>
  );
}

// ─── Day plan ─────────────────────────────────────────────────────────────────

// Mobile header breakdown for sticky top calculation:
//   Page header:   ~57px  (py-3.5 * 2 + 18px icon ≈ 57px)
//   Day pills bar: ~52px  (py-2.5 * 2 + pill height 36px ≈ 52px)
//   Total base:     109px
const STICKY_BASE_TOP = 109;
// Progress bar (pt-2=8 + height=34 + pb-1=4 = 46px) sticks at STICKY_BASE_TOP.
// Cards must start below it so the time row isn't covered.
const MOBILE_CARD_TOP = STICKY_BASE_TOP + 46; // 155px
// Desktop progress bar (pt-2=8 + height=34 + pb-2=8 = 50px) sticks at 65px.
const DESKTOP_CARD_TOP = 65 + 50; // 115px
const PEEK_HEIGHT = 8; // px of previous card that peeks above the next

function DayPlan({ group, nowMs }: { group: DayGroup; nowMs: number }) {
  if (group.activities.length === 0) return (
    <div className="py-12 text-center"><p className="text-sm text-[#9A7A78]">No activities for this day.</p></div>
  );

  return (
    <div className="px-4 lg:px-10 pb-12">

      {/* Mobile — sticky stacking cards
          IMPORTANT: all sticky siblings must share the SAME parent element —
          no extra wrapper divs per card, otherwise each sticky is scoped
          to its own tiny containing block and won't stack.
          Sentinels are non-sticky siblings used by DayProgressBar for position measurement —
          sticky elements give clamped getBoundingClientRect() which breaks scroll math. */}
      <div className="lg:hidden pt-3 pb-[60vh]">
        <div key="__start__" data-day-start={group.dateKey} style={{ height: 0 }} />
        {group.activities.flatMap((activity, idx) => {
          const prev = group.activities[idx - 1];
          const showTransfer = idx > 0 && prev.address && activity.address &&
            !(activity.category === "hotel" && activity.estimatedDuration === 0);
          const stickyTop = MOBILE_CARD_TOP + idx * PEEK_HEIGHT;

          const items: React.ReactNode[] = [];

          // Transfer cards scroll normally (non-sticky), rendered as direct siblings
          if (showTransfer) {
            items.push(
              <div key={`transfer-${activity.id}`} className="mb-3" style={{ zIndex: 0, position: "relative" }}>
                <TransferPlanCard from={prev} to={activity} nowMs={nowMs} />
              </div>
            );
          }

          // Activity card — sticky, direct sibling → stacks correctly on scroll
          items.push(
            <div
              key={activity.id}
              className="animate-fade-up mb-3"
              style={{
                position: "sticky",
                top: stickyTop,
                zIndex: idx + 1,
                animationDelay: `${idx * 60}ms`,
                animationFillMode: "both",
                borderRadius: 16,
                boxShadow: "0 2px 12px rgba(120,60,50,0.10), 0 1px 3px rgba(120,60,50,0.06)",
              }}
            >
              <ActivityPlanCard activity={activity} nowMs={nowMs} />
            </div>
          );

          return items;
        })}
        <div key="__end__" data-day-end={group.dateKey} style={{ height: 0 }} />
      </div>

      {/* Desktop — sticky stacking cards (same principle as mobile)
          All sticky siblings must share the same parent — no per-card wrapper divs. */}
      <div className="hidden lg:block pt-4 pb-[60vh]">
        <div key="__start__" data-day-start={group.dateKey} style={{ height: 0 }} />
        {group.activities.flatMap((activity, idx) => {
          const prev = group.activities[idx - 1];
          const showTransfer = idx > 0 && prev.address && activity.address &&
            !(activity.category === "hotel" && activity.estimatedDuration === 0);
          // Desktop: header (~65px) + progress bar (50px). Each card peeks PEEK_HEIGHT px.
          const stickyTop = DESKTOP_CARD_TOP + idx * PEEK_HEIGHT;

          const items: React.ReactNode[] = [];

          if (showTransfer) {
            items.push(
              <div key={`transfer-${activity.id}`} className="ml-14 mb-2" style={{ position: "relative", zIndex: 0 }}>
                <TransferPlanCard from={prev} to={activity} nowMs={nowMs} />
              </div>
            );
          }

          items.push(
            <div
              key={activity.id}
              className="animate-fade-up flex items-start gap-5 mb-2"
              style={{
                position: "sticky",
                top: stickyTop,
                zIndex: idx + 1,
                animationDelay: `${idx * 80}ms`,
                animationFillMode: "both",
              }}
            >
              {/* Step dot */}
              <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-white"
                style={{
                  border: "2px solid rgba(217,64,64,0.25)",
                  boxShadow: "0 2px 8px rgba(217,64,64,0.1)",
                  zIndex: 1,
                }}>
                <span className="text-[11px] font-bold text-[#D94040]">{idx + 1}</span>
              </div>
              {/* Card */}
              <div className="flex-1" style={{ borderRadius: 16, boxShadow: "0 2px 12px rgba(120,60,50,0.10)" }}>
                <ActivityPlanCard activity={activity} nowMs={nowMs} />
              </div>
            </div>
          );

          return items;
        })}
        <div key="__end__" data-day-end={group.dateKey} style={{ height: 0 }} />
      </div>
    </div>
  );
}

// ─── Day progress bar ─────────────────────────────────────────────────────────

const PROGRESS_ICON_PX = 22;

function DayProgressBar({ dayKey }: { dayKey: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fillRef      = useRef<HTMLDivElement>(null);
  const iconRef      = useRef<HTMLDivElement>(null);
  const [iconType, setIconType] = useState<"sunrise" | "sun" | "moon">("sunrise");

  useEffect(() => {
    // Reset on day change
    if (fillRef.current) fillRef.current.style.width = "0%";
    if (iconRef.current) iconRef.current.style.left = "0px";
    setIconType("sunrise");

    function handleScroll() {
      // Use non-sticky sentinel divs (data-day-start / data-day-end) for position measurement.
      // Sticky elements return clamped screen positions from getBoundingClientRect(),
      // which breaks scroll math — sentinels are regular flow elements so their positions are accurate.
      const startEl = (Array.from(
        document.querySelectorAll(`[data-day-start="${dayKey}"]`)
      ) as HTMLElement[]).find(el => el.offsetParent !== null);
      const endEl = (Array.from(
        document.querySelectorAll(`[data-day-end="${dayKey}"]`)
      ) as HTMLElement[]).find(el => el.offsetParent !== null);
      if (!startEl || !endEl) return;

      const firstDocTop   = startEl.getBoundingClientRect().top  + window.scrollY;
      const lastDocBottom = endEl.getBoundingClientRect().bottom + window.scrollY;

      const topOffset       = window.innerWidth >= 1024 ? 65 : STICKY_BASE_TOP;
      const dayStartScrollY = firstDocTop - topOffset;
      const dayEndScrollY   = lastDocBottom - window.innerHeight * 0.5;

      const range = Math.max(1, dayEndScrollY - dayStartScrollY);
      const frac  = Math.min(1, Math.max(0, (window.scrollY - dayStartScrollY) / range));
      const pct   = frac * 100;

      // Direct DOM writes — no React re-render, no CSS transition lag
      if (fillRef.current) {
        fillRef.current.style.width = `${pct}%`;
      }
      if (iconRef.current && containerRef.current) {
        const w    = containerRef.current.offsetWidth;
        const left = Math.min(Math.max(0, (pct / 100) * w - PROGRESS_ICON_PX / 2), w - PROGRESS_ICON_PX);
        iconRef.current.style.left = `${left}px`;
      }

      const next: "sunrise" | "sun" | "moon" =
        pct < 15 ? "sunrise" : pct < 85 ? "sun" : "moon";
      setIconType(prev => prev !== next ? next : prev);
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [dayKey]);

  const iconTransition = "opacity 0.4s ease, transform 0.4s cubic-bezier(0.34,1.56,0.64,1)";

  return (
    <div ref={containerRef} className="relative" style={{ height: 34 }}>
      {/* Track */}
      <div className="absolute rounded-full"
        style={{ left: 0, right: 0, bottom: 3, height: 3, background: "rgba(180,100,90,0.12)" }}
      />
      {/* Fill — width driven by ref, no CSS transition */}
      <div ref={fillRef} className="absolute rounded-full"
        style={{ left: 0, bottom: 3, height: 3, width: "0%", background: "#D94040" }}
      />
      {/* Icon — left driven by ref, no CSS transition; only icon-type change animates */}
      <div ref={iconRef} style={{
        position: "absolute", left: 0, bottom: 10,
        width: PROGRESS_ICON_PX, height: PROGRESS_ICON_PX,
        color: "#D94040",
      }}>
        <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          opacity: iconType === "sunrise" ? 1 : 0, transform: iconType === "sunrise" ? "scale(1)" : "scale(0)",
          transition: iconTransition }}>
          <SunriseIcon size={PROGRESS_ICON_PX} />
        </span>
        <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          opacity: iconType === "sun" ? 1 : 0, transform: iconType === "sun" ? "scale(1)" : "scale(0)",
          transition: iconTransition }}>
          <SunIcon size={PROGRESS_ICON_PX} />
        </span>
        <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          opacity: iconType === "moon" ? 1 : 0, transform: iconType === "moon" ? "scale(1)" : "scale(0)",
          transition: iconTransition }}>
          <MoonIcon size={PROGRESS_ICON_PX} />
        </span>
      </div>
    </div>
  );
}

function SunriseIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 1a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0V2a1 1 0 0 1 1-1ZM0 13a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2H1a1 1 0 0 1-1-1ZM20 13a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2h-2a1 1 0 0 1-1-1ZM20.485 4.515a1 1 0 0 1 0 1.414l-1.414 1.414a1 1 0 0 1-1.414-1.414l1.414-1.414a1 1 0 0 1 1.414 0ZM3.515 4.515a1 1 0 0 1 1.414 0l1.414 1.414A1 1 0 1 1 4.93 7.343L3.515 5.93a1 1 0 0 1 0-1.414ZM7 21a1 1 0 0 1 1-1h8a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1ZM20 17h-2.257A6.96 6.96 0 0 0 19 13c0-3.862-3.138-7-7-7s-7 3.138-7 7c0 1.483.459 2.865 1.247 4H4a1 1 0 1 0 0 2h16a1 1 0 1 0 0-2Z" />
    </svg>
  );
}

function SunIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0V1a1 1 0 0 1 1-1ZM0 12a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2H1a1 1 0 0 1-1-1ZM21 11a1 1 0 1 0 0 2h2a1 1 0 1 0 0-2h-2ZM13 21a1 1 0 1 0-2 0v2a1 1 0 1 0 2 0v-2ZM6.343 17.657a1 1 0 0 1 0 1.414L4.93 20.485a1 1 0 1 1-1.414-1.414l1.414-1.414a1 1 0 0 1 1.414 0ZM20.485 3.515a1 1 0 0 1 0 1.414l-1.414 1.414a1 1 0 1 1-1.414-1.414l1.414-1.414a1 1 0 0 1 1.414 0ZM3.515 3.515a1 1 0 0 1 1.414 0l1.414 1.414A1 1 0 1 1 4.93 6.343L3.515 4.93a1 1 0 0 1 0-1.414ZM17.657 17.657a1 1 0 0 1 1.414 0l1.414 1.414a1 1 0 1 1-1.414 1.414l-1.414-1.414a1 1 0 0 1 0-1.414ZM5 12a7 7 0 1 1 14 0 7 7 0 0 1-14 0Z" />
    </svg>
  );
}

function MoonIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 22C17.5228 22 22 17.5228 22 12C22 11.5373 21.3065 11.4608 21.0672 11.8568C19.9289 13.7406 17.8615 15 15.5 15C11.9101 15 9 12.0899 9 8.5C9 6.13845 10.2594 4.07105 12.1432 2.93276C12.5392 2.69347 12.4627 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
    </svg>
  );
}

// ─── Stack card wrappers ──────────────────────────────────────────────────────

function StackCard({ children }: { children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div className="relative transition-transform duration-250"
      style={{ transform: hovered ? "translateY(-2px)" : "translateY(0)" }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {/* Ghost card layers for depth */}
      <div className="absolute inset-x-2.5 bottom-0 rounded-2xl bg-white"
        style={{ height: "100%", transform: "translateY(5px) scaleX(0.96)", zIndex: -1, opacity: 0.7, border: "1px solid rgba(180,100,90,0.08)" }} />
      <div className="absolute inset-x-5 bottom-0 rounded-2xl bg-white"
        style={{ height: "100%", transform: "translateY(9px) scaleX(0.92)", zIndex: -2, opacity: 0.4, border: "1px solid rgba(180,100,90,0.06)" }} />
      <div style={{
        borderRadius: "16px",
        boxShadow: hovered
          ? "0 8px 28px rgba(120,60,50,0.14), 0 2px 6px rgba(120,60,50,0.06)"
          : "0 2px 8px rgba(120,60,50,0.08), 0 1px 3px rgba(120,60,50,0.05)",
        transition: "box-shadow 0.25s ease",
      }}>
        {children}
      </div>
    </div>
  );
}

function DesktopCard({ children }: { children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div className="transition-all duration-250"
      style={{ transform: hovered ? "translateY(-2px)" : "translateY(0)" }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div style={{
        borderRadius: "16px",
        boxShadow: hovered
          ? "0 12px 40px rgba(120,60,50,0.14), 0 2px 6px rgba(120,60,50,0.06)"
          : "0 2px 10px rgba(120,60,50,0.08)",
        transition: "box-shadow 0.25s ease",
      }}>
        {children}
      </div>
    </div>
  );
}
