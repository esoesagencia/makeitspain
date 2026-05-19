"use client";

import { useMemo } from "react";
import { toSpainDateKey, formatTime, formatDuration } from "@/lib/utils/time";
import { cn } from "@/lib/utils/cn";
import type { Activity, ActivityCategory } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type DotStatus = "visited" | "current" | "missed" | "upcoming";

interface DayGroup {
  dateKey: string;
  dayNumber: number;
  dateLabel: string; // "Friday, Jun 15"
  activities: Activity[];
}

// ─── Dot status derivation ────────────────────────────────────────────────────

function getDotStatus(a: Activity, nowMs: number): DotStatus {
  if (a.isVisited) return "visited";
  if (a.startTime.toMillis() <= nowMs && a.endTime.toMillis() >= nowMs) return "current";
  if (a.endTime.toMillis() < nowMs) return "missed";
  return "upcoming";
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ScheduleTimelineProps {
  activities: Activity[];
  nowMs: number;
  onActivityTap: (activity: Activity) => void;
}

export function ScheduleTimeline({
  activities,
  nowMs,
  onActivityTap,
}: ScheduleTimelineProps) {
  const dayGroups = useMemo<DayGroup[]>(() => {
    const map = new Map<string, Activity[]>();

    for (const a of activities) {
      const key = toSpainDateKey(a.startTime);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }

    // Sort within each group by startTime
    for (const group of map.values()) {
      group.sort((a, b) => a.startTime.toMillis() - b.startTime.toMillis());
    }

    const sortedKeys = [...map.keys()].sort();

    return sortedKeys.map((key, i) => {
      const first = map.get(key)![0];
      const dateLabel = first.startTime.toDate().toLocaleDateString("en-US", {
        weekday: "long",
        month:   "short",
        day:     "numeric",
        timeZone: "Europe/Madrid",
      });
      return {
        dateKey:    key,
        dayNumber:  i + 1,
        dateLabel,
        activities: map.get(key)!,
      };
    });
  }, [activities]);

  if (dayGroups.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-[#7A7060]">No activities scheduled yet.</p>
      </div>
    );
  }

  return (
    <div className="pb-4">
      {dayGroups.map((group) => (
        <DaySection
          key={group.dateKey}
          group={group}
          nowMs={nowMs}
          onActivityTap={onActivityTap}
        />
      ))}
    </div>
  );
}

// ─── Day section ──────────────────────────────────────────────────────────────

interface DaySectionProps {
  group: DayGroup;
  nowMs: number;
  onActivityTap: (a: Activity) => void;
}

function DaySection({ group, nowMs, onActivityTap }: DaySectionProps) {
  return (
    <div className="mb-2">
      {/* Sticky day header — sits just below the page header (~57px) */}
      <div className="sticky top-[57px] z-10 -mx-4 px-4 py-2.5 bg-[#080807]/95 backdrop-blur-sm border-b border-white/5">
        <h2 className="font-display text-base font-semibold text-white leading-none">
          <span className="text-[#C9A84C]">Day {group.dayNumber}</span>
          <span className="text-white/30 mx-2">—</span>
          <span>{group.dateLabel}</span>
        </h2>
      </div>

      {/* Activity rows */}
      <div className="pt-3">
        {group.activities.map((activity, idx) => {
          const isLast = idx === group.activities.length - 1;
          const status = getDotStatus(activity, nowMs);
          return (
            <ActivityRow
              key={activity.id}
              activity={activity}
              status={status}
              isLast={isLast}
              onTap={() => onActivityTap(activity)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Activity row ─────────────────────────────────────────────────────────────

interface ActivityRowProps {
  activity: Activity;
  status: DotStatus;
  isLast: boolean;
  onTap: () => void;
}

function ActivityRow({ activity, status, isLast, onTap }: ActivityRowProps) {
  return (
    <button
      onClick={onTap}
      className={cn(
        "group flex w-full text-left -mx-4 px-4 rounded-none transition-colors duration-100",
        "hover:bg-white/[0.03] active:bg-white/[0.05]",
        // Current activity: very subtle gold tint
        status === "current" && "bg-[#C9A84C]/[0.04]",
      )}
    >
      {/* Time column */}
      <div className="w-[52px] shrink-0 text-right pr-3 pt-[13px]">
        <span className={cn(
          "text-xs tabular-nums",
          status === "current" ? "text-[#C9A84C] font-medium" : "text-[#7A7060]",
        )}>
          {formatTime(activity.startTime)}
        </span>
      </div>

      {/* Dot + connecting line */}
      <div className="relative flex flex-col items-center w-4 shrink-0">
        {/* Dot */}
        <div className={cn("mt-3 relative z-10 shrink-0", dotSizeClass(status))}>
          <DotShape status={status} />
        </div>
        {/* Line segment connecting to the next row */}
        {!isLast && (
          <div className="flex-1 w-px bg-[#C9A84C]/20 mt-1" />
        )}
      </div>

      {/* Content */}
      <div className={cn(
        "flex-1 pl-3 min-h-[44px]",
        isLast ? "pb-4" : "pb-5",
      )}>
        <div className="flex items-start justify-between gap-2 pt-2">
          <p className={cn(
            "text-sm leading-snug font-medium",
            status === "missed"   && "text-white/40 line-through",
            status === "visited"  && "text-white/60",
            status === "current"  && "text-white",
            status === "upcoming" && "text-white",
          )}>
            {activity.title}
          </p>
          {/* Visited checkmark */}
          {status === "visited" && (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2ECC71" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5" aria-label="Visited">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>

        {/* Category icon + duration */}
        <div className="flex items-center gap-1.5 mt-1">
          <CategoryIcon category={activity.category} status={status} />
          <span className="text-xs text-[#7A7060]">
            {formatDuration(activity.estimatedDuration)}
          </span>
        </div>
      </div>
    </button>
  );
}

// ─── Dot shape ────────────────────────────────────────────────────────────────

function dotSizeClass(status: DotStatus) {
  return status === "current" ? "w-3.5 h-3.5" : "w-2.5 h-2.5";
}

function DotShape({ status }: { status: DotStatus }) {
  if (status === "visited") {
    return <div className="w-full h-full rounded-full bg-[#2ECC71]" />;
  }
  if (status === "current") {
    return (
      <div className="relative w-full h-full">
        <div className="absolute inset-0 rounded-full bg-[#C9A84C] animate-pulse" />
        <div className="absolute inset-0 rounded-full bg-[#C9A84C]" />
      </div>
    );
  }
  if (status === "missed") {
    return <div className="w-full h-full rounded-full bg-[#E74C3C]" />;
  }
  // upcoming — outlined
  return (
    <div className="w-full h-full rounded-full border-2 border-[#7A7060]/50 bg-transparent" />
  );
}

// ─── Category icon ────────────────────────────────────────────────────────────

function CategoryIcon({
  category,
  status,
}: {
  category: ActivityCategory;
  status: DotStatus;
}) {
  const color = status === "missed" || status === "visited" ? "#6A6A6A" : "#7A7060";
  const size = 13;
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (category) {
    case "transfer":
      return (
        <svg {...props}>
          <rect x="1" y="3" width="15" height="13" rx="2" />
          <path d="M16 8h4l3 5v3h-7V8z" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      );
    case "meal":
      return (
        <svg {...props}>
          <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
          <line x1="7" y1="2" x2="7" y2="11" />
          <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
        </svg>
      );
    case "free_time":
      return (
        <svg {...props}>
          <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
          <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
          <line x1="6" y1="1" x2="6" y2="4" />
          <line x1="10" y1="1" x2="10" y2="4" />
          <line x1="14" y1="1" x2="14" y2="4" />
        </svg>
      );
    case "surprise":
      return (
        <svg {...props}>
          <polyline points="20 12 20 22 4 22 4 12" />
          <rect x="2" y="7" width="20" height="5" />
          <line x1="12" y1="22" x2="12" y2="7" />
          <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
          <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
        </svg>
      );
    case "wellness_grooming":
      return (
        <svg {...props}>
          <path d="M12 22c0 0-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      );
    case "activity":
    default:
      return (
        <svg {...props}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      );
  }
}
