"use client";

import { useMemo } from "react";
import type { Activity } from "@/types";

interface CurrentActivityResult {
  current: Activity | null;
  upNext: Activity | null;
}

/**
 * Derives the current (or next upcoming) activity from a sorted list.
 * Pass a refreshing `nowMs` value (e.g. updated every 60 s) so the
 * result recalculates purely from time, not just Firestore changes.
 */
export function useCurrentActivity(
  activities: Activity[],
  nowMs: number,
): CurrentActivityResult {
  return useMemo(() => {
    const sorted = [...activities].sort(
      (a, b) => a.startTime.toMillis() - b.startTime.toMillis(),
    );

    // Find an activity whose window contains nowMs
    let currentIdx = -1;
    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i];
      if (a.startTime.toMillis() <= nowMs && a.endTime.toMillis() >= nowMs) {
        currentIdx = i;
        break;
      }
    }

    if (currentIdx === -1) {
      // No active window — show the next upcoming one
      const upcomingIdx = sorted.findIndex((a) => a.startTime.toMillis() > nowMs);
      if (upcomingIdx === -1) return { current: null, upNext: null };
      return {
        current: sorted[upcomingIdx],
        upNext: sorted[upcomingIdx + 1] ?? null,
      };
    }

    return {
      current: sorted[currentIdx],
      upNext: sorted[currentIdx + 1] ?? null,
    };
  }, [activities, nowMs]);
}
