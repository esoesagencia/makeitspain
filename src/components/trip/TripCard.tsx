"use client";

import { Badge } from "@/components/ui/Badge";
import { formatDateRange } from "@/lib/utils/time";
import type { Trip } from "@/types";

interface TripCardProps {
  trip: Trip;
  onClick: () => void;
}

export function TripCard({ trip, onClick }: TripCardProps) {
  const dateRange = formatDateRange(trip.startDate, trip.endDate);
  return (
    <button
      onClick={onClick}
      className="group w-full text-left rounded-2xl p-5 lg:p-6 border transition-all duration-250 cursor-pointer relative overflow-hidden bg-white active:scale-[0.99]"
      style={{
        borderColor: "rgba(180,100,90,0.12)",
        boxShadow: "0 1px 4px rgba(120,60,50,0.06), 0 4px 16px rgba(120,60,50,0.04)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(217,64,64,0.25)";
        e.currentTarget.style.boxShadow = "0 4px 20px rgba(217,64,64,0.12), 0 1px 4px rgba(120,60,50,0.06)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(180,100,90,0.12)";
        e.currentTarget.style.boxShadow = "0 1px 4px rgba(120,60,50,0.06), 0 4px 16px rgba(120,60,50,0.04)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {/* Hover top bar */}
      <div className="absolute top-0 inset-x-0 h-[3px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-t-2xl"
        style={{ background: "#D94040" }} />

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-xl lg:text-2xl font-semibold text-[#1E0E0B] leading-tight truncate">
            {trip.tripName}
          </h2>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-[#9A7A78]">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
              <circle cx="12" cy="9" r="2.5"/>
            </svg>
            <span className="truncate">{trip.destination}</span>
          </p>
        </div>
        <Badge status={trip.status} className="shrink-0 mt-0.5" />
      </div>

      {/* Bottom section: date + handcrafted on left, big arrow on right */}
      <div className="mt-4 pt-4 flex items-stretch gap-3" style={{ borderTop: "1px solid rgba(180,100,90,0.08)" }}>

        {/* Left: stacked date + handcrafted */}
        <div className="flex-1 flex flex-col justify-between gap-2">
          <p className="text-xs text-[#9A7A78] flex items-center gap-1.5">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            {dateRange}
          </p>

          {/* Handcrafted by line */}
          <div className="flex items-center gap-1.5">
            <img
              src="/autor.png"
              alt="Yulia"
              className="w-5 h-5 rounded-full object-cover shrink-0"
              style={{ border: "1px solid rgba(217,64,64,0.2)" }}
            />
            <span className="text-[10px] text-[#C4AAA8]">
              Handcrafted by <span className="font-semibold text-[#9A7A78]">Yulia</span>
            </span>
          </div>
        </div>

        {/* Right: big arrow spanning both lines */}
        <div className="flex items-center shrink-0">
          <div className="text-[#C4AAA8] group-hover:text-[#D94040] group-active:text-[#C03030] group-active:-translate-x-1 transition-all duration-150">
            <svg
              width="28" height="28"
              viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </div>
        </div>
      </div>
    </button>
  );
}
