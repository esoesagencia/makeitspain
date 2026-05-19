"use client";

import { useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils/cn";
import { formatTime, formatDuration } from "@/lib/utils/time";
import type { Activity, ActivityCategory } from "@/types";

// ─── Status helpers ───────────────────────────────────────────────────────────

type CardStatus = "current" | "upcoming" | "past";

function getCardStatus(a: Activity, nowMs: number): CardStatus {
  if (a.endTime.toMillis() < nowMs) return "past";
  if (a.startTime.toMillis() <= nowMs) return "current";
  return "upcoming";
}

// ─── Per-category design tokens ───────────────────────────────────────────────

interface CategoryStyle {
  label:       string;
  color:       string;   // text / icon color
  bg:          string;   // card background
  pill:        string;   // inline-style for pill bg
  pillText:    string;
  bar:         string;   // top accent bar gradient
}

function getCategoryStyle(cat: ActivityCategory): CategoryStyle {
  switch (cat) {
    case "transfer":
      return {
        label:    "Transfer",
        color:    "#1A56DB",
        bg:       "#BFDBFE",          // vivid sky blue
        pill:     "rgba(59,111,202,0.18)",
        pillText: "#1A56DB",
        bar:      "linear-gradient(90deg, #1A56DB, #3B6FCA88)",
      };
    case "meal":
      return {
        label:    "Dining",
        color:    "#92570A",
        bg:       "#FDE68A",          // vivid amber yellow
        pill:     "rgba(192,124,16,0.2)",
        pillText: "#92570A",
        bar:      "linear-gradient(90deg, #C07C10, #F59E0B88)",
      };
    case "free_time":
      return {
        label:    "Free Time",
        color:    "#5B21B6",
        bg:       "#C4B5FD",          // vivid purple
        pill:     "rgba(139,77,192,0.2)",
        pillText: "#5B21B6",
        bar:      "linear-gradient(90deg, #7C3AED, #A78BFA88)",
      };
    case "surprise":
      return {
        label:    "Surprise",
        color:    "#6B21A8",
        bg:       "#E9D5FF",          // vivid violet
        pill:     "rgba(139,77,192,0.2)",
        pillText: "#6B21A8",
        bar:      "linear-gradient(90deg, #8B4DC0, #A855F788)",
      };
    case "hotel":
      return {
        label:    "Hotel",
        color:    "#9A3412",
        bg:       "#FED7AA",          // vivid peach orange
        pill:     "rgba(192,90,40,0.2)",
        pillText: "#9A3412",
        bar:      "linear-gradient(90deg, #C05A28, #FB923C88)",
      };
    case "sleep_in_hotel":
      return {
        label:    "Hotel/Accommodation Night",
        color:    "#1E3A8A",
        bg:       "#C7D2FE",
        pill:     "rgba(44,78,138,0.2)",
        pillText: "#1E3A8A",
        bar:      "linear-gradient(90deg, #2C4E8A, #6366F188)",
      };
    case "wellness_grooming":
      return {
        label:    "Wellness & Grooming",
        color:    "#BE185D",
        bg:       "#FBCFE8",
        pill:     "rgba(190,24,93,0.18)",
        pillText: "#BE185D",
        bar:      "linear-gradient(90deg, #BE185D, #F472B688)",
      };
    default: // "activity"
      return {
        label:    "Activity",
        color:    "#0D6E4E",
        bg:       "#A7F3D0",          // vivid emerald green
        pill:     "rgba(26,158,114,0.2)",
        pillText: "#0D6E4E",
        bar:      "linear-gradient(90deg, #1A9E72, #34D39988)",
      };
  }
}

// ─── Big decorative category icon (client card) ──────────────────────────────

function ClientCategoryBigIcon({ category, color, isPast, wobbleKey, isHotelMorningCard }: {
  category: ActivityCategory;
  color: string;
  isPast: boolean;
  wobbleKey: number;
  isHotelMorningCard?: boolean;
}) {
  const iconColor = isPast ? "#B0A0A0" : color;

  const icon = (() => {
    if (isHotelMorningCard) {
      return (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="6"/>
          <path d="M12 2V3"/><path d="M12 21V22"/>
          <path d="M22 12L21 12"/><path d="M3 12L2 12"/>
          <path d="M19.0708 4.92969L18.678 5.32252"/>
          <path d="M5.32178 18.6777L4.92894 19.0706"/>
          <path d="M19.0708 19.0703L18.678 18.6775"/>
          <path d="M5.32178 5.32227L4.92894 4.92943"/>
        </svg>
      );
    }
    switch (category) {
      case "meal":
        return (
          <svg width="26" height="26" viewBox="0 0 512 512" fill="none" aria-hidden
            stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32">
            <path d="M57.49,47.74,425.92,416.17a37.28,37.28,0,0,1,0,52.72h0a37.29,37.29,0,0,1-52.72,0l-90-91.55A32,32,0,0,1,274,354.91v-5.53a32,32,0,0,0-9.52-22.78l-11.62-10.73a32,32,0,0,0-29.8-7.44h0A48.53,48.53,0,0,1,176.5,295.8L91.07,210.36C40.39,159.68,21.74,83.15,57.49,47.74Z"/>
            <path d="M400,32l-77.25,77.25A64,64,0,0,0,304,154.51v14.86a16,16,0,0,1-4.69,11.32L288,192"/>
            <path d="M320,224l11.31-11.31A16,16,0,0,1,342.63,208h14.86a64,64,0,0,0,45.26-18.75L480,112"/>
            <line x1="440" y1="72" x2="360" y2="152"/>
            <path d="M200,368,100.28,468.28a40,40,0,0,1-56.56,0h0a40,40,0,0,1,0-56.56L128,328"/>
          </svg>
        );
      case "transfer":
        return (
          <svg width="26" height="26" viewBox="0 0 32 32" fill="currentColor" aria-hidden>
            <path d="M6.59375,6C5.257813,6,4.023438,6.667969,3.28125,7.78125L0.5,11.9375C0.171875,12.429688,0,13,0,13.59375L0,20.21875C0,21.132813,0.613281,21.933594,1.5,22.15625L4.09375,22.8125C4.46875,24.628906,6.078125,26,8,26C9.851563,26,11.398438,24.71875,11.84375,23L21.15625,23C21.601563,24.71875,23.148438,26,25,26C26.851563,26,28.398438,24.71875,28.84375,23L30,23C31.09375,23,32,22.09375,32,21L32,17.34375C32,15.511719,30.746094,13.910156,28.96875,13.46875L23.5625,12.09375L19.65625,7.4375C18.894531,6.527344,17.78125,6,16.59375,6ZM6.59375,8L11,8L11,12L2.875,12L4.9375,8.90625L4.9375,8.875C5.308594,8.316406,5.921875,8,6.59375,8ZM13,8L16.59375,8C17.1875,8,17.746094,8.261719,18.125,8.71875L20.875,12L13,12ZM2,14L22.875,14L28.5,15.40625C29.394531,15.628906,30,16.421875,30,17.34375L30,21L28.84375,21C28.398438,19.28125,26.851563,18,25,18C23.148438,18,21.601563,19.28125,21.15625,21L11.84375,21C11.398438,19.28125,9.851563,18,8,18C6.226563,18,4.738281,19.171875,4.21875,20.78125L2,20.21875ZM8,20C9.117188,20,10,20.882813,10,22C10,23.117188,9.117188,24,8,24C6.882813,24,6,23.117188,6,22C6,20.882813,6.882813,20,8,20ZM25,20C26.117188,20,27,20.882813,27,22C27,23.117188,26.117188,24,25,24C23.882813,24,23,23.117188,23,22C23,20.882813,23.882813,20,25,20Z"/>
          </svg>
        );
      case "free_time":
        return (
          <svg width="26" height="26" viewBox="0 0 192 192" fill="none" aria-hidden
            stroke="currentColor" strokeWidth="12" strokeLinecap="round">
            <circle cx="53.5" cy="53.5" r="31.5"/>
            <circle cx="53.5" cy="138.5" r="31.5"/>
            <circle cx="138.5" cy="138.5" r="31.5"/>
            <path d="m113 28 25.5 25.5M164 79l-25.5-25.5m0 0L164 28m-25.5 25.5L113 79"/>
          </svg>
        );
      case "surprise":
        return (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 10.0802V20.0802H19V14M5 10.0802H4V7.0802H20V10.0802H5ZM12 7.0802C12.8333 5.24687 14.9999 1.5802 16.9999 3.5802C18.9999 5.5802 14.5 6.91353 12 7.0802ZM12 7.0802C11.1667 5.24687 8.99999 1.5802 6.99999 3.5802C4.99999 5.5802 9.5 6.91353 12 7.0802Z"/>
          </svg>
        );
      case "sleep_in_hotel":
        return (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M14.5739 1.11056L13.7826 2.69316C13.7632 2.73186 13.7319 2.76325 13.6932 2.7826L12.1106 3.5739C11.9631 3.64761 11.9631 3.85797 12.1106 3.93167L13.6932 4.72297C13.7319 4.74233 13.7632 4.77371 13.7826 4.81241L14.5739 6.39502C14.6476 6.54243 14.858 6.54243 14.9317 6.39502L15.723 4.81241C15.7423 4.77371 15.7737 4.74232 15.8124 4.72297L17.395 3.93167C17.5424 3.85797 17.5424 3.64761 17.395 3.5739L15.8124 2.7826C15.7737 2.76325 15.7423 2.73186 15.723 2.69316L14.9317 1.11056C14.858 0.963147 14.6476 0.963148 14.5739 1.11056Z"/>
            <path d="M19.2419 5.07223L18.4633 7.40815C18.4434 7.46787 18.3965 7.51474 18.3368 7.53464L16.0009 8.31328C15.8185 8.37406 15.8185 8.63198 16.0009 8.69276L18.3368 9.4714C18.3965 9.4913 18.4434 9.53817 18.4633 9.59789L19.2419 11.9338C19.3027 12.1161 19.5606 12.1161 19.6214 11.9338L20.4 9.59789C20.42 9.53817 20.4668 9.4913 20.5265 9.4714L22.8625 8.69276C23.0448 8.63198 23.0448 8.37406 22.8625 8.31328L20.5265 7.53464C20.4668 7.51474 20.42 7.46787 20.4 7.40815L19.6214 5.07223C19.5606 4.88989 19.3027 4.88989 19.2419 5.07223Z"/>
            <path fillRule="evenodd" clipRule="evenodd" d="M10.4075 13.6642C13.2348 16.4915 17.6517 16.7363 20.6641 14.3703C20.7014 14.341 20.7385 14.3113 20.7754 14.2812C20.9148 14.1674 21.051 14.0479 21.1837 13.9226C21.2376 13.8718 21.2909 13.8201 21.3436 13.7674C21.8557 13.2552 22.9064 13.5578 22.7517 14.2653C22.6983 14.5098 22.6365 14.7517 22.5667 14.9905C22.5253 15.1321 22.4811 15.2727 22.4341 15.4122C22.4213 15.4502 22.4082 15.4883 22.395 15.5262C20.8977 19.8142 16.7886 23.0003 12 23.0003C5.92487 23.0003 1 18.0754 1 12.0003C1 7.13315 4.29086 2.98258 8.66889 1.54252L8.72248 1.52504C8.8185 1.49401 8.91503 1.46428 9.01205 1.43587C9.26959 1.36046 9.5306 1.29438 9.79466 1.23801C10.5379 1.07934 10.8418 2.19074 10.3043 2.72815C10.251 2.78147 10.1987 2.83539 10.1473 2.88989C10.0456 2.99777 9.94766 3.10794 9.8535 3.22023C9.83286 3.24485 9.8124 3.26957 9.79212 3.29439C7.32966 6.30844 7.54457 10.8012 10.4075 13.6642ZM8.99331 15.0784C11.7248 17.8099 15.6724 18.6299 19.0872 17.4693C17.4281 19.6024 14.85 21.0003 12 21.0003C7.02944 21.0003 3 16.9709 3 12.0003C3 9.09163 4.45653 6.47161 6.66058 4.81846C5.41569 8.27071 6.2174 12.3025 8.99331 15.0784Z"/>
          </svg>
        );
      case "hotel":
        return (
          <svg width="26" height="26" viewBox="0 0 485 485" fill="currentColor" aria-hidden>
            <polygon points="260.439,94.449 224.561,94.449 224.561,58.949 194.561,58.949 194.561,159.949 224.561,159.949 224.561,124.449 260.439,124.449 260.439,159.949 290.439,159.949 290.439,58.949 260.439,58.949"/>
            <path d="M361.501,129.842V0h-236.94v129.842H0V485h485V129.842H361.501z M331.501,455h-25v-85.158h25V455z M276.501,455h-66.94v-85.158h66.94V455z M179.561,455h-25v-85.158h25V455z M455,455h-93.499V339.842h-236.94V455H30V159.842h124.561V30h176.94v129.842H455V455z"/>
            <rect x="65" y="199.842" width="50" height="30"/><rect x="141.25" y="199.842" width="50" height="30"/>
            <rect x="217.5" y="199.842" width="50" height="30"/><rect x="293.75" y="199.842" width="50" height="30"/>
            <rect x="370" y="199.842" width="50" height="30"/><rect x="65" y="269.842" width="50" height="30"/>
            <rect x="141.25" y="269.842" width="50" height="30"/><rect x="217.5" y="269.842" width="50" height="30"/>
            <rect x="293.75" y="269.842" width="50" height="30"/><rect x="370" y="269.842" width="50" height="30"/>
          </svg>
        );
      case "wellness_grooming":
        // eslint-disable-next-line @next/next/no-img-element
        return <img src="/icons/beauty-spa.svg" width="26" height="26" alt="" aria-hidden
          style={{ filter: "brightness(0) saturate(100%) invert(15%) sepia(90%) saturate(4000%) hue-rotate(310deg) brightness(0.85)", opacity: isPast ? 0.4 : 0.85 }} />;
      default: // activity — ticket with star
        return (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path fillRule="evenodd" clipRule="evenodd" fill="none"
              d="M21.4399 13.9939C18.7789 13.9939 18.7789 9.87952 21.4399 9.87952C21.4399 5.11236 21.4399 3.41089 12.0449 3.41089C2.6499 3.41089 2.6499 5.11236 2.6499 9.87952C5.3109 9.87952 5.3109 13.9939 2.6499 13.9939C2.6499 18.762 2.6499 20.4635 12.0449 20.4635C21.4399 20.4635 21.4399 18.762 21.4399 13.9939Z"/>
            <path fillRule="evenodd" clipRule="evenodd" fill="none"
              d="M12.0449 9.17114C11.3619 9.17114 11.2969 10.2606 10.8909 10.6462C10.4839 11.0308 9.22087 10.5912 9.04487 11.2743C8.86987 11.9583 10.0069 12.1904 10.1479 12.7768C10.2879 13.3632 9.59387 14.1875 10.1869 14.5986C10.7809 15.0079 11.4199 14.0804 12.0449 14.0804C12.6699 14.0804 13.3089 15.0079 13.9029 14.5986C14.4969 14.1875 13.8019 13.3632 13.9419 12.7768C14.0829 12.1904 15.2199 11.9583 15.0449 11.2743C14.8689 10.5912 13.6059 11.0308 13.1989 10.6462C12.7929 10.2606 12.7279 9.17114 12.0449 9.17114Z"/>
          </svg>
        );
    }
  })();

  return (
    <>
      <style>{`
        @keyframes icon-wobble {
          0%   { transform: scale(1); }
          20%  { transform: scale(1.3); }
          42%  { transform: scale(0.85); }
          62%  { transform: scale(1.15); }
          80%  { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
        .icon-wobble {
          animation: icon-wobble 0.65s cubic-bezier(0.36, 0.07, 0.19, 0.97) forwards;
        }
      `}</style>
      {/* key forces remount → restarts animation each time wobbleKey increments */}
      <div
        key={wobbleKey}
        className={wobbleKey > 0 ? "icon-wobble" : ""}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 52, height: 52, borderRadius: "50%",
          background: isPast ? "rgba(0,0,0,0.06)" : `${iconColor}22`,
          color: iconColor,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
    </>
  );
}

// ─── Category icon ────────────────────────────────────────────────────────────

function CategoryIcon({ category, color }: { category: ActivityCategory; color: string }) {
  const p = {
    width: 13, height: 13, viewBox: "0 0 24 24", fill: "none" as const,
    stroke: color, strokeWidth: 2,
    strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  switch (category) {
    case "transfer":
      return <svg {...p}><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>;
    case "meal":
      return <svg {...p}><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><line x1="7" y1="2" x2="7" y2="11"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>;
    case "free_time":
      return <svg {...p}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
    case "surprise":
      return <svg {...p}><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>;
    case "hotel":
    case "sleep_in_hotel":
      return <svg {...p}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
    case "wellness_grooming":
      return <svg {...p}><path d="M12 22c0 0-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><path d="M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/></svg>;
    default:
      return <svg {...p}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ActivityPlanCardProps {
  activity: Activity;
  nowMs: number;
  onTap?: () => void;
}

export function ActivityPlanCard({ activity, nowMs, onTap }: ActivityPlanCardProps) {
  const status    = getCardStatus(activity, nowMs);
  const style     = getCategoryStyle(activity.category);
  const isPast    = status === "past";
  const isCurrent = status === "current";

  const startTime = formatTime(activity.startTime);
  const endTime   = formatTime(activity.endTime);

  // ── Scroll-triggered wobble ──────────────────────────────────────────────────
  const cardRef    = useRef<HTMLDivElement>(null);
  const [wobbleKey, setWobbleKey] = useState(0);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    // Fire when the card enters the top ~25% of the viewport (scrolling up into view)
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setWobbleKey((k) => k + 1);
          }
        });
      },
      {
        // rootMargin shrinks the bottom of the intersection zone so it only fires
        // when the card is in the top 25% of the screen
        rootMargin: "0px 0px -75% 0px",
        threshold: 0,
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={cardRef}
      role={onTap ? "button" : undefined}
      tabIndex={onTap ? 0 : undefined}
      onClick={onTap}
      onKeyDown={onTap ? (e) => { if (e.key === "Enter" || e.key === " ") onTap(); } : undefined}
      className="relative rounded-2xl overflow-hidden transition-all duration-300"
      style={{
        background:  isPast ? "#EDEAE9" : style.bg,
        border:      `1px solid ${isPast ? "rgba(0,0,0,0.08)" : `${style.color}40`}`,
        boxShadow:   isCurrent
          ? `0 4px 20px ${style.color}25, 0 1px 4px rgba(0,0,0,0.06)`
          : "0 1px 4px rgba(120,60,50,0.07), 0 2px 8px rgba(120,60,50,0.05)",
        cursor: onTap ? "pointer" : undefined,
      }}
    >
      {/* Top accent bar */}
      <div
        className="h-[3px] w-full"
        style={{
          background: isPast ? "rgba(0,0,0,0.08)" : style.bar,
        }}
      />

      {/* Big decorative icon — bottom right, wobbles when active */}
      <div className="absolute bottom-3 right-3 pointer-events-none">
        <ClientCategoryBigIcon
          category={activity.category}
          color={style.color}
          isPast={isPast}
          wobbleKey={wobbleKey}
          isHotelMorningCard={activity.category === "hotel" && activity.estimatedDuration === 0}
        />
      </div>

      <div className="p-4" style={{ paddingRight: 72 }}>
        {/* ── Time row ── */}
        {activity.category === "sleep_in_hotel" ? (
          <div className="flex items-baseline gap-1.5 mb-3">
            <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: isPast ? "#9A7A78" : style.color, opacity: 0.7 }}>
              Arrival
            </span>
            <span className="text-2xl font-semibold tabular-nums" style={{ color: isPast ? "#9A7A78" : style.color }}>
              {startTime}
            </span>
          </div>

        ) : activity.category === "hotel" && activity.estimatedDuration === 0 ? (
          <div className="mb-2">
            {activity.breakfastType && (
              <span className="text-[10px]" style={{ color: style.color, opacity: 0.75 }}>
                {activity.breakfastType === "hotel_breakfast"
                  ? "🍳 Hotel breakfast"
                  : activity.breakfastType === "special_breakfast"
                  ? "✨ Special breakfast"
                  : "☕ No breakfast"}
              </span>
            )}
            {activity.breakfastType === "special_breakfast" && activity.specialBreakfastInfo && (
              <div
                className="mt-2 px-3 py-2 rounded-xl flex items-start gap-2"
                style={{ background: `${style.color}0D`, border: `1px solid ${style.color}22` }}
              >
                <span className="text-base leading-none mt-0.5">✨</span>
                <p className="text-xs leading-relaxed" style={{ color: style.color }}>
                  {activity.specialBreakfastInfo}
                </p>
              </div>
            )}
          </div>

        ) : activity.estimatedDuration > 0 ? (
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-baseline gap-1.5">
              <span
                className="text-2xl font-semibold tabular-nums"
                style={{ color: isPast ? "#9A7A78" : style.color }}
              >
                {startTime}
              </span>
              <span className="text-sm" style={{ color: isPast ? "#C4AAA8" : `${style.color}70` }}>–</span>
              <span className="text-sm tabular-nums" style={{ color: isPast ? "#C4AAA8" : `${style.color}70` }}>
                {endTime}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isCurrent && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: style.color }} />
                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: style.color }} />
                </span>
              )}
              <span
                className="text-[10px] font-semibold tracking-wider px-2.5 py-1 rounded-full uppercase"
                style={
                  activity.isBooked
                    ? { background: "rgba(217,64,64,0.13)", color: "#D94040" }
                    : { background: "rgba(26,158,114,0.13)", color: "#0D6E4E" }
                }
              >
                {activity.isBooked ? "Programmed" : "Flexible"}
              </span>
            </div>
          </div>
        ) : null}

        {/* ── Title ── */}
        <h3
          className="text-base font-semibold leading-snug mb-0.5"
          style={{ color: isPast ? "#9A7A78" : "#1E0E0B" }}
        >
          {activity.title}
        </h3>

        {/* ── Place ── */}
        {activity.place && (
          <p
            className="text-sm font-medium mb-2"
            style={{ color: isPast ? "#C4AAA8" : style.color }}
          >
            {activity.place}
          </p>
        )}

        {/* ── Address ── */}
        {activity.address && (
          <div className="flex items-start gap-1.5 mb-3">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="shrink-0 mt-0.5" aria-hidden
              style={{ stroke: isPast ? "#C4AAA8" : "#1E0E0B" }}
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <span className="text-xs leading-relaxed line-clamp-2" style={{ color: isPast ? "#C4AAA8" : "#1E0E0B" }}>
              {activity.address}
            </span>
          </div>
        )}

        {/* ── Category + duration row ── */}
        <div className="flex items-center gap-2.5 mt-1">
          <span
            className="text-xs font-medium px-2.5 py-1 rounded-full"
            style={{ background: isPast ? "rgba(0,0,0,0.05)" : style.pill, color: isPast ? "#9A7A78" : style.pillText }}
          >
            {activity.category === "hotel" && activity.estimatedDuration === 0
              ? "Hotel/Accommodation Morning"
              : style.label}
          </span>

          {activity.estimatedDuration > 0 && (
            <span className="text-xs flex items-center gap-1" style={{ color: "#1E0E0B" }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              {formatDuration(activity.estimatedDuration)}
            </span>
          )}
        </div>

        {/* ── Description ── */}
        {activity.description && (
          <p className="text-xs leading-relaxed line-clamp-2 mt-2.5" style={{ color: "#1E0E0B" }}>
            {activity.description}
          </p>
        )}

        {/* ── Surprise badge ── */}
        {activity.isSurprise && <SurpriseBadge activity={activity} />}

        {/* ── Coordinator note ── */}
        {activity.coordinatorNote && (
          <div
            className="mt-3 px-3 py-2 rounded-xl"
            style={{ background: `${style.color}0D`, border: `1px solid ${style.color}22` }}
          >
            <p className="text-xs leading-relaxed" style={{ color: style.color, opacity: 0.85 }}>
              <span className="font-semibold">Note: </span>
              {activity.coordinatorNote}
            </p>
          </div>
        )}

        {/* ── Booking link ── */}
        {activity.contactLink && (
          <a
            href={activity.contactLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-xl transition-opacity active:opacity-70 self-start"
            style={{ background: `${style.color}0D`, border: `1px solid ${style.color}22` }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke={isPast ? "#9A7A78" : style.color}
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6"/>
            </svg>
            <span className="text-[10px] font-bold tracking-widest uppercase"
              style={{ color: isPast ? "#9A7A78" : style.color }}>
              Booking Link
            </span>
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Surprise badge + popup ───────────────────────────────────────────────────

function SurpriseBadge({ activity }: { activity: Activity }) {
  const [open, setOpen] = useState(false);
  const btnRef  = useRef<HTMLButtonElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const btn  = btnRef.current;
    const icon = iconRef.current;
    if (!btn || !icon) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          // retrigger by forcing a reflow between class remove/add
          icon.classList.remove("gift-wobble");
          void icon.offsetWidth;
          icon.classList.add("gift-wobble");
        });
      },
      { rootMargin: "-35% 0px -35% 0px", threshold: 0 }
    );

    observer.observe(btn);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <style>{`
        @keyframes gift-wobble {
          0%,100% { transform: rotate(0deg)   scale(1);    }
          15%      { transform: rotate(-18deg) scale(1.15); }
          30%      { transform: rotate(14deg)  scale(1.1);  }
          45%      { transform: rotate(-10deg) scale(1.05); }
          60%      { transform: rotate(7deg)   scale(1.02); }
          75%      { transform: rotate(-4deg); }
        }
        .gift-wobble { animation: gift-wobble 0.8s cubic-bezier(0.36,0.07,0.19,0.97) both; }
      `}</style>

      <button
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="mt-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg w-fit transition-opacity active:opacity-70"
        style={{ background: "#D94040", border: "none" }}
        aria-label="View surprise details"
      >
        <span ref={iconRef} className="inline-flex">
          <GiftIcon />
        </span>
        <span className="text-[10px] font-semibold text-white tracking-wide">Surprise!</span>
      </button>

      {open && (
        <SurprisePopup activity={activity} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function SurprisePopup({ activity, onClose }: { activity: Activity; onClose: () => void }) {
  const hasContact = !!(activity.surpriseContactName || activity.surpriseContactPhone);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(30,14,11,0.45)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6"
        style={{
          border: "1px solid rgba(217,64,64,0.15)",
          boxShadow: "0 20px 60px rgba(120,60,50,0.2)",
          animation: "fadeUp 0.25s ease both",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`
          @keyframes fadeUp {
            from { opacity: 0; transform: translateY(16px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes icon-pop {
            0%   { transform: scale(0);    opacity: 0; }
            60%  { transform: scale(1.35); opacity: 1; }
            80%  { transform: scale(0.88); }
            100% { transform: scale(1);    opacity: 1; }
          }
        `}</style>

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: "#D94040", animation: "icon-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) both" }}>
              <GiftIcon />
            </div>
            <span className="font-display text-base font-semibold" style={{ color: "#D94040" }}>
              Surprise!
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg transition-colors"
            style={{ color: "#9A7A78" }}
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {/* Description */}
          {activity.surpriseDescription && (
            <p className="text-sm leading-relaxed" style={{ color: "#1E0E0B" }}>
              {activity.surpriseDescription}
            </p>
          )}

          {/* Contact block */}
          {hasContact && (
            <div className="rounded-xl px-4 py-3 flex flex-col gap-2"
              style={{ background: "rgba(217,64,64,0.05)", border: "1px solid rgba(217,64,64,0.10)" }}>
              {activity.surpriseContactName && (
                <div className="flex items-center gap-2">
                  <PersonIcon />
                  <span className="text-sm" style={{ color: "#1E0E0B" }}>{activity.surpriseContactName}</span>
                </div>
              )}
              {activity.surpriseContactPhone && (
                <a
                  href={`tel:${activity.surpriseContactPhone}`}
                  className="flex items-center gap-2 transition-opacity active:opacity-60"
                >
                  <PhoneIcon />
                  <span className="text-sm" style={{ color: "#D94040" }}>{activity.surpriseContactPhone}</span>
                </a>
              )}
            </div>
          )}

          {/* Link */}
          {activity.surpriseLink && (
            <a
              href={activity.surpriseLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm transition-opacity active:opacity-60"
              style={{ color: "#D94040" }}
            >
              <LinkIcon />
              <span className="underline underline-offset-2 truncate">{activity.surpriseLink}</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function GiftIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 12 20 22 4 22 4 12"/>
      <rect x="2" y="7" width="20" height="5"/>
      <line x1="12" y1="22" x2="12" y2="7"/>
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9A7A78" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D94040" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.08 6.08l1.15-1.14a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D94040" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  );
}
