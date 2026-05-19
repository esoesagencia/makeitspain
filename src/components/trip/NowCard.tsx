"use client";

import { useState, useCallback } from "react";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { auth } from "@/lib/firebase/auth";
import { db, COLLECTIONS, SUBCOLLECTIONS } from "@/lib/firebase/firestore";
import { Button } from "@/components/ui/Button";
import { formatTime, formatDuration } from "@/lib/utils/time";
import { cn } from "@/lib/utils/cn";
import type { Activity, ActivityCategory } from "@/types";

// ─── Category chip (NowCard style — more prominent than modal badge) ──────────

interface ChipConfig {
  label: string;
  bg: string;
  text: string;
  giftIcon?: boolean;
}

const CHIP: Record<ActivityCategory, ChipConfig> = {
  activity:      { label: "Activity",      bg: "bg-[#C9A84C]/20",  text: "text-[#C9A84C]" },
  transfer:      { label: "Transfer",      bg: "bg-[#38BDF8]/20",  text: "text-[#38BDF8]" },
  meal:          { label: "Meal",          bg: "bg-[#F472B6]/20",  text: "text-[#F472B6]" },
  free_time:     { label: "Free Time",     bg: "bg-white/8",        text: "text-[#7A7060]" },
  surprise:      { label: "Surprise",      bg: "bg-[#F472B6]/20",  text: "text-[#F472B6]", giftIcon: true },
  hotel:         { label: "Hotel",         bg: "bg-amber-400/20",   text: "text-amber-300" },
  sleep_in_hotel:    { label: "Hotel",              bg: "bg-violet-400/20",  text: "text-violet-300" },
  wellness_grooming: { label: "Wellness & Grooming", bg: "bg-pink-400/20",    text: "text-pink-300" },
};

export function CategoryChip({ category }: { category: ActivityCategory }) {
  const cfg = CHIP[category];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
        cfg.bg, cfg.text,
      )}
    >
      {cfg.giftIcon && <GiftIcon />}
      {cfg.label}
    </span>
  );
}

// ─── NowCard ──────────────────────────────────────────────────────────────────

interface NowCardProps {
  activity: Activity;
  tripId: string;
}

export function NowCard({ activity, tripId }: NowCardProps) {
  const currentUid = auth?.currentUser?.uid ?? null;
  const isVisitedByMe = currentUid
    ? activity.visitedBy.includes(currentUid)
    : false;

  const [optimisticVisited, setOptimisticVisited] = useState(false);
  const [marking, setMarking] = useState(false);

  const visited = isVisitedByMe || optimisticVisited;

  const mapsUrl = activity.location
    ? `https://www.google.com/maps/dir/?api=1&destination=${activity.location.latitude},${activity.location.longitude}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(activity.address)}`;

  const handleMarkVisited = useCallback(async () => {
    if (!currentUid || visited || marking) return;
    setMarking(true);
    setOptimisticVisited(true);
    try {
      await updateDoc(
        doc(db, COLLECTIONS.TRIPS, tripId, SUBCOLLECTIONS.ACTIVITIES, activity.id),
        { isVisited: true, visitedBy: arrayUnion(currentUid) },
      );
    } catch {
      setOptimisticVisited(false);
    } finally {
      setMarking(false);
    }
  }, [currentUid, visited, marking, tripId, activity.id]);

  return (
    <div className="rounded-[12px] bg-[#111110] overflow-hidden">
      {/* Gold accent bar at top */}
      <div className="h-0.5 w-full bg-gradient-to-r from-[#C9A84C]/60 via-[#C9A84C] to-[#C9A84C]/60" />

      <div className="p-5">
        {/* Category chip */}
        <div className="mb-3">
          <CategoryChip category={activity.category} />
        </div>

        {/* Title */}
        <h2 className="font-display text-2xl font-bold text-white leading-tight mb-3">
          {activity.title}
        </h2>

        {/* Time — gold prominent */}
        <p className="text-lg font-semibold text-[#C9A84C] mb-1">
          {formatTime(activity.startTime)} – {formatTime(activity.endTime)}
        </p>

        {/* Duration */}
        <p className="text-sm text-[#7A7060] mb-4">
          ~{formatDuration(activity.estimatedDuration)}
        </p>

        {/* Description */}
        {activity.description && (
          <p className="text-sm text-white/80 leading-relaxed mb-4 line-clamp-4">
            {activity.description}
          </p>
        )}

        {/* Address — tappable → Google Maps */}
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-2 mb-4 group"
        >
          <PinIcon className="mt-0.5 shrink-0 text-[#7A7060] group-hover:text-[#C9A84C] transition-colors" />
          <span className="text-sm text-[#7A7060] group-hover:text-white transition-colors leading-snug">
            {activity.address}
          </span>
        </a>

        {/* Recommendations */}
        {activity.recommendations && (
          <div className="mb-4 rounded-[8px] bg-[#080807]/60 p-3.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <LightbulbIcon />
              <span className="text-xs font-semibold text-[#C9A84C] uppercase tracking-wider">
                Recommendations
              </span>
            </div>
            <p className="text-sm text-[#7A7060] leading-relaxed">
              {activity.recommendations}
            </p>
          </div>
        )}

        {/* Coordinator card — surprise only */}
        {activity.category === "surprise" &&
          (activity.contactPhone || activity.contactLink) && (
            <div className="mb-4 rounded-[8px] border-l-2 border-[#C9A84C] bg-[#080807]/60 pl-4 pr-4 py-4">
              <p className="text-xs font-semibold text-[#C9A84C] uppercase tracking-wider mb-3">
                Your Coordinator
              </p>
              <div className="flex flex-col gap-2.5">
                {activity.contactPhone && (
                  <a
                    href={`tel:${activity.contactPhone}`}
                    className="flex items-center gap-2.5 text-sm text-white hover:text-[#C9A84C] transition-colors"
                  >
                    <PhoneIcon className="shrink-0 text-[#C9A84C]" />
                    {activity.contactPhone}
                  </a>
                )}
                {activity.contactLink && (
                  <a
                    href={activity.contactLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 text-sm text-white hover:text-[#C9A84C] transition-colors"
                  >
                    <LinkIcon className="shrink-0 text-[#C9A84C]" />
                    <span className="truncate">{activity.contactLink}</span>
                  </a>
                )}
              </div>
            </div>
          )}

        {/* Mark as Visited */}
        <div className="mt-2">
          {visited ? (
            <div className="w-full h-11 rounded-[8px] bg-[#2ECC71]/15 border border-[#2ECC71]/30 text-[#2ECC71] text-sm font-semibold flex items-center justify-center gap-2">
              <CheckIcon />
              Visited ✓
            </div>
          ) : (
            <Button
              variant="gold"
              size="md"
              className="w-full"
              loading={marking}
              onClick={handleMarkVisited}
              disabled={!currentUid}
            >
              Mark as Visited
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── UpNextCard ───────────────────────────────────────────────────────────────

interface UpNextCardProps {
  activity: Activity;
  onTap: () => void;
}

export function UpNextCard({ activity, onTap }: UpNextCardProps) {
  return (
    <button
      onClick={onTap}
      className="w-full text-left rounded-[12px] bg-[#111110]/70 border border-white/5
                 hover:border-[#C9A84C]/20 hover:bg-[#111110] active:scale-[0.99]
                 transition-all duration-150 group"
    >
      <div className="px-4 py-3.5 flex items-center gap-3">
        {/* Left: label + title */}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A7060] mb-1">
            Up Next
          </p>
          <p className="text-sm font-medium text-white truncate">
            {activity.title}
          </p>
        </div>

        {/* Middle: chip + time */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <CategoryChip category={activity.category} />
          <p className="text-xs text-[#7A7060]">
            {formatTime(activity.startTime)}
          </p>
        </div>

        {/* Chevron */}
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          className="text-[#7A7060] group-hover:text-[#C9A84C] transition-colors shrink-0"
          aria-hidden
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </button>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

export function NowEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-5 h-20 w-20 rounded-full bg-[#111110] border border-white/5 flex items-center justify-center">
        <SunIcon />
      </div>
      <h3 className="font-display text-xl font-semibold text-white mb-2">
        Nothing scheduled right now
      </h3>
      <p className="text-sm text-[#7A7060] max-w-xs leading-relaxed">
        Enjoy Spain — your next adventure will appear here when it&apos;s time.
      </p>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function GiftIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  );
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

function LightbulbIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="9" y1="18" x2="15" y2="18" />
      <line x1="10" y1="22" x2="14" y2="22" />
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A7 7 0 1 0 6.5 11.5c.76.76 1.23 1.52 1.41 2.5" />
    </svg>
  );
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.26h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.03z" />
    </svg>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}
