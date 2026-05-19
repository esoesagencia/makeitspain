"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import type { Activity, ActivityCategory, Author, Trip } from "@/types";
import { ActivityDetailModal } from "./ActivityDetailModal";
import { toSpainDateKey, formatTime, formatDuration } from "@/lib/utils/time";

// ─── Keyframe styles (injected once) ─────────────────────────────────────────

const KEYFRAMES = `
  @keyframes popSpring {
    0%   { transform: scale(0);    opacity: 0; }
    60%  { transform: scale(1.15); opacity: 1; }
    80%  { transform: scale(0.92); opacity: 1; }
    100% { transform: scale(1);    opacity: 1; }
  }
  @keyframes iconBounce {
    0%   { transform: scale(0);    opacity: 0; }
    45%  { transform: scale(1.35); opacity: 1; }
    62%  { transform: scale(0.82); opacity: 1; }
    78%  { transform: scale(1.18); opacity: 1; }
    90%  { transform: scale(0.94); opacity: 1; }
    100% { transform: scale(1);    opacity: 1; }
  }
  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
`;

// ─── Category styles — exact same palette as ActivityPlanCard ─────────────────

interface CategoryStyle {
  color: string;
  bg: string;
}

function getCategoryStyle(cat: ActivityCategory): CategoryStyle {
  switch (cat) {
    case "transfer":         return { color: "#1A56DB", bg: "#BFDBFE" };
    case "meal":             return { color: "#92570A", bg: "#FDE68A" };
    case "free_time":        return { color: "#5B21B6", bg: "#C4B5FD" };
    case "surprise":         return { color: "#6B21A8", bg: "#E9D5FF" };
    case "hotel":            return { color: "#9A3412", bg: "#FED7AA" };
    case "sleep_in_hotel":   return { color: "#1E3A8A", bg: "#C7D2FE" };
    case "wellness_grooming":return { color: "#BE185D", bg: "#FBCFE8" };
    default:                 return { color: "#0D6E4E", bg: "#A7F3D0" };
  }
}

// ─── Big decorative icon — same SVGs as ActivityPlanCard ─────────────────────

function BigCategoryIcon({ category, color }: { category: ActivityCategory; color: string }) {
  switch (category) {
    case "meal":
      return (
        <svg width="26" height="26" viewBox="0 0 512 512" fill="none" aria-hidden
          stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="32">
          <path d="M57.49,47.74,425.92,416.17a37.28,37.28,0,0,1,0,52.72h0a37.29,37.29,0,0,1-52.72,0l-90-91.55A32,32,0,0,1,274,354.91v-5.53a32,32,0,0,0-9.52-22.78l-11.62-10.73a32,32,0,0,0-29.8-7.44h0A48.53,48.53,0,0,1,176.5,295.8L91.07,210.36C40.39,159.68,21.74,83.15,57.49,47.74Z"/>
          <path d="M400,32l-77.25,77.25A64,64,0,0,0,304,154.51v14.86a16,16,0,0,1-4.69,11.32L288,192"/>
          <path d="M320,224l11.31-11.31A16,16,0,0,1,342.63,208h14.86a64,64,0,0,0,45.26-18.75L480,112"/>
          <line x1="440" y1="72" x2="360" y2="152"/>
          <path d="M200,368,100.28,468.28a40,40,0,0,1-56.56,0h0a40,40,0,0,1,0-56.56L128,328"/>
        </svg>
      );
    case "transfer":
      return (
        <svg width="26" height="26" viewBox="0 0 32 32" fill={color} aria-hidden>
          <path d="M6.59375,6C5.257813,6,4.023438,6.667969,3.28125,7.78125L0.5,11.9375C0.171875,12.429688,0,13,0,13.59375L0,20.21875C0,21.132813,0.613281,21.933594,1.5,22.15625L4.09375,22.8125C4.46875,24.628906,6.078125,26,8,26C9.851563,26,11.398438,24.71875,11.84375,23L21.15625,23C21.601563,24.71875,23.148438,26,25,26C26.851563,26,28.398438,24.71875,28.84375,23L30,23C31.09375,23,32,22.09375,32,21L32,17.34375C32,15.511719,30.746094,13.910156,28.96875,13.46875L23.5625,12.09375L19.65625,7.4375C18.894531,6.527344,17.78125,6,16.59375,6ZM6.59375,8L11,8L11,12L2.875,12L4.9375,8.90625L4.9375,8.875C5.308594,8.316406,5.921875,8,6.59375,8ZM13,8L16.59375,8C17.1875,8,17.746094,8.261719,18.125,8.71875L20.875,12L13,12ZM2,14L22.875,14L28.5,15.40625C29.394531,15.628906,30,16.421875,30,17.34375L30,21L28.84375,21C28.398438,19.28125,26.851563,18,25,18C23.148438,18,21.601563,19.28125,21.15625,21L11.84375,21C11.398438,19.28125,9.851563,18,8,18C6.226563,18,4.738281,19.171875,4.21875,20.78125L2,20.21875ZM8,20C9.117188,20,10,20.882813,10,22C10,23.117188,9.117188,24,8,24C6.882813,24,6,23.117188,6,22C6,20.882813,6.882813,20,8,20ZM25,20C26.117188,20,27,20.882813,27,22C27,23.117188,26.117188,24,25,24C23.882813,24,23,23.117188,23,22C23,20.882813,23.882813,20,25,20Z"/>
        </svg>
      );
    case "free_time":
      return (
        <svg width="26" height="26" viewBox="0 0 192 192" fill="none" aria-hidden
          stroke={color} strokeWidth="12" strokeLinecap="round">
          <circle cx="53.5" cy="53.5" r="31.5"/>
          <circle cx="53.5" cy="138.5" r="31.5"/>
          <circle cx="138.5" cy="138.5" r="31.5"/>
          <path d="m113 28 25.5 25.5M164 79l-25.5-25.5m0 0L164 28m-25.5 25.5L113 79"/>
        </svg>
      );
    case "surprise":
      return (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden
          stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 10.0802V20.0802H19V14M5 10.0802H4V7.0802H20V10.0802H5ZM12 7.0802C12.8333 5.24687 14.9999 1.5802 16.9999 3.5802C18.9999 5.5802 14.5 6.91353 12 7.0802ZM12 7.0802C11.1667 5.24687 8.99999 1.5802 6.99999 3.5802C4.99999 5.5802 9.5 6.91353 12 7.0802Z"/>
        </svg>
      );
    case "wellness_grooming":
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/icons/beauty-spa.svg" width="26" height="26" alt="" aria-hidden
          style={{ filter: "brightness(0) saturate(100%) invert(15%) sepia(90%) saturate(4000%) hue-rotate(310deg) brightness(0.85)", opacity: 0.85 }} />
      );
    case "hotel":
      return (
        <svg width="26" height="26" viewBox="0 0 485 485" fill={color} aria-hidden>
          <polygon points="260.439,94.449 224.561,94.449 224.561,58.949 194.561,58.949 194.561,159.949 224.561,159.949 224.561,124.449 260.439,124.449 260.439,159.949 290.439,159.949 290.439,58.949 260.439,58.949"/>
          <path d="M361.501,129.842V0h-236.94v129.842H0V485h485V129.842H361.501z M331.501,455h-25v-85.158h25V455z M276.501,455h-66.94v-85.158h66.94V455z M179.561,455h-25v-85.158h25V455z M455,455h-93.499V339.842h-236.94V455H30V159.842h124.561V30h176.94v129.842H455V455z"/>
          <rect x="65" y="199.842" width="50" height="30"/><rect x="141.25" y="199.842" width="50" height="30"/>
          <rect x="217.5" y="199.842" width="50" height="30"/><rect x="293.75" y="199.842" width="50" height="30"/>
          <rect x="370" y="199.842" width="50" height="30"/><rect x="65" y="269.842" width="50" height="30"/>
          <rect x="141.25" y="269.842" width="50" height="30"/><rect x="217.5" y="269.842" width="50" height="30"/>
          <rect x="293.75" y="269.842" width="50" height="30"/><rect x="370" y="269.842" width="50" height="30"/>
        </svg>
      );
    case "sleep_in_hotel":
      return (
        <svg width="26" height="26" viewBox="0 0 24 24" fill={color} aria-hidden>
          <path d="M14.5739 1.11056L13.7826 2.69316C13.7632 2.73186 13.7319 2.76325 13.6932 2.7826L12.1106 3.5739C11.9631 3.64761 11.9631 3.85797 12.1106 3.93167L13.6932 4.72297C13.7319 4.74233 13.7632 4.77371 13.7826 4.81241L14.5739 6.39502C14.6476 6.54243 14.858 6.54243 14.9317 6.39502L15.723 4.81241C15.7423 4.77371 15.7737 4.74232 15.8124 4.72297L17.395 3.93167C17.5424 3.85797 17.5424 3.64761 17.395 3.5739L15.8124 2.7826C15.7737 2.76325 15.7423 2.73186 15.723 2.69316L14.9317 1.11056C14.858 0.963147 14.6476 0.963148 14.5739 1.11056Z"/>
          <path d="M19.2419 5.07223L18.4633 7.40815C18.4434 7.46787 18.3965 7.51474 18.3368 7.53464L16.0009 8.31328C15.8185 8.37406 15.8185 8.63198 16.0009 8.69276L18.3368 9.4714C18.3965 9.4913 18.4434 9.53817 18.4633 9.59789L19.2419 11.9338C19.3027 12.1161 19.5606 12.1161 19.6214 11.9338L20.4 9.59789C20.42 9.53817 20.4668 9.4913 20.5265 9.4714L22.8625 8.69276C23.0448 8.63198 23.0448 8.37406 22.8625 8.31328L20.5265 7.53464C20.4668 7.51474 20.42 7.46787 20.4 7.40815L19.6214 5.07223C19.5606 4.88989 19.3027 4.88989 19.2419 5.07223Z"/>
          <path fillRule="evenodd" clipRule="evenodd" d="M10.4075 13.6642C13.2348 16.4915 17.6517 16.7363 20.6641 14.3703C20.7014 14.341 20.7385 14.3113 20.7754 14.2812C20.9148 14.1674 21.051 14.0479 21.1837 13.9226C21.2376 13.8718 21.2909 13.8201 21.3436 13.7674C21.8557 13.2552 22.9064 13.5578 22.7517 14.2653C22.6983 14.5098 22.6365 14.7517 22.5667 14.9905C22.5253 15.1321 22.4811 15.2727 22.4341 15.4122C22.4213 15.4502 22.4082 15.4883 22.395 15.5262C20.8977 19.8142 16.7886 23.0003 12 23.0003C5.92487 23.0003 1 18.0754 1 12.0003C1 7.13315 4.29086 2.98258 8.66889 1.54252L8.72248 1.52504C8.8185 1.49401 8.91503 1.46428 9.01205 1.43587C9.26959 1.36046 9.5306 1.29438 9.79466 1.23801C10.5379 1.07934 10.8418 2.19074 10.3043 2.72815C10.251 2.78147 10.1987 2.83539 10.1473 2.88989C10.0456 2.99777 9.94766 3.10794 9.8535 3.22023C9.83286 3.24485 9.8124 3.26957 9.79212 3.29439C7.32966 6.30844 7.54457 10.8012 10.4075 13.6642ZM8.99331 15.0784C11.7248 17.8099 15.6724 18.6299 19.0872 17.4693C17.4281 19.6024 14.85 21.0003 12 21.0003C7.02944 21.0003 3 16.9709 3 12.0003C3 9.09163 4.45653 6.47161 6.66058 4.81846C5.41569 8.27071 6.2174 12.3025 8.99331 15.0784Z"/>
        </svg>
      );
    default: // activity — ticket with star
      return (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden
          stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path fillRule="evenodd" clipRule="evenodd" fill="none"
            d="M21.4399 13.9939C18.7789 13.9939 18.7789 9.87952 21.4399 9.87952C21.4399 5.11236 21.4399 3.41089 12.0449 3.41089C2.6499 3.41089 2.6499 5.11236 2.6499 9.87952C5.3109 9.87952 5.3109 13.9939 2.6499 13.9939C2.6499 18.762 2.6499 20.4635 12.0449 20.4635C21.4399 20.4635 21.4399 18.762 21.4399 13.9939Z"/>
          <path fillRule="evenodd" clipRule="evenodd" fill="none"
            d="M12.0449 9.17114C11.3619 9.17114 11.2969 10.2606 10.8909 10.6462C10.4839 11.0308 9.22087 10.5912 9.04487 11.2743C8.86987 11.9583 10.0069 12.1904 10.1479 12.7768C10.2879 13.3632 9.59387 14.1875 10.1869 14.5986C10.7809 15.0079 11.4199 14.0804 12.0449 14.0804C12.6699 14.0804 13.3089 15.0079 13.9029 14.5986C14.4969 14.1875 13.8019 13.3632 13.9419 12.7768C14.0829 12.1904 15.2199 11.9583 15.0449 11.2743C14.8689 10.5912 13.6059 11.0308 13.1989 10.6462C12.7929 10.2606 12.7279 9.17114 12.0449 9.17114Z"/>
        </svg>
      );
  }
}

// ─── Typewriter hook ──────────────────────────────────────────────────────────

function useTypewriter(text: string, speed = 28, startDelay = 500) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    setDisplayed("");
    let timer: ReturnType<typeof setTimeout>;
    let interval: ReturnType<typeof setInterval>;

    timer = setTimeout(() => {
      let i = 0;
      interval = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) clearInterval(interval);
      }, speed);
    }, startDelay);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [text, speed, startDelay]);

  return { displayed, done: displayed.length >= text.length };
}

// ─── Day group type ───────────────────────────────────────────────────────────

interface DayGroup {
  dateKey: string;
  dayNumber: number;
  dateLabel: string;
  activities: Activity[];
}

// ─── InfoView (main export) ───────────────────────────────────────────────────

interface InfoViewProps {
  firstName: string;
  trip: Trip;
  activities: Activity[];
  author: Author | null;
  nowMs: number;
  tripId: string;
}

export function InfoView({ firstName, trip, activities, author, nowMs, tripId }: InfoViewProps) {
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

  const dayGroups = useMemo<DayGroup[]>(() => {
    const map = new Map<string, Activity[]>();
    for (const a of activities) {
      const key = toSpainDateKey(a.startTime);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    for (const g of map.values()) {
      g.sort((a, b) => a.startTime.toMillis() - b.startTime.toMillis());
    }
    const sortedKeys = [...map.keys()].sort();
    return sortedKeys.map((key, i) => {
      const first = map.get(key)![0];
      const dateLabel = first.startTime.toDate().toLocaleDateString("en-US", {
        weekday: "long", month: "short", day: "numeric", timeZone: "Europe/Madrid",
      });
      return { dateKey: key, dayNumber: i + 1, dateLabel, activities: map.get(key)! };
    });
  }, [activities]);

  const welcomeText = author
    ? `Welcome to your amazing trip, ${firstName}! My name is ${author.name}, and I'm delighted to welcome you to Spain! I've carefully crafted every detail of this journey just for you — get ready for an experience you'll never forget.`
    : `Welcome to your amazing trip, ${firstName}! I'm delighted to welcome you to Spain! Every detail of this journey has been carefully crafted just for you — get ready for an experience you'll never forget.`;

  return (
    <>
      <style>{KEYFRAMES}</style>

      <div className="pb-10 lg:px-10 lg:max-w-5xl lg:mx-auto">
        {/* ── Section 1: Welcome card ── */}
        <WelcomeCard
          author={author}
          welcomeText={welcomeText}
        />

        {/* ── Section 2: Personal message ── */}
        {trip.personalMessage && (
          <PersonalMessageSection message={trip.personalMessage} />
        )}

        {/* ── Section 3: Itinerary ── */}
        {dayGroups.length > 0 && (
          <ItinerarySection
            dayGroups={dayGroups}
            onActivityTap={setSelectedActivity}
          />
        )}

        {/* ── Section 4: Additional info (climate / dress code / tips) ── */}
        {(trip.additionalInfoClimate || trip.additionalInfoDressCode || trip.additionalInfoUsefulTips) && (
          <TripAdditionalInfo
            climate={trip.additionalInfoClimate ?? ""}
            dressCode={trip.additionalInfoDressCode ?? ""}
            usefulTips={trip.additionalInfoUsefulTips ?? ""}
          />
        )}
      </div>

      {/* Activity detail modal */}
      {selectedActivity && (
        <ActivityDetailModal
          activity={selectedActivity}
          tripId={tripId}
          isOpen={!!selectedActivity}
          onClose={() => setSelectedActivity(null)}
        />
      )}
    </>
  );
}

// ─── Section 1: Welcome card ──────────────────────────────────────────────────

function WelcomeCard({ author, welcomeText }: { author: Author | null; welcomeText: string }) {
  const [quotePopped, setQuotePopped] = useState(false);
  const [avatarPopped, setAvatarPopped] = useState(false);
  const { displayed, done } = useTypewriter(welcomeText);

  useEffect(() => {
    const t1 = setTimeout(() => setQuotePopped(true), 150);
    const t2 = setTimeout(() => setAvatarPopped(true), 700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const initials = author?.name
    ? author.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "MS";

  return (
    <div
      className="mx-4 mt-4 rounded-2xl overflow-hidden"
      style={{
        background: "linear-gradient(145deg, #D94A35 0%, #E8603A 45%, #C83828 100%)",
        boxShadow: "0 8px 32px rgba(232,96,58,0.30)",
      }}
    >
      <div className="relative px-5 pt-5 pb-6 overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -right-8 -top-8 w-44 h-44 rounded-full bg-white/[0.06] pointer-events-none" />
        <div className="absolute -left-6 -bottom-10 w-36 h-36 rounded-full bg-white/[0.05] pointer-events-none" />
        <div className="absolute right-24 bottom-6 w-14 h-14 rounded-full bg-white/[0.07] pointer-events-none" />

        {/* Quote icon with pop animation */}
        <div
          className="mb-4"
          style={{
            display: "inline-block",
            animation: quotePopped
              ? "popSpring 0.65s cubic-bezier(0.175, 0.885, 0.32, 1.275) both"
              : "none",
            opacity: quotePopped ? undefined : 0,
          }}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.18)" }}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="white" aria-hidden>
              <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/>
              <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>
            </svg>
          </div>
        </div>

        {/* Typewriter text */}
        <p className="text-white/95 text-[15px] leading-relaxed font-medium relative z-10" style={{ minHeight: 80 }}>
          {displayed}
          {!done && (
            <span
              className="inline-block w-[2px] h-[15px] bg-white/70 ml-0.5 align-middle"
              style={{ animation: "pulse 1s step-start infinite" }}
            />
          )}
        </p>

        {/* Author avatar */}
        {author && (
          <div
            className="mt-5 flex items-center gap-3"
            style={{
              animation: avatarPopped
                ? "popSpring 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) both"
                : "none",
              opacity: avatarPopped ? undefined : 0,
            }}
          >
            <div
              className="w-[60px] h-[60px] rounded-full shrink-0 overflow-hidden"
              style={{
                border: "2.5px solid rgba(255,255,255,0.55)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
              }}
            >
              {author.avatarUrl ? (
                <img
                  src={author.avatarUrl}
                  alt={author.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-white/20">
                  <span className="text-white font-bold text-xl">{initials}</span>
                </div>
              )}
            </div>
            <div>
              <p className="text-white font-semibold text-[15px] leading-tight">{author.name}</p>
              <p className="text-white/60 text-xs mt-0.5">Your Spain experience guide</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section 2: Personal message ─────────────────────────────────────────────

function PersonalMessageSection({ message }: { message: string }) {
  return (
    <div
      className="mx-4 mt-4 rounded-2xl p-5"
      style={{
        background: "white",
        border: "1px solid rgba(180,100,90,0.1)",
        boxShadow: "0 2px 12px rgba(120,60,50,0.06)",
        animation: "fadeSlideUp 0.5s 0.2s ease both",
      }}
    >
      <h3
        className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2"
        style={{ color: "#D94040" }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="8" strokeWidth="2.5"/>
          <line x1="12" y1="12" x2="12" y2="16"/>
        </svg>
        About your trip
      </h3>
      <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#5C3A3A" }}>
        {message}
      </p>
    </div>
  );
}

// ─── Section 3: Itinerary ─────────────────────────────────────────────────────

function ItinerarySection({
  dayGroups,
  onActivityTap,
}: {
  dayGroups: DayGroup[];
  onActivityTap: (a: Activity) => void;
}) {
  return (
    <div
      className="mx-4 mt-4"
      style={{ animation: "fadeSlideUp 0.5s 0.35s ease both" }}
    >
      <h3
        className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2"
        style={{ color: "#D94040" }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        Your itinerary
      </h3>

      <div className="space-y-3">
        {dayGroups.map((group, groupIdx) => (
          <ItineraryDayGroup
            key={group.dateKey}
            group={group}
            groupIdx={groupIdx}
            onActivityTap={onActivityTap}
          />
        ))}
      </div>
    </div>
  );
}

function useScrollReveal(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function ItineraryDayGroup({
  group,
  onActivityTap,
}: {
  group: DayGroup;
  groupIdx: number;
  onActivityTap: (a: Activity) => void;
}) {
  const { ref, visible } = useScrollReveal();

  return (
    <div
      ref={ref}
      className="rounded-2xl overflow-hidden"
      style={{
        background: "white",
        border: "1px solid rgba(180,100,90,0.1)",
        boxShadow: "0 2px 12px rgba(120,60,50,0.06)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
        transition: "opacity 0.4s ease, transform 0.4s ease",
      }}
    >
      {/* Day header */}
      <div
        className="px-4 py-3"
        style={{
          background: "linear-gradient(90deg, rgba(217,64,64,0.06) 0%, rgba(217,64,64,0.01) 100%)",
          borderBottom: "1px solid rgba(217,64,64,0.08)",
        }}
      >
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#D94040" }}>
          Day {group.dayNumber}
        </span>
        <span className="mx-2 text-xs" style={{ color: "#C4AAA8" }}>—</span>
        <span className="text-xs font-medium" style={{ color: "#7A6060" }}>{group.dateLabel}</span>
      </div>

      {/* Activity rows */}
      <div>
        {group.activities.map((activity, idx) => (
          <ItineraryActivityRow
            key={activity.id}
            activity={activity}
            isLast={idx === group.activities.length - 1}
                  onTap={() => onActivityTap(activity)}
          />
        ))}
      </div>
    </div>
  );
}

function ItineraryActivityRow({
  activity,
  isLast,
  onTap,
}: {
  activity: Activity;
  isLast: boolean;
  animDelay?: number;
  onTap: () => void;
}) {
  const { color } = getCategoryStyle(activity.category);
  const rowRef = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <button
      ref={rowRef}
      onClick={onTap}
      className="w-full text-left flex items-center gap-3 px-4 py-3 transition-colors duration-100 active:bg-[#D94040]/[0.03] hover:bg-[#D94040]/[0.02]"
      style={{
        borderBottom: isLast ? "none" : "1px solid rgba(180,100,90,0.07)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : "translateX(-12px)",
        transition: "opacity 0.35s ease, transform 0.35s ease",
      }}
    >
      {/* Icon circle */}
      <div
        className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center"
        style={{ background: `${color}22` }}
      >
        <BigCategoryIcon category={activity.category} color={color} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug truncate" style={{ color: "#3D1C1C" }}>
          {activity.title}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "#9A7A78" }}>
          {formatTime(activity.startTime)}
          {" · "}
          {formatDuration(activity.estimatedDuration)}
        </p>
      </div>

      {/* Chevron */}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="#C4AAA8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </button>
  );
}

// ─── Additional Info section ──────────────────────────────────────────────────

type AdditionalTab = "climate" | "dressCode" | "usefulTips";

const ADDITIONAL_TABS: {
  id: AdditionalTab;
  label: string;
  iconSrc: string;
  key: "climate" | "dressCode" | "usefulTips";
  bg: string;     // active background (subtle pastel)
  color: string;  // text + border colour
}[] = [
  { id: "climate",    label: "Climate",    iconSrc: "/icons/climate.svg",    key: "climate",    bg: "#FEF3C7", color: "#92570A" },
  { id: "dressCode",  label: "Dress Code", iconSrc: "/icons/dress-code.svg", key: "dressCode",  bg: "#DBEAFE", color: "#1E40AF" },
  { id: "usefulTips", label: "Useful Tips",iconSrc: "/icons/tips.svg",       key: "usefulTips", bg: "#D1FAE5", color: "#065F46" },
];

// Icons are always coral red when active, grey when inactive
const ICON_FILTER_ACTIVE   = "brightness(0) saturate(100%) invert(27%) sepia(76%) saturate(1800%) hue-rotate(330deg) brightness(0.95)";
const ICON_FILTER_INACTIVE = "brightness(0) saturate(0%) opacity(0.35)";

function TripAdditionalInfo({
  climate,
  dressCode,
  usefulTips,
}: {
  climate: string;
  dressCode: string;
  usefulTips: string;
}) {
  const [activeTab, setActiveTab] = useState<AdditionalTab>("climate");
  const [iconsPopped, setIconsPopped] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const tabRowRef = useRef<HTMLDivElement>(null);

  // Trigger bounce animation when the tab row (with icons) scrolls into view
  useEffect(() => {
    const el = tabRowRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIconsPopped(true); obs.disconnect(); } },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const content: Record<AdditionalTab, string> = { climate, dressCode, usefulTips };
  const activeTabDef = ADDITIONAL_TABS.find((t) => t.id === activeTab)!;

  return (
    <div
      ref={sectionRef}
      className="mx-4 mt-4 rounded-2xl overflow-hidden"
      style={{
        background: "white",
        border: "1px solid rgba(180,100,90,0.1)",
        boxShadow: "0 2px 12px rgba(120,60,50,0.06)",
        animation: "fadeSlideUp 0.5s 0.1s ease both",
      }}
    >
      {/* Section header — inside the card */}
      <div
        className="px-4 pt-4 pb-3 flex items-center gap-2"
        style={{
          background: "linear-gradient(90deg, rgba(217,64,64,0.06) 0%, rgba(217,64,64,0.01) 100%)",
          borderBottom: "1px solid rgba(217,64,64,0.08)",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D94040"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: "#D94040" }}>
          Good to Know
        </h3>
      </div>

      {/* Tab row */}
      <div ref={tabRowRef} className="flex border-b" style={{ borderColor: "rgba(180,100,90,0.08)" }}>
        {ADDITIONAL_TABS.map((tab, idx) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 flex flex-col items-center gap-1.5 py-3 transition-all duration-200"
              style={{
                background: active ? tab.bg : "transparent",
                borderBottom: active ? `2px solid ${tab.color}` : "2px solid transparent",
              }}
            >
              {/* Icon with pop animation — always coral red */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={tab.iconSrc}
                alt=""
                aria-hidden
                width={22}
                height={22}
                style={{
                  filter: active ? ICON_FILTER_ACTIVE : ICON_FILTER_INACTIVE,
                  animation: iconsPopped
                    ? `iconBounce 0.75s ${idx * 120}ms ease both`
                    : "none",
                  opacity: iconsPopped ? undefined : 0,
                }}
              />
              <span
                className="text-[10px] font-semibold tracking-wide"
                style={{ color: active ? tab.color : "#9A7A78" }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div
        className="px-4 py-4 transition-colors duration-200"
        style={{ background: activeTabDef.bg }}
      >
        {content[activeTab] ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: activeTabDef.color }}>
            {content[activeTab]}
          </p>
        ) : (
          <p className="text-sm italic" style={{ color: `${activeTabDef.color}80` }}>No information added yet.</p>
        )}
      </div>
    </div>
  );
}
