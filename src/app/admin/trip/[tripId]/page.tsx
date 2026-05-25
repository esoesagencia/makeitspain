"use client";

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, where,
  updateDoc, deleteDoc, serverTimestamp, writeBatch, addDoc, Timestamp,
} from "firebase/firestore";
import {
  DndContext, DragEndEvent, DragStartEvent, DragOverlay,
  PointerSensor, useSensor, useSensors, closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { db, COLLECTIONS, SUBCOLLECTIONS } from "@/lib/firebase/firestore";
import { parseMadridDate, parseMadridDateTime, tsToDateInput } from "@/lib/utils/adminDatetime";
import { useAuth } from "@/hooks/useAuth";
import { ActivityForm } from "@/components/admin/ActivityForm";
import { AccommodationSection } from "@/components/admin/AccommodationSection";
import { TripCalendarView, type CalTransferInfo } from "@/components/admin/TripCalendarView";
import { NotificationComposer } from "@/components/admin/NotificationComposer";
import { TripMembersSection } from "@/components/admin/TripMembersSection";
import { TripAIAssistant } from "@/components/admin/TripAIAssistant";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AField, AInput, ASelect, ADivider } from "@/components/admin/AdminPrimitives";
import { PlacesInput } from "@/components/admin/PlacesInput";
import { DateRangePicker } from "@/components/admin/DateRangePicker";
import { formatTime, formatDuration } from "@/lib/utils/time";
import type { Trip, Activity, TripStatus, TripType, BudgetMode, PetSittingEntry, BabysitterEntry, SpecialCareEntry, ActivityCategory, TransferMode, BreakfastType, Accommodation } from "@/types";
import type { TravelTimeResult } from "@/app/api/travel-time/route";

// ─── Trip edit form ───────────────────────────────────────────────────────────

interface TripEditState {
  tripName: string; clientName: string; destination: string;
  startDate: string; endDate: string; status: TripStatus;
  numberOfPeople: string;
  tripType: TripType | "";
  budgetFrom: number;  // 100–100000, step 100
  budgetTo: number;
  budgetMode: BudgetMode;
  specialRequirements: string[];
  petSitting: PetSittingEntry[];
  babysitter: BabysitterEntry[];
  specialCare: SpecialCareEntry[];
}

function tripToEdit(t: Trip): TripEditState {
  return {
    tripName: t.tripName, clientName: t.clientName, destination: t.destination,
    startDate: tsToDateInput(t.startDate), endDate: tsToDateInput(t.endDate),
    status: t.status,
    numberOfPeople: String(t.numberOfPeople ?? 2),
    tripType: t.tripType ?? "",
    budgetFrom: t.budgetFrom ?? 1000,
    budgetTo: t.budgetTo ?? 5000,
    budgetMode: t.budgetMode ?? "per_trip",
    specialRequirements: t.specialRequirements ?? [],
    petSitting: t.petSitting ?? [],
    babysitter: t.babysitter ?? [],
    specialCare: t.specialCare ?? [],
  };
}

const BUDGET_MIN = 100;
const BUDGET_MAX = 100_000;
const BUDGET_STEP = 100;

function formatBudget(amount: number): string {
  if (amount >= BUDGET_MAX) return "€100,000+";
  return `€${amount.toLocaleString("en-EU")}`;
}

function sliderPct(value: number) {
  return ((value - BUDGET_MIN) / (BUDGET_MAX - BUDGET_MIN)) * 100;
}

const SPECIAL_REQUIREMENTS: { key: string; label: string; icon: string }[] = [
  { key: "pet",           label: "Pet",           icon: "/icons/pet.svg" },
  { key: "toddler",       label: "Toddler",       icon: "/icons/baby.svg" },
  { key: "kids",          label: "Kids",          icon: "/icons/children.svg" },
  { key: "special_needs", label: "Special Needs", icon: "/icons/special-needs.svg" },
  { key: "elderly",       label: "Elderly",       icon: "/icons/elderly.svg" },
  { key: "lgbtq",         label: "LGBTQ+",        icon: "/icons/lgbtq.svg" },
];

// ─── Transfer card data ───────────────────────────────────────────────────────

interface TransferInfo {
  fromActivity: Activity;
  toActivity: Activity;
  gapMinutes: number;
  travelOptions: TravelTimeResult[] | null; // null = loading
  loadError: boolean;
  errorMsg?: string;
}

// ─── Category labels ──────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  activity: "Activity", transfer: "Transfer", meal: "Meal",
  free_time: "Free Time", surprise: "Surprise", hotel: "Hotel",
  sleep_in_hotel: "Sleep in Hotel", wellness_grooming: "Wellness & Grooming",
};
const CATEGORY_COLORS: Record<ActivityCategory, string> = {
  activity:          "text-[#0D6E4E]",
  transfer:          "text-[#1A56DB]",
  meal:              "text-[#92570A]",
  free_time:         "text-[#5B21B6]",
  surprise:          "text-[#6B21A8]",
  hotel:             "text-[#9A3412]",
  sleep_in_hotel:    "text-[#1E3A8A]",
  wellness_grooming: "text-[#BE185D]",
};

// ─── Card style tokens (mirrors ActivityPlanCard palette) ─────────────────────

interface AdminCardStyle {
  label:    string;
  color:    string;
  bg:       string;
  pill:     string;
  pillText: string;
  bar:      string;
}

function getAdminCardStyle(cat: ActivityCategory): AdminCardStyle {
  switch (cat) {
    case "transfer":
      return { label: "Transfer",      color: "#1A56DB", bg: "#BFDBFE", pill: "rgba(59,111,202,0.18)",   pillText: "#1A56DB", bar: "linear-gradient(90deg,#1A56DB,#3B6FCA88)" };
    case "meal":
      return { label: "Dining",        color: "#92570A", bg: "#FDE68A", pill: "rgba(192,124,16,0.2)",    pillText: "#92570A", bar: "linear-gradient(90deg,#C07C10,#F59E0B88)" };
    case "free_time":
      return { label: "Free Time",     color: "#5B21B6", bg: "#C4B5FD", pill: "rgba(139,77,192,0.2)",    pillText: "#5B21B6", bar: "linear-gradient(90deg,#7C3AED,#A78BFA88)" };
    case "surprise":
      return { label: "Surprise",      color: "#6B21A8", bg: "#E9D5FF", pill: "rgba(139,77,192,0.2)",    pillText: "#6B21A8", bar: "linear-gradient(90deg,#8B4DC0,#A855F788)" };
    case "hotel":
      return { label: "Hotel",         color: "#9A3412", bg: "#FED7AA", pill: "rgba(192,90,40,0.2)",     pillText: "#9A3412", bar: "linear-gradient(90deg,#C05A28,#FB923C88)" };
    case "sleep_in_hotel":
      return { label: "Hotel/Accom. Night",    color: "#1E3A8A", bg: "#C7D2FE", pill: "rgba(44,78,138,0.2)",  pillText: "#1E3A8A", bar: "linear-gradient(90deg,#2C4E8A,#6366F188)" };
    case "wellness_grooming":
      return { label: "Wellness & Grooming",   color: "#BE185D", bg: "#FBCFE8", pill: "rgba(190,24,93,0.18)", pillText: "#BE185D", bar: "linear-gradient(90deg,#BE185D,#F472B688)" };
    default:
      return { label: "Activity",              color: "#0D6E4E", bg: "#A7F3D0", pill: "rgba(26,158,114,0.2)", pillText: "#0D6E4E", bar: "linear-gradient(90deg,#1A9E72,#34D39988)" };
  }
}

const MODE_LABELS: Record<string, string> = {
  driving: "Taxi / Car", walking: "Walking", transit: "Public Transport",
};
const MODE_ICONS: Record<string, string> = { driving: "🚕", walking: "🚶", transit: "🚇" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addMinutes(ts: { toMillis(): number }, mins: number) {
  return new Date(ts.toMillis() + mins * 60_000);
}

function toHHMM(date: Date): string {
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract HH:MM from a Timestamp in Madrid timezone */
function tsToHHMM(ts: { toDate(): Date }): string {
  const d = ts.toDate();
  const h = d.toLocaleString("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/Madrid" });
  const m = d.toLocaleString("en-GB", { minute: "numeric", timeZone: "Europe/Madrid" });
  const hNum = h === "24" ? 0 : Number(h);
  return `${String(hNum).padStart(2, "0")}:${String(Number(m)).padStart(2, "0")}`;
}

// ─── Inline field ─────────────────────────────────────────────────────────────

/** A span that becomes an <input> on click, saves on blur or Enter. */
function InlineField({
  value,
  onSave,
  type = "text",
  placeholder,
  className,
  style,
}: {
  value: string;
  onSave: (v: string) => void;
  type?: "text" | "time";
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep draft synced when external value changes (e.g. after Firestore update)
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  function startEdit() {
    setDraft(value);
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function commit() {
    setEditing(false);
    const next = type === "time" ? draft : draft.trim();
    if (next !== value) onSave(next);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter")  { e.preventDefault(); commit(); }
    if (e.key === "Escape") { setEditing(false); setDraft(value); }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`rounded px-1.5 py-0.5 bg-white/80 border focus:outline-none focus:ring-1 focus:ring-[#D94040] ${className ?? ""}`}
        style={{ borderColor: "rgba(217,64,64,0.4)", ...style }}
      />
    );
  }

  return (
    <span
      onClick={startEdit}
      title="Click to edit"
      className={`cursor-text rounded px-1 -mx-1 hover:bg-white/40 transition-colors ${className ?? ""}`}
      style={style}
    >
      {value || <span className="italic opacity-30">{placeholder}</span>}
    </span>
  );
}

// ─── Inline Places field ──────────────────────────────────────────────────────
// Like InlineField but backed by Google Places autocomplete.
// `onSave` is called with just the changed field value (plain text edits).
// `onPlacePicked` is called when a suggestion is selected — receives both
// name AND address so the caller can batch-update two Firestore fields at once.

function InlinePlacesField({
  value,
  onSave,
  onPlacePicked,
  searchType,
  placeholder,
  className,
  style,
}: {
  value: string;
  onSave: (v: string) => void;
  onPlacePicked?: (name: string, address: string) => void;
  searchType: "establishment" | "address";
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value);
  // Tracks whether a dropdown pick already committed the value so the
  // blur handler doesn't fire a redundant (potentially stale) save.
  const pickedRef = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  function startEdit() { setDraft(value); pickedRef.current = false; setEditing(true); }

  function commit() {
    if (pickedRef.current) { pickedRef.current = false; return; }
    setEditing(false);
    const next = draft.trim();
    if (next !== value) onSave(next);
  }

  if (!editing) {
    return (
      <span
        onClick={startEdit}
        title="Click to edit"
        className={`cursor-text rounded px-1 -mx-1 hover:bg-white/40 transition-colors ${className ?? ""}`}
        style={style}
      >
        {value || <span className="italic opacity-30">{placeholder}</span>}
      </span>
    );
  }

  return (
    // onBlur fires when focus leaves the entire container (including the dropdown)
    <div
      onBlur={(e) => {
        // Only commit if focus moved fully outside this container
        if (!e.currentTarget.contains(e.relatedTarget as Node)) commit();
      }}
    >
      <PlacesInput
        searchType={searchType}
        value={draft}
        onChange={(v) => setDraft(v)}
        onPlaceSelected={(details) => {
          pickedRef.current = true;
          const displayVal = searchType === "establishment" ? details.name : details.address;
          setDraft(displayVal);
          setEditing(false);
          if (onPlacePicked) {
            onPlacePicked(details.name, details.address);
          } else {
            onSave(displayVal);
          }
        }}
        placeholder={placeholder}
      />
    </div>
  );
}

// ─── Breakfast selector (hotel morning cards) ─────────────────────────────────

const BREAKFAST_OPTIONS: { value: BreakfastType; label: string }[] = [
  { value: "hotel_breakfast",   label: "Hotel breakfast" },
  { value: "special_breakfast", label: "Special breakfast" },
  { value: "no_breakfast",      label: "No breakfast" },
];

function BreakfastSelector({
  activityId, tripId, value, cs,
}: { activityId: string; tripId: string; value: BreakfastType; cs: AdminCardStyle }) {
  const [saving, setSaving] = useState(false);

  async function pick(next: BreakfastType) {
    if (next === value || saving) return;
    setSaving(true);
    try {
      const colRef = collection(db, COLLECTIONS.TRIPS, tripId, SUBCOLLECTIONS.ACTIVITIES);
      await updateDoc(doc(colRef, activityId), { breakfastType: next });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {BREAKFAST_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => pick(opt.value)}
          className="text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-colors"
          style={value === opt.value
            ? { background: cs.pill, borderColor: `${cs.color}40`, color: cs.pillText }
            : { background: "rgba(255,255,255,0.4)", borderColor: `${cs.color}25`, color: `${cs.color}80` }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Big decorative category icon ────────────────────────────────────────────

function CategoryBigIcon({ category, color, isHotelMorningCard }: {
  category: ActivityCategory;
  color: string;
  isHotelMorningCard?: boolean;
}) {
  const icon = (() => {
    // ── Hotel Morning: sun icon ──
    if (isHotelMorningCard) {
      return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="6"/>
          <path d="M12 2V3"/>
          <path d="M12 21V22"/>
          <path d="M22 12L21 12"/>
          <path d="M3 12L2 12"/>
          <path d="M19.0708 4.92969L18.678 5.32252"/>
          <path d="M5.32178 18.6777L4.92894 19.0706"/>
          <path d="M19.0708 19.0703L18.678 18.6775"/>
          <path d="M5.32178 5.32227L4.92894 4.92943"/>
        </svg>
      );
    }

    switch (category) {
      // ── Dining: fork & knife / scissors ──
      case "meal":
        return (
          <svg width="28" height="28" viewBox="0 0 512 512" fill="none" aria-hidden
            stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32">
            <path d="M57.49,47.74,425.92,416.17a37.28,37.28,0,0,1,0,52.72h0a37.29,37.29,0,0,1-52.72,0l-90-91.55A32,32,0,0,1,274,354.91v-5.53a32,32,0,0,0-9.52-22.78l-11.62-10.73a32,32,0,0,0-29.8-7.44h0A48.53,48.53,0,0,1,176.5,295.8L91.07,210.36C40.39,159.68,21.74,83.15,57.49,47.74Z"/>
            <path d="M400,32l-77.25,77.25A64,64,0,0,0,304,154.51v14.86a16,16,0,0,1-4.69,11.32L288,192"/>
            <path d="M320,224l11.31-11.31A16,16,0,0,1,342.63,208h14.86a64,64,0,0,0,45.26-18.75L480,112"/>
            <line x1="440" y1="72" x2="360" y2="152"/>
            <path d="M200,368,100.28,468.28a40,40,0,0,1-56.56,0h0a40,40,0,0,1,0-56.56L128,328"/>
          </svg>
        );

      // ── Transfer: car ──
      case "transfer":
        return (
          <svg width="28" height="28" viewBox="0 0 32 32" fill="currentColor" aria-hidden>
            <path d="M6.59375,6C5.257813,6,4.023438,6.667969,3.28125,7.78125L0.5,11.9375C0.171875,12.429688,0,13,0,13.59375L0,20.21875C0,21.132813,0.613281,21.933594,1.5,22.15625L4.09375,22.8125C4.46875,24.628906,6.078125,26,8,26C9.851563,26,11.398438,24.71875,11.84375,23L21.15625,23C21.601563,24.71875,23.148438,26,25,26C26.851563,26,28.398438,24.71875,28.84375,23L30,23C31.09375,23,32,22.09375,32,21L32,17.34375C32,15.511719,30.746094,13.910156,28.96875,13.46875L23.5625,12.09375L19.65625,7.4375C18.894531,6.527344,17.78125,6,16.59375,6ZM6.59375,8L11,8L11,12L2.875,12L4.9375,8.90625L4.9375,8.875C5.308594,8.316406,5.921875,8,6.59375,8ZM13,8L16.59375,8C17.1875,8,17.746094,8.261719,18.125,8.71875L20.875,12L13,12ZM2,14L22.875,14L28.5,15.40625C29.394531,15.628906,30,16.421875,30,17.34375L30,21L28.84375,21C28.398438,19.28125,26.851563,18,25,18C23.148438,18,21.601563,19.28125,21.15625,21L11.84375,21C11.398438,19.28125,9.851563,18,8,18C6.226563,18,4.738281,19.171875,4.21875,20.78125L2,20.21875ZM8,20C9.117188,20,10,20.882813,10,22C10,23.117188,9.117188,24,8,24C6.882813,24,6,23.117188,6,22C6,20.882813,6.882813,20,8,20ZM25,20C26.117188,20,27,20.882813,27,22C27,23.117188,26.117188,24,25,24C23.882813,24,23,23.117188,23,22C23,20.882813,23.882813,20,25,20Z"/>
          </svg>
        );

      // ── Free Time: three circles with arrows ──
      case "free_time":
        return (
          <svg width="28" height="28" viewBox="0 0 192 192" fill="none" aria-hidden
            stroke="currentColor" strokeWidth="12" strokeLinecap="round">
            <circle cx="53.5" cy="53.5" r="31.5"/>
            <circle cx="53.5" cy="138.5" r="31.5"/>
            <circle cx="138.5" cy="138.5" r="31.5"/>
            <path d="m113 28 25.5 25.5M164 79l-25.5-25.5m0 0L164 28m-25.5 25.5L113 79"/>
          </svg>
        );

      // ── Surprise: gift box ──
      case "surprise":
        return (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 10.0802V20.0802H19V14M5 10.0802H4V7.0802H20V10.0802H5ZM12 7.0802C12.8333 5.24687 14.9999 1.5802 16.9999 3.5802C18.9999 5.5802 14.5 6.91353 12 7.0802ZM12 7.0802C11.1667 5.24687 8.99999 1.5802 6.99999 3.5802C4.99999 5.5802 9.5 6.91353 12 7.0802Z"/>
          </svg>
        );

      // ── Sleep in Hotel: moon with sparkles ──
      case "sleep_in_hotel":
        return (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M14.5739 1.11056L13.7826 2.69316C13.7632 2.73186 13.7319 2.76325 13.6932 2.7826L12.1106 3.5739C11.9631 3.64761 11.9631 3.85797 12.1106 3.93167L13.6932 4.72297C13.7319 4.74233 13.7632 4.77371 13.7826 4.81241L14.5739 6.39502C14.6476 6.54243 14.858 6.54243 14.9317 6.39502L15.723 4.81241C15.7423 4.77371 15.7737 4.74232 15.8124 4.72297L17.395 3.93167C17.5424 3.85797 17.5424 3.64761 17.395 3.5739L15.8124 2.7826C15.7737 2.76325 15.7423 2.73186 15.723 2.69316L14.9317 1.11056C14.858 0.963147 14.6476 0.963148 14.5739 1.11056Z"/>
            <path d="M19.2419 5.07223L18.4633 7.40815C18.4434 7.46787 18.3965 7.51474 18.3368 7.53464L16.0009 8.31328C15.8185 8.37406 15.8185 8.63198 16.0009 8.69276L18.3368 9.4714C18.3965 9.4913 18.4434 9.53817 18.4633 9.59789L19.2419 11.9338C19.3027 12.1161 19.5606 12.1161 19.6214 11.9338L20.4 9.59789C20.42 9.53817 20.4668 9.4913 20.5265 9.4714L22.8625 8.69276C23.0448 8.63198 23.0448 8.37406 22.8625 8.31328L20.5265 7.53464C20.4668 7.51474 20.42 7.46787 20.4 7.40815L19.6214 5.07223C19.5606 4.88989 19.3027 4.88989 19.2419 5.07223Z"/>
            <path fillRule="evenodd" clipRule="evenodd" d="M10.4075 13.6642C13.2348 16.4915 17.6517 16.7363 20.6641 14.3703C20.7014 14.341 20.7385 14.3113 20.7754 14.2812C20.9148 14.1674 21.051 14.0479 21.1837 13.9226C21.2376 13.8718 21.2909 13.8201 21.3436 13.7674C21.8557 13.2552 22.9064 13.5578 22.7517 14.2653C22.6983 14.5098 22.6365 14.7517 22.5667 14.9905C22.5253 15.1321 22.4811 15.2727 22.4341 15.4122C22.4213 15.4502 22.4082 15.4883 22.395 15.5262C20.8977 19.8142 16.7886 23.0003 12 23.0003C5.92487 23.0003 1 18.0754 1 12.0003C1 7.13315 4.29086 2.98258 8.66889 1.54252L8.72248 1.52504C8.8185 1.49401 8.91503 1.46428 9.01205 1.43587C9.26959 1.36046 9.5306 1.29438 9.79466 1.23801C10.5379 1.07934 10.8418 2.19074 10.3043 2.72815C10.251 2.78147 10.1987 2.83539 10.1473 2.88989C10.0456 2.99777 9.94766 3.10794 9.8535 3.22023C9.83286 3.24485 9.8124 3.26957 9.79212 3.29439C7.32966 6.30844 7.54457 10.8012 10.4075 13.6642ZM8.99331 15.0784C11.7248 17.8099 15.6724 18.6299 19.0872 17.4693C17.4281 19.6024 14.85 21.0003 12 21.0003C7.02944 21.0003 3 16.9709 3 12.0003C3 9.09163 4.45653 6.47161 6.66058 4.81846C5.41569 8.27071 6.2174 12.3025 8.99331 15.0784Z"/>
          </svg>
        );

      // ── Hotel (non-morning): building ──
      case "hotel":
        return (
          <svg width="28" height="28" viewBox="0 0 485 485" fill="currentColor" aria-hidden>
            <polygon points="260.439,94.449 224.561,94.449 224.561,58.949 194.561,58.949 194.561,159.949 224.561,159.949 224.561,124.449 260.439,124.449 260.439,159.949 290.439,159.949 290.439,58.949 260.439,58.949"/>
            <path d="M361.501,129.842V0h-236.94v129.842H0V485h485V129.842H361.501z M331.501,455h-25v-85.158h25V455z M276.501,455h-66.94v-85.158h66.94V455z M179.561,455h-25v-85.158h25V455z M455,455h-93.499V339.842h-236.94V455H30V159.842h124.561V30h176.94v129.842H455V455z"/>
            <rect x="65" y="199.842" width="50" height="30"/>
            <rect x="141.25" y="199.842" width="50" height="30"/>
            <rect x="217.5" y="199.842" width="50" height="30"/>
            <rect x="293.75" y="199.842" width="50" height="30"/>
            <rect x="370" y="199.842" width="50" height="30"/>
            <rect x="65" y="269.842" width="50" height="30"/>
            <rect x="141.25" y="269.842" width="50" height="30"/>
            <rect x="217.5" y="269.842" width="50" height="30"/>
            <rect x="293.75" y="269.842" width="50" height="30"/>
            <rect x="370" y="269.842" width="50" height="30"/>
          </svg>
        );

      // ── Wellness & Grooming: beauty spa ──
      case "wellness_grooming":
        // eslint-disable-next-line @next/next/no-img-element
        return <img src="/icons/beauty-spa.svg" width="28" height="28" alt="" aria-hidden
          style={{ filter: "brightness(0) saturate(100%) invert(15%) sepia(90%) saturate(4000%) hue-rotate(310deg) brightness(0.85)", opacity: 0.85 }} />;

      // ── Activity: ticket with star ──
      default:
        return (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden
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
    <div
      className="flex items-center justify-center rounded-full shrink-0"
      style={{ width: 52, height: 52, background: `${color}22`, color }}
    >
      {icon}
    </div>
  );
}

// ─── Sortable activity row ────────────────────────────────────────────────────

const isHotelMorning = (a: Activity) => a.category === "hotel" && a.estimatedDuration === 0;

function SortableActivityRow({
  activity, tripId, isOutOfOrder, prevSleepHotel, accommodations,
  linkedAccommodation, onEdit, onDelete,
}: {
  activity: Activity;
  tripId: string;
  isOutOfOrder: boolean;
  prevSleepHotel?: Activity | null;
  accommodations: Accommodation[];
  /** Accommodation auto-linked via nights assignment */
  linkedAccommodation?: Accommodation | null;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const locked = isHotelMorning(activity);
  const [reminderPopupOpen, setReminderPopupOpen] = useState(false);
  const [bookingLinkOpen, setBookingLinkOpen] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = bellRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.classList.add("bell-slide-in");
        observer.disconnect(); // fire once only
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: activity.id, disabled: locked });

  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const colRef = collection(db, COLLECTIONS.TRIPS, tripId, SUBCOLLECTIONS.ACTIVITIES);

  async function saveField(field: string, raw: string) {
    const update: Record<string, unknown> = {};

    if (field === "title")   { if (!raw) return; update.title   = raw; }
    if (field === "place")   { update.place   = raw; }
    if (field === "address") { update.address = raw; }
    if (field === "specialBreakfastInfo")    { update.specialBreakfastInfo    = raw; }
    if (field === "specialBreakfastContact") { update.specialBreakfastContact = raw; }

    if (field === "startTime" || field === "endTime") {
      const dateStr = activity.startTime.toDate()
        .toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });

      // If editing endTime and new hour is less than start hour → next day
      let targetDate = dateStr;
      if (field === "endTime") {
        const startH = Number(tsToHHMM(activity.startTime).split(":")[0]);
        const newH   = Number(raw.split(":")[0]);
        if (newH < startH) {
          const d = new Date(`${dateStr}T00:00:00`);
          d.setDate(d.getDate() + 1);
          targetDate = d.toISOString().slice(0, 10);
        }
      }
      update[field] = parseMadridDateTime(targetDate, raw);
    }

    if (Object.keys(update).length === 0) return;
    try {
      await updateDoc(doc(colRef, activity.id), update);
    } catch (e) {
      console.error("Inline save failed:", e);
    }
  }

  // Hotel morning cards: prefer linked accommodation from nights system, then prevSleepHotel
  const hotelDisplayName = linkedAccommodation?.name
    ? `${linkedAccommodation.name} – Morning`
    : prevSleepHotel?.place
      ? `${prevSleepHotel.place} – Morning`
      : (activity.place ? `${activity.place} – Morning` : "Hotel Morning");
  const hotelAddress = linkedAccommodation?.address || prevSleepHotel?.address || activity.address;

  const cs = getAdminCardStyle(activity.category);

  const cardBg    = isOutOfOrder ? "#FEF2F2" : cs.bg;
  const cardBorder = isOutOfOrder
    ? "1px solid rgba(231,76,60,0.35)"
    : `1px solid ${cs.color}30`;
  const cardShadow = isOutOfOrder
    ? "0 1px 4px rgba(231,76,60,0.1)"
    : "0 1px 4px rgba(120,60,50,0.07)";

  return (
    <div
      ref={setNodeRef}
      style={{ ...sortableStyle }}
      className="group"
    >
      <div
        className="relative rounded-2xl overflow-hidden transition-all duration-200"
        style={{ background: cardBg, border: cardBorder, boxShadow: cardShadow }}
      >
        {/* Top accent bar */}
        <div className="h-[3px] w-full" style={{ background: isOutOfOrder ? "#E74C3C" : cs.bar }} />

        <div className="relative p-3.5">
          {/* Big decorative icon — bottom right */}
          <div className="absolute bottom-3 right-3 pointer-events-none">
            <CategoryBigIcon
              category={activity.category}
              color={cs.color}
              isHotelMorningCard={locked}
            />
          </div>

          {/* Top row: time + drag handle */}
          <div className="flex items-start justify-between gap-2 mb-2">

            {/* Time display */}
            <div className="flex-1 min-w-0">
              {activity.category === "sleep_in_hotel" ? (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: cs.color, opacity: 0.7 }}>Arrival</span>
                  <InlineField
                    value={tsToHHMM(activity.startTime)}
                    onSave={(v) => saveField("startTime", v)}
                    type="time"
                    className="text-xl font-semibold tabular-nums"
                    style={{ color: cs.color }}
                  />
                </div>
              ) : locked ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold tracking-wider px-2.5 py-1 rounded-full uppercase w-fit" style={{ background: cs.pill, color: cs.pillText }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <circle cx="12" cy="12" r="5"/>
                    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  </svg>
                  Hotel/Accom. Morning
                </span>
              ) : activity.estimatedDuration > 0 ? (
                <div className="flex flex-col gap-1">
                  <div className="flex items-baseline gap-1">
                    <InlineField
                      value={tsToHHMM(activity.startTime)}
                      onSave={(v) => saveField("startTime", v)}
                      type="time"
                      className="text-xl font-semibold tabular-nums"
                      style={{ color: cs.color }}
                    />
                    <span className="text-sm" style={{ color: `${cs.color}70` }}>–</span>
                    <InlineField
                      value={tsToHHMM(activity.endTime)}
                      onSave={(v) => saveField("endTime", v)}
                      type="time"
                      className="text-sm tabular-nums"
                      style={{ color: `${cs.color}80` }}
                    />
                  </div>
                  {/* Duration badge */}
                  <span
                    className="flex items-center gap-1 w-fit text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: `${cs.color}18`, color: cs.color }}
                  >
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                      strokeLinejoin="round" aria-hidden>
                      <circle cx="12" cy="12" r="10"/>
                      <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    {formatDuration(activity.estimatedDuration)}
                  </span>
                </div>
              ) : null}
            </div>

            {/* Right: badges + drag handle */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Time conflict warning */}
              {isOutOfOrder && (
                <span className="text-[10px] font-semibold text-[#E74C3C]">⚠ conflict</span>
              )}
              {/* Booked/Flexible tag */}
              {!locked && activity.estimatedDuration > 0 && (
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase"
                  style={activity.isBooked
                    ? { background: "rgba(217,64,64,0.13)", color: "#D94040" }
                    : { background: "rgba(26,158,114,0.13)", color: "#0D6E4E" }}
                >
                  {activity.isBooked ? "Programmed" : "Flexible"}
                </span>
              )}
              {/* Booking link arrow */}
              <button
                type="button"
                title={activity.contactLink ? "Booking link" : "Add booking link"}
                onClick={(e) => { e.stopPropagation(); setBookingLinkOpen(true); }}
                className="flex items-center justify-center w-6 h-6 rounded-full transition-colors"
                style={{ background: activity.contactLink ? "rgba(26,86,219,0.12)" : "rgba(0,0,0,0.06)" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke={activity.contactLink ? "#1A56DB" : "#9CA3AF"}
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12h14M13 6l6 6-6 6"/>
                </svg>
              </button>

              {/* Notification bell */}
              <style>{`
                @keyframes bell-slide-in {
                  from { transform: translateX(-10px); opacity: 0; }
                  to   { transform: translateX(0);     opacity: 1; }
                }
                .bell-slide-in { animation: bell-slide-in 0.45s cubic-bezier(0.34,1.56,0.64,1) both; }
              `}</style>
              <button
                ref={bellRef}
                type="button"
                title={activity.reminderEnabled ? "Reminder on — click to turn off" : "Set reminder"}
                onClick={async (e) => {
                  e.stopPropagation();
                  if (activity.reminderEnabled) {
                    await updateDoc(
                      doc(collection(db, COLLECTIONS.TRIPS, tripId, SUBCOLLECTIONS.ACTIVITIES), activity.id),
                      { reminderEnabled: false, reminderFireAt: null, reminderSent: false }
                    );
                  } else {
                    setReminderPopupOpen(true);
                  }
                }}
                className="relative flex items-center justify-center w-6 h-6 rounded-full transition-colors"
                style={{ background: activity.reminderEnabled ? "rgba(22,163,74,0.12)" : "rgba(0,0,0,0.06)", opacity: 0 }}
              >
                <BellIcon active={activity.reminderEnabled} />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-white"
                  style={{ background: activity.reminderEnabled ? "#16A34A" : "#9CA3AF" }} />
              </button>

              {/* Drag handle */}
              {!locked ? (
                <button
                  {...attributes}
                  {...listeners}
                  className="p-1 rounded cursor-grab active:cursor-grabbing touch-none opacity-40 hover:opacity-80 transition-opacity"
                  style={{ color: cs.color }}
                  aria-label="Drag to reorder"
                >
                  <GripIcon />
                </button>
              ) : (
                <div className="w-6" aria-hidden />
              )}
            </div>
          </div>

          {/* Fields — constrained to not overlap the decorative icon */}
          <div style={{ paddingRight: 64 }}>

          {/* Title */}
          {locked ? (
            <p className="text-sm font-semibold leading-snug mb-0.5" style={{ color: "#1E0E0B" }}>{hotelDisplayName}</p>
          ) : (
            <InlineField
              value={activity.title}
              onSave={(v) => saveField("title", v)}
              placeholder="Activity name"
              className="text-sm font-semibold leading-snug mb-0.5 block w-full"
              style={{ color: "#1E0E0B" }}
            />
          )}

          {/* Place — with Google Places establishment autocomplete */}
          {locked ? (
            hotelAddress && <p className="text-xs font-medium mb-1" style={{ color: cs.color }}>{hotelAddress}</p>
          ) : (
            <InlinePlacesField
              searchType="establishment"
              value={activity.place ?? ""}
              onSave={(v) => saveField("place", v)}
              onPlacePicked={async (name, address) => {
                // Batch-save place + address together in one write
                try {
                  await updateDoc(
                    doc(collection(db, COLLECTIONS.TRIPS, tripId, SUBCOLLECTIONS.ACTIVITIES), activity.id),
                    { place: name, address },
                  );
                } catch (e) { console.error("Places save failed:", e); }
              }}
              placeholder="Place name"
              className="text-xs font-medium mb-1 block w-full"
              style={{ color: cs.color }}
            />
          )}

          {/* Address — with Google Places geocode autocomplete */}
          {!locked && (
            <InlinePlacesField
              searchType="address"
              value={activity.address}
              onSave={(v) => saveField("address", v)}
              placeholder="Address"
              className="text-xs block w-full"
              style={{ color: "rgba(30,14,11,0.55)" }}
            />
          )}

          </div>{/* end fields constrained area */}

          {/* Auto-linked accommodation banner for sleep_in_hotel */}
          {activity.category === "sleep_in_hotel" && (
            <div className="mt-2" style={{ paddingRight: 64 }}>
              {linkedAccommodation ? (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
                  style={{ background: `${cs.color}10`, border: `1px solid ${cs.color}25` }}>
                  <span className="text-xs">{linkedAccommodation.type === "hotel" ? "🏨" : "🏠"}</span>
                  <span className="text-[11px] font-semibold truncate" style={{ color: cs.color }}>
                    {linkedAccommodation.name || linkedAccommodation.address}
                  </span>
                  <span className="text-[10px] ml-auto shrink-0" style={{ color: `${cs.color}70` }}>auto-linked</span>
                </div>
              ) : accommodations.length > 0 ? (
                <p className="text-[10px] italic" style={{ color: `${cs.color}60` }}>
                  No accommodation assigned for this night — assign nights in the Accommodation section above.
                </p>
              ) : null}
            </div>
          )}

          {/* Breakfast selector for hotel morning cards */}
          {locked && (
            <>
              <BreakfastSelector activityId={activity.id} tripId={tripId} value={activity.breakfastType ?? "hotel_breakfast"} cs={cs} />

              {/* Extra fields for special breakfast */}
              {activity.breakfastType === "special_breakfast" && (
                <div className="mt-2.5 flex flex-col gap-1.5">
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-widest mt-1 shrink-0" style={{ color: cs.color, opacity: 0.7, minWidth: 44 }}>Info</span>
                    <InlineField
                      value={activity.specialBreakfastInfo ?? ""}
                      onSave={(v) => saveField("specialBreakfastInfo", v)}
                      placeholder="e.g. Rooftop terrace, 8–10 am included"
                      className="text-xs flex-1"
                      style={{ color: "#1E0E0B" }}
                    />
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-widest mt-1 shrink-0" style={{ color: cs.color, opacity: 0.7, minWidth: 44 }}>Contact</span>
                    <InlineField
                      value={activity.specialBreakfastContact ?? ""}
                      onSave={(v) => saveField("specialBreakfastContact", v)}
                      placeholder="Phone or restaurant name"
                      className="text-xs flex-1"
                      style={{ color: "#1E0E0B" }}
                    />
                  </div>
                </div>
              )}

              {!prevSleepHotel && (
                <p className="text-[10px] mt-1" style={{ color: `${cs.color}70` }}>No Sleep in Hotel card on previous day</p>
              )}
            </>
          )}

          {/* Bottom row: category pill + flags + action buttons */}
          <div className="flex items-center gap-2 mt-2.5" style={{ paddingRight: 64 }}>
            {/* Category pill — sleep_in_hotel gets a larger pill to match the morning badge */}
            {activity.category === "sleep_in_hotel" ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold tracking-wider px-2.5 py-1 rounded-full uppercase w-fit" style={{ background: cs.pill, color: cs.pillText }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
                {cs.label}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: cs.pill, color: cs.pillText }}>
                {cs.label}
              </span>
            )}

            {/* Extra flags */}
            {activity.isSurprise && (
              <span className="text-[10px] font-semibold text-[#6B21A8]">🎁 Surprise</span>
            )}

            {/* Spacer + action buttons (appear on hover) */}
            {!locked && (
              <div className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={onEdit}
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors"
                  style={{ background: `${cs.color}15`, color: cs.color }}
                >
                  Edit
                </button>
                <button
                  onClick={onDelete}
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors"
                  style={{ background: "rgba(231,76,60,0.12)", color: "#E74C3C" }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {reminderPopupOpen && (
        <ReminderPopup
          activity={activity}
          tripId={tripId}
          onClose={() => setReminderPopupOpen(false)}
        />
      )}

      {bookingLinkOpen && (
        <BookingLinkPopup
          activity={activity}
          tripId={tripId}
          onClose={() => setBookingLinkOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Transfer card ────────────────────────────────────────────────────────────

function TransferCard({ info, onModeChange }: {
  info: TransferInfo;
  onModeChange: (toActivityId: string, mode: TransferMode, durationMinutes: number) => void;
}) {
  const currentMode = info.toActivity.transferMode ?? "driving";
  const currentDuration = info.toActivity.transferDuration;
  const gap = info.gapMinutes;

  // A gap > 8 hours almost certainly means the "from" card is a timeless hotel-morning
  // placeholder (endTime = midnight). Show a friendlier label instead of "10 hrs gap".
  const fromIsTimeless = isHotelMorning(info.fromActivity);
  const gapLabel = fromIsTimeless
    ? "from hotel"
    : gap < 60
      ? `${gap} min`
      : `${Math.floor(gap / 60)} hr${Math.floor(gap / 60) > 1 ? "s" : ""}${gap % 60 > 0 ? ` ${gap % 60} min` : ""}`;

  // Only show the warning if the gap is meaningful (not a timeless card)
  const warning = !fromIsTimeless && currentDuration !== null && currentDuration !== undefined && currentDuration > gap;

  return (
    <div className="mx-0 my-1 rounded-[8px] border px-4 py-3"
      style={warning
        ? { borderColor: "rgba(231,76,60,0.3)", background: "rgba(231,76,60,0.04)" }
        : { borderColor: "rgba(180,100,90,0.12)", background: "rgba(245,237,237,0.6)" }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-px h-4" style={{ background: "rgba(180,100,90,0.2)" }} />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[#9A7A78]">Transfer</span>
        <span className="text-xs text-[#9A7A78]">
          {gapLabel} gap
          {warning && currentDuration !== null && currentDuration !== undefined && (
            <span className="text-[#E74C3C] ml-2">
              ⚠ {currentDuration < 60 ? `${currentDuration} min` : `${Math.floor(currentDuration / 60)} hr${currentDuration % 60 > 0 ? ` ${currentDuration % 60} min` : ""}`} needed — {currentDuration - gap} min short
            </span>
          )}
        </span>
      </div>

      {info.travelOptions === null ? (
        <p className="text-xs text-[#9A7A78] animate-pulse">Calculating travel times…</p>
      ) : info.loadError ? (
        <p className="text-xs text-[#E74C3C]">
          {info.errorMsg ?? "Could not calculate travel times"}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {info.travelOptions.map((opt) => {
            const isActive = currentMode === opt.mode || (currentMode === "taxi" && opt.mode === "driving");
            const over = opt.durationMinutes > gap;
            return (
              <button
                key={opt.mode}
                onClick={() => {
                  const mode: TransferMode = opt.mode === "driving" ? "taxi" : opt.mode as TransferMode;
                  onModeChange(info.toActivity.id, mode, opt.durationMinutes);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border"
                style={isActive
                  ? { background: "#D94040", borderColor: "#D94040", color: "white" }
                  : over
                  ? { borderColor: "rgba(231,76,60,0.4)", color: "#E74C3C" }
                  : { borderColor: "rgba(180,100,90,0.2)", color: "#9A7A78" }}
              >
                <span>{MODE_ICONS[opt.mode]}</span>
                <span>{MODE_LABELS[opt.mode]}</span>
                <span className={over ? "text-[#E74C3C]" : ""} style={{ opacity: over ? 1 : 0.7 }}>
                  {opt.durationMinutes} min
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminTripPage() {
  const router = useRouter();
  const { tripId } = useParams<{ tripId: string }>();
  const { userDoc, loading } = useAuth();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  // Frozen copy used for rendering — only updates when not dragging so Firestore
  // snapshots mid-drag don't cause the list to jump.
  const [displayActivities, setDisplayActivities] = useState<Activity[]>([]);
  const isDraggingRef = useRef(false);
  const [tripLoading, setTripLoading] = useState(true);
  const [transfers, setTransfers] = useState<Map<string, TransferInfo>>(new Map());
  // Sync ref during render so effects always read fresh state without stale closures
  const transfersRef = useRef<Map<string, TransferInfo>>(new Map());
  transfersRef.current = transfers;

  const [editForm, setEditForm] = useState<TripEditState | null>(null);
  const [savingTrip, setSavingTrip] = useState(false);
  const [tripSaved, setTripSaved] = useState(false);
  const [tripError, setTripError] = useState("");
  const [activeServiceTab, setActiveServiceTab] = useState<"pet" | "babysitter" | "special_needs">("pet");

  const [activityFormOpen, setActivityFormOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [addingToDate, setAddingToDate] = useState<string | null>(null); // dateKey for per-day add
  const [addingAtHour, setAddingAtHour] = useState<number | undefined>(undefined);
  const [addingAtMinute, setAddingAtMinute] = useState<number | undefined>(undefined);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [calendarView, setCalendarView] = useState(false);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // Auth guard
  useEffect(() => {
    if (!loading && (!userDoc || userDoc.role !== "admin")) router.replace("/login");
  }, [loading, userDoc, router]);

  // Fetch trip
  useEffect(() => {
    if (!userDoc || userDoc.role !== "admin" || !tripId) return;
    getDoc(doc(db, COLLECTIONS.TRIPS, tripId)).then((snap) => {
      if (!snap.exists()) { router.replace("/admin"); return; }
      const t = { id: snap.id, ...snap.data() } as Trip;
      setTrip(t);
      setEditForm(tripToEdit(t));
      setTripLoading(false);
    });
  }, [userDoc, tripId, router]);

  // Real-time activities
  useEffect(() => {
    if (!userDoc || userDoc.role !== "admin" || !tripId) return;
    const q = query(
      collection(db, COLLECTIONS.TRIPS, tripId, SUBCOLLECTIONS.ACTIVITIES),
      orderBy("sortOrder", "asc"),
    );
    return onSnapshot(
      q,
      (snap) => {
        const next = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Activity));
        setActivities(next);
        // Only update the displayed list when the user isn't mid-drag — prevents
        // Firestore updates from causing the card list to jump during a drag.
        if (!isDraggingRef.current) setDisplayActivities(next);
      },
      (err) => console.warn("[Activities] snapshot error:", err.code),
    );
  }, [userDoc, tripId]);

  // Real-time accommodations
  useEffect(() => {
    if (!userDoc || userDoc.role !== "admin" || !tripId) return;
    const q = query(
      collection(db, COLLECTIONS.TRIPS, tripId, SUBCOLLECTIONS.ACCOMMODATIONS),
      orderBy("sortOrder", "asc"),
    );
    return onSnapshot(q,
      (snap) => {
        console.log("[Accom] snapshot received, docs:", snap.docs.length);
        setAccommodations(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Accommodation)));
      },
      (err) => console.error("[Accom] onSnapshot error:", err),
    );
  }, [userDoc, tripId]);

  // Sync sleep_in_hotel + hotel morning cards whenever accommodation nights change.
  // Tracks a hash of sorted nights per accommodation so it re-runs on any night edit.
  const hotelCardsProcessedRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    if (!trip || !tripId) return;
    const startStr = tsToDateInput(trip.startDate);
    const endStr   = tsToDateInput(trip.endDate);

    accommodations.forEach((accom) => {
      const nightsKey = [...(accom.nights ?? [])].sort().join(",");
      if (hotelCardsProcessedRef.current.get(accom.id) === nightsKey) return;
      hotelCardsProcessedRef.current.set(accom.id, nightsKey);

      import("@/lib/utils/hotelCards").then(({ syncHotelCardsForAccommodation }) => {
        syncHotelCardsForAccommodation(tripId, accom, startStr, endStr).catch(console.error);
      });
    });
  }, [accommodations, trip, tripId]);

  // Auto-prune activities outside trip date range
  useEffect(() => {
    if (!trip || !tripId || activities.length === 0) return;
    const startStr = tsToDateInput(trip.startDate);
    const endStr   = tsToDateInput(trip.endDate);
    const toMadridKey = (ts: { toDate(): Date }) =>
      ts.toDate().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
    const outside = activities.filter((a) => {
      const key = toMadridKey(a.startTime);
      return key < startStr || key > endStr;
    });
    if (outside.length === 0) return;
    const actColRef = collection(db, COLLECTIONS.TRIPS, tripId, SUBCOLLECTIONS.ACTIVITIES);
    Promise.all(outside.map((a) => deleteDoc(doc(actColRef, a.id)))).catch(console.error);
  }, [trip, activities, tripId]);

  // Calculate transfers when activities change
  const fetchingRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (activities.length < 2) {
      const empty = new Map<string, TransferInfo>();
      transfersRef.current = empty;
      setTransfers(empty);
      return;
    }

    const current = transfersRef.current;
    const newTransfers = new Map<string, TransferInfo>();

    const sortedActivities = [...activities].sort((a, b) => {
      const da = a.startTime.toDate().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
      const db2 = b.startTime.toDate().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
      return da !== db2 ? da.localeCompare(db2) : a.sortOrder - b.sortOrder;
    });

    console.log("[transfers] sorted pairs:", sortedActivities.map(a => `${a.category}(${a.id.slice(-4)},SO=${a.sortOrder})`));

    sortedActivities.forEach((act, i) => {
      if (i === 0) return;
      const prev = sortedActivities[i - 1];
      const key = `${prev.id}->${act.id}`;
      console.log(`[transfers] pair: ${prev.category}(${prev.id.slice(-4)}) -> ${act.category}(${act.id.slice(-4)}) | key=${key}`);

      const gapMs = act.startTime.toMillis() - prev.endTime.toMillis();
      const gapMinutes = Math.max(0, Math.round(gapMs / 60_000));

      const existing = current.get(key);
      const sameAddresses = !!(existing &&
        existing.fromActivity.address === prev.address &&
        existing.toActivity.address === act.address);

      // If either address is missing, don't pretend we're loading
      const hasAddresses = !!(prev.address && act.address);

      newTransfers.set(key, {
        fromActivity: prev,
        toActivity: act,
        gapMinutes,
        travelOptions: !hasAddresses ? [] : sameAddresses ? existing!.travelOptions : null,
        loadError: sameAddresses ? existing!.loadError : false,
      });

      if (hasAddresses && !sameAddresses && !fetchingRef.current.has(key)) {
        fetchingRef.current.add(key);
        fetch("/api/travel-time", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ origin: prev.address, destination: act.address }),
        })
          .then((r) => r.json())
          .then((data: { results: TravelTimeResult[]; errors?: string[] }) => {
            if (data.errors?.length) console.warn("[travel-time]", data.errors);
            setTransfers((latest) => {
              const updated = new Map(latest);
              const entry = updated.get(key);
              if (entry) updated.set(key, { ...entry, travelOptions: data.results ?? [], loadError: (data.results ?? []).length === 0, errorMsg: data.errors?.join("; ") });
              return updated;
            });
          })
          .catch(() => {
            setTransfers((latest) => {
              const updated = new Map(latest);
              const entry = updated.get(key);
              if (entry) updated.set(key, { ...entry, travelOptions: [], loadError: true });
              return updated;
            });
          })
          .finally(() => fetchingRef.current.delete(key));
      }
    });

    setTransfers(newTransfers);
  }, [activities]);

  // ── Drag & drop — reorders and updates date on cross-day moves ──────────────
  async function handleDragEnd(event: DragEndEvent) {
    isDraggingRef.current = false;
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) {
      setDisplayActivities(activities);
      return;
    }

    const fromIdx = displayActivities.findIndex((a) => a.id === active.id);
    const toIdx   = displayActivities.findIndex((a) => a.id === over.id);
    if (fromIdx === -1 || toIdx === -1) { setDisplayActivities(activities); return; }

    const dragged = displayActivities[fromIdx];
    const target  = displayActivities[toIdx];

    // Never move a hotel morning card — it's locked to the top of its day
    if (isHotelMorning(dragged) || isHotelMorning(target)) {
      setDisplayActivities(activities);
      return;
    }

    const reordered = arrayMove(displayActivities, fromIdx, toIdx);
    // Show the new order immediately — don't wait for the Firestore round-trip
    setDisplayActivities(reordered);
    const batch = writeBatch(db);
    const colRef = collection(db, COLLECTIONS.TRIPS, tripId, SUBCOLLECTIONS.ACTIVITIES);

    // Update sortOrders for all shifted items
    reordered.forEach((act, i) => {
      if (act.sortOrder !== i) batch.update(doc(colRef, act.id), { sortOrder: i });
    });

    // Cross-day move: update date/startTime/endTime to target's date
    const draggedDateKey = dragged.startTime.toDate()
      .toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
    const targetDateKey  = target.startTime.toDate()
      .toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });

    if (draggedDateKey !== targetDateKey && dragged.estimatedDuration > 0) {
      const startHHMM = tsToHHMM(dragged.startTime);
      const endHHMM   = tsToHHMM(dragged.endTime);
      const startH    = Number(startHHMM.split(":")[0]);
      const endH      = Number(endHHMM.split(":")[0]);

      // If end hour < start hour the activity crosses midnight — end date is +1
      const endDateKey = endH < startH
        ? (() => {
            const d = new Date(`${targetDateKey}T00:00:00`);
            d.setDate(d.getDate() + 1);
            return d.toISOString().slice(0, 10);
          })()
        : targetDateKey;

      batch.update(doc(colRef, dragged.id), {
        date:      parseMadridDate(targetDateKey),
        startTime: parseMadridDateTime(targetDateKey, startHHMM),
        endTime:   parseMadridDateTime(endDateKey,   endHHMM),
      });
    }

    await batch.commit();
  }

  // ── Auto hotel morning card ───────────────────────────────────────────────────
  // Triggered by any sleep_in_hotel activity. Computes next-day date directly —
  // no need for Day 2 activities to already exist.
  const creatingHotelRef = useRef(false);

  useEffect(() => {
    if (!tripId || !trip || creatingHotelRef.current) return;

    const SPAIN = "Europe/Madrid";
    const toDateKey = (a: Activity) =>
      a.startTime.toDate().toLocaleDateString("sv-SE", { timeZone: SPAIN });

    // Nights covered by any accommodation — mornings for these are managed by the accommodation sync.
    const accommodationNights = new Set(
      accommodations.flatMap((a) => a.nights ?? []),
    );

    const startDateKey = trip.startDate.toDate().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });

    // Find every sleep_in_hotel activity whose next morning card is missing.
    // Skip accommodation-linked sleeps and any night already covered by an accommodation.
    const sleepActs = activities.filter(
      (a) => a.category === "sleep_in_hotel" &&
             !a.linkedAccommodationId &&
             !accommodationNights.has(toDateKey(a)),
    );
    if (sleepActs.length === 0) return;

    const colRef = collection(db, COLLECTIONS.TRIPS, tripId, SUBCOLLECTIONS.ACTIVITIES);

    // Build list of (nextDayKey, sleepActivity) pairs that need a morning card
    const toCreate: { nextDayKey: string; sleepAct: Activity }[] = [];
    for (const sleepAct of sleepActs) {
      const sleepDate = toDateKey(sleepAct);
      // Use UTC arithmetic to avoid local-timezone offset shifting the date
      const [y, m, d] = sleepDate.split("-").map(Number);
      const nextDayKey = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);

      // Don't create a morning card on the first trip day (guest hasn't slept there yet)
      if (nextDayKey === startDateKey) continue;

      // Don't create a morning card beyond the trip's end date
      const endDateKey = trip
        ? trip.endDate.toDate().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" })
        : null;
      if (endDateKey && nextDayKey > endDateKey) continue;

      const alreadyExists = activities.some(
        (a) => toDateKey(a) === nextDayKey && a.category === "hotel" && a.estimatedDuration === 0,
      );
      if (!alreadyExists) {
        toCreate.push({ nextDayKey, sleepAct });
      }
    }

    if (toCreate.length === 0) return;

    creatingHotelRef.current = true;

    (async () => {
      try {
        for (const { nextDayKey, sleepAct } of toCreate) {
          // Compute a sortOrder that is strictly AFTER all sleep-day activities
          // and strictly BEFORE all next-day activities (if any exist).
          // This guarantees the morning card always heads Day N+1.
          const sleepDateKey = toDateKey(sleepAct);
          const lastOnSleepDay = activities
            .filter((a) => toDateKey(a) === sleepDateKey)
            .sort((a, b) => b.sortOrder - a.sortOrder)[0];
          const firstOnNextDay = activities
            .filter((a) => toDateKey(a) === nextDayKey)
            .sort((a, b) => a.sortOrder - b.sortOrder)[0];

          let morningOrder: number;
          if (lastOnSleepDay && firstOnNextDay) {
            // Slot halfway between last sleep-day activity and first next-day activity
            morningOrder = (lastOnSleepDay.sortOrder + firstOnNextDay.sortOrder) / 2;
          } else if (lastOnSleepDay) {
            // No next-day activities yet — place right after the sleep day
            morningOrder = lastOnSleepDay.sortOrder + 1;
          } else if (firstOnNextDay) {
            // No sleep-day activities (edge case) — place before next-day
            morningOrder = firstOnNextDay.sortOrder - 1;
          } else {
            morningOrder = activities.length;
          }

          // Create the timeless hotel morning card
          const midnight = parseMadridDateTime(nextDayKey, "00:00");
          await addDoc(colRef, {
            title:                 sleepAct.place ? `${sleepAct.place} – Morning` : "Hotel Morning",
            place:                 sleepAct.place || "",
            breakfastType:         "hotel_breakfast",
            address:               sleepAct.address || "",
            description:           "",
            date:                  parseMadridDate(nextDayKey),
            startTime:             midnight,
            endTime:               midnight,
            estimatedDuration:     0,
            category:              "hotel",
            isSurprise:            false,
            surpriseVisibleAt:     null,
            isBooked:              false,
            isVisited:             false,
            visitedBy:             [],
            sortOrder:             morningOrder,
            transferMode:          "taxi",
            transferDuration:      null,
            recommendations:       null,
            contactPhone:          null,
            contactLink:           null,
            coordinatorNote:       null,
            imageUrl:              null,
            reminderEnabled:       false,
            reminderMinutesBefore: 0,
            reminderMessage:       "",
            reminderFireAt:        null,
            reminderSent:          false,
          });
        }
      } finally {
        // Always reset — even if addDoc throws, the next activities change will retry
        creatingHotelRef.current = false;
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, tripId, trip, accommodations]);

  // ── Transfer mode change ─────────────────────────────────────────────────────
  const handleModeChange = useCallback(async (
    toActivityId: string,
    mode: TransferMode,
    durationMinutes: number,
  ) => {
    const colRef = collection(db, COLLECTIONS.TRIPS, tripId, SUBCOLLECTIONS.ACTIVITIES);
    const toActivity = activities.find((a) => a.id === toActivityId);
    if (!toActivity) return;

    const toIdx = activities.indexOf(toActivity);
    const prev = activities[toIdx - 1];
    if (!prev) return;

    const updates: Record<string, unknown> = { transferMode: mode, transferDuration: durationMinutes };

    // If next activity is NOT booked, shift its start time
    if (!toActivity.isBooked) {
      const newStart = addMinutes(prev.endTime, durationMinutes);
      const duration = toActivity.endTime.toMillis() - toActivity.startTime.toMillis();
      const newEnd   = new Date(newStart.getTime() + duration);
      // We store as Timestamps — reuse existing seconds offset approach
      const { Timestamp } = await import("firebase/firestore");
      updates.startTime = Timestamp.fromMillis(newStart.getTime());
      updates.endTime   = Timestamp.fromMillis(newEnd.getTime());
    } else {
      // Booked: shrink previous activity's end time instead
      const newPrevEnd = addMinutes(toActivity.startTime, -durationMinutes);
      const { Timestamp } = await import("firebase/firestore");
      await updateDoc(doc(colRef, prev.id), {
        endTime: Timestamp.fromMillis(newPrevEnd.getTime()),
      });
    }

    await updateDoc(doc(colRef, toActivityId), updates);
  }, [activities, tripId]);

  // ── Save trip details ────────────────────────────────────────────────────────
  const handleSaveTrip = useCallback(async () => {
    if (!editForm || !tripId || !trip) return;
    if (!editForm.tripName || !editForm.clientName || !editForm.destination || !editForm.startDate || !editForm.endDate) {
      setTripError("All fields are required."); return;
    }
    if (editForm.endDate < editForm.startDate) { setTripError("End date must be after start date."); return; }

    const newStartStr = editForm.startDate;
    const oldStartStr = tsToDateInput(trip.startDate);

    setSavingTrip(true); setTripError("");
    try {
      await updateDoc(doc(db, COLLECTIONS.TRIPS, tripId), {
        tripName:       editForm.tripName.trim(),
        clientName:     editForm.clientName.trim(),
        destination:    editForm.destination.trim(),
        startDate:      parseMadridDate(editForm.startDate),
        endDate:        parseMadridDate(editForm.endDate),
        status:         editForm.status,
        numberOfPeople: parseInt(editForm.numberOfPeople, 10) || 2,
        tripType:             editForm.tripType || null,
        budgetFrom:           editForm.budgetFrom,
        budgetTo:             editForm.budgetTo,
        budgetMode:           editForm.budgetMode,
        specialRequirements:  editForm.specialRequirements,
        petSitting:           editForm.petSitting,
        babysitter:           editForm.babysitter,
        specialCare:          editForm.specialCare,
        updatedAt:      serverTimestamp(),
      });

      // ── Shift activities so Day 1 always equals the chosen start date ─────────
      if (oldStartStr !== newStartStr) {
        // Read activities FRESH from Firestore — never use React state here,
        // which may be stale from a previous save in the same session.
        const actColRef  = collection(db, COLLECTIONS.TRIPS, tripId, SUBCOLLECTIONS.ACTIVITIES);
        const freshSnap  = await getDocs(actColRef);
        const freshActs  = freshSnap.docs;

        if (freshActs.length > 0) {
          const toMadridKey = (ts: { toDate(): Date }) =>
            ts.toDate().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });

          // Find the earliest activity date in Firestore right now
          const earliestStr = freshActs
            .map((d) => toMadridKey((d.data().startTime as { toDate(): Date })))
            .sort()[0];

          const [ny, nm, nd] = newStartStr.split("-").map(Number);
          const [ey, em, ed] = earliestStr.split("-").map(Number);
          const shiftDays = Math.round(
            (Date.UTC(ny, nm - 1, nd) - Date.UTC(ey, em - 1, ed)) / 86_400_000
          );

          if (shiftDays !== 0) {
            /** Move a Timestamp by shiftDays calendar days, keeping the Madrid clock time. */
            const shiftTs = (ts: { toDate(): Date }) => {
              const d = ts.toDate();
              const dateStr = d.toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
              const hRaw = d.toLocaleString("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/Madrid" });
              const mRaw = d.toLocaleString("en-GB", { minute: "numeric",              timeZone: "Europe/Madrid" });
              const h = hRaw === "24" ? 0 : Number(hRaw);
              const m = Number(mRaw);
              const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
              const [y, mo, day] = dateStr.split("-").map(Number);
              const newDate = new Date(Date.UTC(y, mo - 1, day + shiftDays)).toISOString().slice(0, 10);
              return parseMadridDateTime(newDate, timeStr);
            };

            const CHUNK = 400;
            for (let i = 0; i < freshActs.length; i += CHUNK) {
              const batch = writeBatch(db);
              freshActs.slice(i, i + CHUNK).forEach((snap) => {
                const data = snap.data();
                batch.update(doc(actColRef, snap.id), {
                  date:      shiftTs(data.date      as { toDate(): Date }),
                  startTime: shiftTs(data.startTime as { toDate(): Date }),
                  endTime:   shiftTs(data.endTime   as { toDate(): Date }),
                });
              });
              await batch.commit();
            }
          }
        }
      }

      // ── Delete activities outside the new date range ──────────────────────────
      {
        const newEndStr  = editForm.endDate;
        const actColRef  = collection(db, COLLECTIONS.TRIPS, tripId, SUBCOLLECTIONS.ACTIVITIES);
        const freshSnap  = await getDocs(actColRef);
        const toMadridKey = (ts: { toDate(): Date }) =>
          ts.toDate().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
        const outside = freshSnap.docs.filter((d) => {
          const dateKey = toMadridKey(d.data().startTime as { toDate(): Date });
          return dateKey < newStartStr || dateKey > newEndStr;
        });
        if (outside.length > 0) {
          const CHUNK = 400;
          for (let i = 0; i < outside.length; i += CHUNK) {
            const batch = writeBatch(db);
            outside.slice(i, i + CHUNK).forEach((snap) => batch.delete(doc(actColRef, snap.id)));
            await batch.commit();
          }
        }
      }

      // ── Auto-prune / shift accommodation nights ───────────────────────────────
      const [sy, sm, sd] = editForm.startDate.split("-").map(Number);
      const [ey, em, ed] = editForm.endDate.split("-").map(Number);
      const validNights = new Set<string>();
      for (let ms = Date.UTC(sy, sm - 1, sd); ms < Date.UTC(ey, em - 1, ed); ms += 86_400_000) {
        validNights.add(new Date(ms).toISOString().slice(0, 10));
      }

      // For accommodations use the simple trip-start delta (nights are always correct dates)
      const [oy2, om2, od2] = oldStartStr.split("-").map(Number);
      const accomShift = Math.round(
        (Date.UTC(sy, sm - 1, sd) - Date.UTC(oy2, om2 - 1, od2)) / 86_400_000
      );

      if (accomShift !== 0 && accommodations.length > 0) {
        const accomColRef = collection(db, COLLECTIONS.TRIPS, tripId, SUBCOLLECTIONS.ACCOMMODATIONS);
        await Promise.all(
          accommodations.map((a) => {
            const shiftedNights = (a.nights ?? [])
              .map((n) => {
                const [y, m, d] = n.split("-").map(Number);
                return new Date(Date.UTC(y, m - 1, d + accomShift)).toISOString().slice(0, 10);
              })
              .filter((n) => validNights.has(n));
            if (shiftedNights.join(",") === (a.nights ?? []).join(",")) return Promise.resolve();
            return updateDoc(doc(collection(db, COLLECTIONS.TRIPS, tripId, SUBCOLLECTIONS.ACCOMMODATIONS), a.id), {
              nights: shiftedNights,
            });
          })
        );
      } else {
        // No shift — just prune nights that fall outside the new range
        const accomColRef = collection(db, COLLECTIONS.TRIPS, tripId, SUBCOLLECTIONS.ACCOMMODATIONS);
        await Promise.all(
          accommodations
            .filter((a) => (a.nights ?? []).some((n) => !validNights.has(n)))
            .map((a) =>
              updateDoc(doc(accomColRef, a.id), {
                nights: (a.nights ?? []).filter((n) => validNights.has(n)),
              })
            )
        );
      }

      setTripSaved(true);
      setTimeout(() => setTripSaved(false), 3000);
    } catch { setTripError("Failed to save."); }
    finally { setSavingTrip(false); }
  }, [editForm, tripId, trip, accommodations]);

  const handleDeleteActivity = useCallback(async (id: string) => {
    if (!confirm("Delete this activity? This cannot be undone.")) return;
    await deleteDoc(doc(db, COLLECTIONS.TRIPS, tripId, SUBCOLLECTIONS.ACTIVITIES, id));
  }, [tripId]);

  const openAdd   = useCallback((dateKey: string, hour?: number, minute?: number) => {
    setEditingActivity(null);
    setAddingToDate(dateKey);
    setAddingAtHour(hour);
    setAddingAtMinute(minute);
    setActivityFormOpen(true);
  }, []);
  const openEdit  = useCallback((a: Activity) => { setEditingActivity(a); setAddingToDate(null); setAddingAtHour(undefined); setAddingAtMinute(undefined); setActivityFormOpen(true); }, []);
  const closeForm = useCallback(() => { setActivityFormOpen(false); setEditingActivity(null); setAddingToDate(null); setAddingAtHour(undefined); setAddingAtMinute(undefined); }, []);

  // ── Derived: default date and prev end hour for new activity ─────────────────
  // Pick the chronologically last activity as default for the new-activity form.
  const lastActivity = activities.length > 0
    ? [...activities].sort((a, b) => a.startTime.toMillis() - b.startTime.toMillis()).at(-1)!
    : null;
  const tripStartDate = trip ? tsToDateInput(trip.startDate) : "";
  const tripEndDate   = trip ? tsToDateInput(trip.endDate) : "";
  const prevEndDate   = lastActivity ? tsToDateInput(lastActivity.date) : tripStartDate;
  const prevEndHour   = lastActivity
    ? lastActivity.endTime.toDate().toLocaleString("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/Madrid" }) === "24"
      ? 0
      : Number(lastActivity.endTime.toDate().toLocaleString("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/Madrid" }))
    : undefined;

  // ── Derived: active service sections — must be before any early returns ──────
  const activeSections = useMemo(() => {
    const reqs = editForm?.specialRequirements ?? [];
    const sections: { key: "pet" | "babysitter" | "special_needs"; label: string }[] = [];
    if (reqs.includes("pet")) sections.push({ key: "pet", label: "Pet Sitting" });
    if (reqs.includes("toddler") || reqs.includes("kids")) sections.push({ key: "babysitter", label: "Babysitter" });
    if (reqs.includes("special_needs")) sections.push({ key: "special_needs", label: "Special Care" });
    return sections;
  }, [editForm?.specialRequirements]);

  // Keep activeServiceTab pointing at a valid section when requirements change
  useEffect(() => {
    if (activeSections.length > 0 && !activeSections.find((s) => s.key === activeServiceTab)) {
      setActiveServiceTab(activeSections[0].key);
    }
  }, [activeSections, activeServiceTab]);

  // ── Guards ───────────────────────────────────────────────────────────────────
  if (loading || !userDoc) return <Spinner />;
  if (userDoc.role !== "admin") return null;
  if (tripLoading || !trip || !editForm) return <Spinner />;

  function setField<K extends keyof TripEditState>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setEditForm((f) => f ? { ...f, [key]: e.target.value } : f);
      setTripError(""); setTripSaved(false);
    };
  }

  const nights = editForm.startDate && editForm.endDate && editForm.endDate >= editForm.startDate
    ? Math.round((new Date(editForm.endDate).getTime() - new Date(editForm.startDate).getTime()) / 86_400_000)
    : null;

  return (
    <div className="min-h-screen bg-[#F5EDED]">
      {/* AI Assistant */}
      <TripAIAssistant
        trip={trip}
        activities={activities}
        accommodations={accommodations}
        onActivitiesChanged={() => {}}
      />

      {/* Header */}
      <header className="sticky top-0 z-20" style={{ background: "#D94040", boxShadow: "0 2px 12px rgba(217,64,64,0.3)" }}>
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center gap-4">
          <button onClick={() => router.push("/admin")} className="p-1.5 rounded-[6px] text-white/70 hover:text-white hover:bg-white/10 transition-colors" aria-label="Back">
            <ChevronLeftIcon />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-lg font-semibold truncate" style={{ color: "#fff" }}>{trip.tripName}</h1>
            <p className="text-xs text-white/70">{trip.clientName}</p>
          </div>
          <Badge status={trip.status} forceWhiteBg />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-8">

        {/* ── Trip details ── */}
        <section className="rounded-[12px] bg-white p-5" style={{ border: "1px solid rgba(180,100,90,0.15)", boxShadow: "0 2px 12px rgba(120,60,50,0.06)" }}>
          <h2 className="font-display text-base font-semibold text-[#1E0E0B] mb-5">Trip Details</h2>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <AField label="Trip Name">
                <AInput value={editForm.tripName} onChange={setField("tripName")} />
              </AField>
              <AField label="Client Name">
                <AInput value={editForm.clientName} onChange={setField("clientName")} />
              </AField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <AField label="Destination">
                <AInput value={editForm.destination} onChange={setField("destination")} />
              </AField>
              <AField label="Number of People">
                <AInput type="number" min="1" max="50" value={editForm.numberOfPeople} onChange={setField("numberOfPeople")} />
              </AField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <AField label="Status">
                <ASelect value={editForm.status} onChange={setField("status")}>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                </ASelect>
              </AField>
              <AField label="Trip Type">
                <ASelect value={editForm.tripType} onChange={setField("tripType")}>
                  <option value="">— select type —</option>
                  <option value="bachelor_hen">🪄 Bachelor / Hen</option>
                  <option value="bachelorette_stag">🎉 Bachelorette / Stag Do</option>
                  <option value="romantic">❤️ Romantic</option>
                  <option value="honeymoon">🥂 Honeymoon</option>
                  <option value="birthday">🎂 Birthday</option>
                  <option value="business">💼 Business</option>
                  <option value="special_event">⭐ Special Event</option>
                  <option value="party_trip">🎊 Party Trip</option>
                  <option value="other">✨ Other</option>
                </ASelect>
              </AField>
            </div>

            {/* ── Budget ── */}
            <AField label="Trip Budget">
              <div className="flex flex-col gap-3">
                <style>{`
                  .dual-range { -webkit-appearance: none; appearance: none; position: absolute; inset: 0; width: 100%; background: transparent; pointer-events: none; height: 5px; margin: auto; }
                  .dual-range::-webkit-slider-thumb { -webkit-appearance: none; pointer-events: all; width: 18px; height: 18px; border-radius: 50%; background: #D94040; border: 2.5px solid #fff; box-shadow: 0 1px 6px rgba(217,64,64,0.35); cursor: pointer; }
                  .dual-range::-moz-range-thumb { pointer-events: all; width: 18px; height: 18px; border-radius: 50%; background: #D94040; border: 2px solid #fff; box-shadow: 0 1px 6px rgba(217,64,64,0.35); cursor: pointer; border-style: solid; }
                `}</style>

                {/* Per trip / per person toggle */}
                <div className="flex rounded-lg overflow-hidden self-start"
                  style={{ border: "1px solid rgba(180,100,90,0.2)", background: "rgba(245,237,237,0.6)" }}>
                  {(["per_trip", "per_person"] as BudgetMode[]).map((mode) => (
                    <button key={mode} type="button"
                      onClick={() => setEditForm((f) => f ? { ...f, budgetMode: mode } : f)}
                      className="px-3 py-1.5 text-xs font-medium transition-colors"
                      style={editForm.budgetMode === mode ? { background: "#D94040", color: "#fff" } : { color: "#9A7A78" }}>
                      {mode === "per_trip" ? "Per Trip" : "Per Person"}
                    </button>
                  ))}
                </div>

                {/* Dual-thumb slider track */}
                <div className="relative h-5 flex items-center">
                  {/* Rail */}
                  <div className="absolute inset-x-0 h-[5px] rounded-full" style={{ background: "rgba(180,100,90,0.18)" }} />
                  {/* Active fill between thumbs */}
                  <div className="absolute h-[5px] rounded-full pointer-events-none" style={{
                    left: `${sliderPct(editForm.budgetFrom)}%`,
                    right: `${100 - sliderPct(editForm.budgetTo)}%`,
                    background: "#D94040",
                  }} />
                  {/* From thumb — higher z-index when near the right so it stays draggable */}
                  <input
                    type="range" min={BUDGET_MIN} max={BUDGET_MAX} step={BUDGET_STEP}
                    value={editForm.budgetFrom}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setEditForm((f) => f ? { ...f, budgetFrom: Math.min(val, f.budgetTo) } : f);
                    }}
                    className="dual-range"
                    style={{ zIndex: editForm.budgetFrom >= editForm.budgetTo - BUDGET_STEP ? 5 : 3 }}
                  />
                  {/* To thumb */}
                  <input
                    type="range" min={BUDGET_MIN} max={BUDGET_MAX} step={BUDGET_STEP}
                    value={editForm.budgetTo}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setEditForm((f) => f ? { ...f, budgetTo: Math.max(val, f.budgetFrom) } : f);
                    }}
                    className="dual-range"
                    style={{ zIndex: 4 }}
                  />
                </div>

                {/* From / Till labels */}
                <div className="flex items-center justify-between text-xs tabular-nums">
                  <span style={{ color: "#9A7A78" }}>From <span className="font-semibold" style={{ color: "#D94040" }}>{formatBudget(editForm.budgetFrom)}</span></span>
                  <span style={{ color: "#9A7A78" }}>Till <span className="font-semibold" style={{ color: "#D94040" }}>{formatBudget(editForm.budgetTo)}</span></span>
                </div>
              </div>
            </AField>

            <AField label="Trip Dates">
              <DateRangePicker
                startDate={editForm.startDate}
                endDate={editForm.endDate}
                onChange={(s, e) => {
                  setEditForm((f) => f ? { ...f, startDate: s, endDate: e } : f);
                  setTripSaved(false); setTripError("");
                }}
              />
            </AField>
            {/* ── Special Requirements ── */}
            <div className="pt-4">
            <AField label="Special Requirements">
              <div className="flex flex-wrap gap-2">
                {SPECIAL_REQUIREMENTS.map(({ key, label, icon }) => {
                  const active = editForm.specialRequirements.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        setEditForm((f) => {
                          if (!f) return f;
                          const next = active
                            ? f.specialRequirements.filter((r) => r !== key)
                            : [...f.specialRequirements, key];
                          return { ...f, specialRequirements: next };
                        })
                      }
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                      style={
                        active
                          ? { background: "#D94040", color: "#fff", border: "1.5px solid #D94040" }
                          : { background: "rgba(245,237,237,0.7)", color: "#9A7A78", border: "1.5px solid rgba(180,100,90,0.18)" }
                      }
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={icon}
                        alt=""
                        width={18}
                        height={18}
                        style={{ filter: active ? "brightness(0) invert(1)" : "none", opacity: active ? 1 : 0.55 }}
                      />
                      {label}
                    </button>
                  );
                })}
              </div>
            </AField>
            </div>

            {/* ── Service sections (pet sitting / babysitter / special care) ── */}
            {activeSections.length > 0 && (
              <div className="pt-2">
                {/* Tab switcher — only when 2+ sections active */}
                {activeSections.length > 1 && (
                  <div className="flex items-center gap-2 mb-4">
                    {activeSections.map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => setActiveServiceTab(s.key)}
                        className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                        style={
                          activeServiceTab === s.key
                            ? { background: "#D94040", color: "#fff" }
                            : { background: "rgba(217,64,64,0.08)", color: "#D94040", border: "1.5px solid rgba(217,64,64,0.25)" }
                        }
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Visible section */}
                {(activeSections.length === 1 ? activeSections[0].key : activeServiceTab) === "pet" && (
                  <PetSittingSection
                    entries={editForm.petSitting}
                    onChange={(entries) => setEditForm((f) => f ? { ...f, petSitting: entries } : f)}
                  />
                )}
                {(activeSections.length === 1 ? activeSections[0].key : activeServiceTab) === "babysitter" && (
                  <BabysitterSection
                    entries={editForm.babysitter}
                    onChange={(entries) => setEditForm((f) => f ? { ...f, babysitter: entries } : f)}
                  />
                )}
                {(activeSections.length === 1 ? activeSections[0].key : activeServiceTab) === "special_needs" && (
                  <SpecialCareSection
                    entries={editForm.specialCare}
                    onChange={(entries) => setEditForm((f) => f ? { ...f, specialCare: entries } : f)}
                  />
                )}
              </div>
            )}

            <div className="flex items-center gap-4 pt-5">
              <Button variant="gold" size="md" loading={savingTrip} onClick={handleSaveTrip}>Save Changes</Button>
              {tripSaved && <span className="text-sm text-[#1A9E72] flex items-center gap-1.5"><SmallCheckIcon /> Saved</span>}
              {tripError && <span className="text-sm text-[#E74C3C]">{tripError}</span>}
            </div>
            <ADivider />
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#9A7A78]">Invite code</span>
              <span className="font-mono text-sm font-bold text-[#D94040] tracking-[0.2em]">{trip.inviteCode}</span>
              <span className="text-xs text-[#9A7A78]">· {trip.memberIds.length} member{trip.memberIds.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
        </section>

        {/* ── Accommodation ── */}
        <AccommodationSection
          tripId={tripId}
          accommodations={accommodations}
          tripStartDate={editForm.startDate}
          tripEndDate={editForm.endDate}
        />

        {/* ── Activities ── */}
        <section className={`rounded-[12px] bg-white ${calendarView ? "p-0 overflow-hidden" : "p-5"}`} style={{ border: "1px solid rgba(180,100,90,0.15)", boxShadow: "0 2px 12px rgba(120,60,50,0.06)" }}>
          <div className={`flex items-center justify-between ${calendarView ? "p-5 pb-0" : "mb-5"}`}>
            <h2 className="font-display text-base font-semibold text-[#1E0E0B]">
              Activities
              <span className="ml-2 text-xs font-sans font-normal text-[#9A7A78]">({activities.length})</span>
            </h2>
            <div className="flex items-center gap-3">
              {/* View toggle — always visible */}
              <div className="flex items-center rounded-[8px] overflow-hidden" style={{ border: "1px solid rgba(180,100,90,0.15)", background: "rgba(245,237,237,0.8)" }}>
                <button
                  onClick={() => setCalendarView(false)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${!calendarView ? "text-[#D94040]" : "text-[#9A7A78] hover:text-[#1E0E0B]"}`}
                  style={!calendarView ? { background: "rgba(217,64,64,0.1)" } : {}}
                  title="List view"
                >
                  <ListIcon />
                  <span>List</span>
                </button>
                <div className="w-px h-5" style={{ background: "rgba(180,100,90,0.15)" }} />
                <button
                  onClick={() => setCalendarView(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${calendarView ? "text-[#D94040]" : "text-[#9A7A78] hover:text-[#1E0E0B]"}`}
                  style={calendarView ? { background: "rgba(217,64,64,0.1)" } : {}}
                  title="Calendar view"
                >
                  <CalendarGridIcon />
                  <span>Calendar</span>
                </button>
              </div>
              {/* Global add button — only when no activities yet */}
              {activities.length === 0 && (
                <Button variant="gold" size="md" onClick={() => openAdd(tripStartDate)}>+ Add Activity</Button>
              )}
            </div>
          </div>

          {/* ── Calendar view ── */}
          {calendarView && activities.length > 0 && trip && (
            <div className="mt-4">
              <TripCalendarView
                activities={activities}
                trip={trip}
                tripId={tripId}
                transfers={(() => {
                  const m = new Map<string, CalTransferInfo>();
                  transfers.forEach((info, key) => {
                    m.set(key, {
                      gapMinutes:   info.gapMinutes,
                      currentMode:  info.toActivity.transferMode ?? "taxi",
                      travelOptions: info.travelOptions
                        ? info.travelOptions.map((o) => ({
                            mode:            o.mode,
                            durationMinutes: o.durationMinutes,
                            durationText:    o.durationText,
                          }))
                        : null,
                    });
                  });
                  return m;
                })()}
                onAddActivity={(dateKey, hour, minute) => openAdd(dateKey, hour, minute)}
                onEditActivity={(a) => openEdit(a)}
              />
            </div>
          )}

          {calendarView && activities.length === 0 && (
            <p className="text-sm text-[#9A7A78] text-center py-8">No activities yet.</p>
          )}

          {/* ── List view ── */}
          {!calendarView && activities.length === 0 ? (
            <p className="text-sm text-[#9A7A78] text-center py-8">No activities yet — add the first one above.</p>
          ) : !calendarView ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={(e: DragStartEvent) => {
                isDraggingRef.current = true;
                setActiveId(String(e.active.id));
              }}
              onDragEnd={handleDragEnd}
              onDragCancel={() => {
                isDraggingRef.current = false;
                setActiveId(null);
                setDisplayActivities(activities);
              }}
            >
              <SortableContext items={displayActivities.map((a) => a.id)} strategy={verticalListSortingStrategy}>
                {(() => {
                  // Sort by date first, then sortOrder within each date — guarantees
                  // same-day activities are always consecutive so day headers are unique.
                  const SPAIN = "Europe/Madrid";
                  const toKey = (a: Activity) =>
                    a.startTime.toDate().toLocaleDateString("sv-SE", { timeZone: SPAIN });
                  const ordered = [...displayActivities].sort((a, b) => {
                    const dk = toKey(a).localeCompare(toKey(b));
                    return dk !== 0 ? dk : a.sortOrder - b.sortOrder;
                  });

                  // ── Per-day helpers ──────────────────────────────────────────────────────
                  const toMins = (ts: { toDate(): Date }) => {
                    const d = ts.toDate();
                    const hRaw = d.toLocaleString("en-GB", { hour: "numeric", hour12: false, timeZone: SPAIN });
                    const mRaw = d.toLocaleString("en-GB", { minute: "numeric", timeZone: SPAIN });
                    return (hRaw === "24" ? 0 : Number(hRaw)) * 60 + Number(mRaw);
                  };
                  // Activities before 04:00 are treated as past-midnight (add 24 h) so
                  // they map correctly onto the 04:00 → 02:00 fixed timeline ruler.
                  const adjMins = (ts: { toDate(): Date }) => {
                    const raw = toMins(ts);
                    return raw < 4 * 60 ? raw + 1440 : raw;
                  };
                  // Earliest adjusted activity time per day — initial position for the bar
                  const dayFirstMinsMap = new Map<string, number>();
                  ordered.forEach((a) => {
                    if (a.category === "hotel" && a.estimatedDuration === 0) return;
                    const dk = toKey(a);
                    const am = adjMins(a.startTime);
                    if (!dayFirstMinsMap.has(dk) || am < dayFirstMinsMap.get(dk)!) {
                      dayFirstMinsMap.set(dk, am);
                    }
                  });

                  const rows: React.ReactNode[] = [];
                  let lastDateKey = "";
                  let dayNumber = 0;

                  ordered.forEach((activity, idx) => {
                    // ── Day header ──────────────────────────────────────────
                    const dateKey = activity.startTime.toDate().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
                    if (dateKey !== lastDateKey) {
                      lastDateKey = dateKey;
                      dayNumber += 1;
                      const dateLabel = activity.startTime.toDate().toLocaleDateString("en-US", {
                        weekday: "short", month: "short", day: "numeric",
                        timeZone: "Europe/Madrid",
                      });
                      const captureDateKey = dateKey; // capture for closure
                      rows.push(
                        <div
                          key={`day-${dateKey}`}
                          data-day-header-key={captureDateKey}
                          className="sticky z-10 flex items-center gap-3 -mx-5 px-5 bg-white"
                          style={{ top: 64, paddingTop: 28, paddingBottom: 28, borderBottom: "1px solid rgba(180,100,90,0.10)" }}
                        >
                          <span className="font-bold text-[#D94040] uppercase tracking-widest whitespace-nowrap" style={{ fontSize: 18 }}>
                            Day {dayNumber}
                          </span>
                          <span className="text-xs text-[#9A7A78]">{dateLabel}</span>
                          <DayProgressBar dayKey={captureDateKey} />
                          <button
                            onClick={() => openAdd(captureDateKey)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-[6px] text-xs font-semibold text-white transition-colors shrink-0"
                            style={{ background: "#D94040" }}
                          >
                            <span className="text-sm leading-none">+</span> Add
                          </button>
                        </div>
                      );
                    }

                    // ── Transfer card between consecutive activities ─────────
                    const prev = idx > 0 ? ordered[idx - 1] : null;
                    const transferKey = prev ? `${prev.id}->${activity.id}` : null;
                    const transferInfo = transferKey ? transfers.get(transferKey) : null;
                    if (prev?.category === "hotel" && activity.category !== "hotel" && activity.category !== "sleep_in_hotel") {
                      console.log(`[render] hotel->act key=${transferKey} found=${!!transferInfo} transfers.size=${transfers.size}`);
                    }

                    // ── Out-of-order detection ───────────────────────────────
                    // Red card if this activity starts before the one above it
                    // in the current display order.
                    const isOutOfOrder = !!prev &&
                      activity.startTime.toMillis() < prev.startTime.toMillis();

                    // Suppress transfer only when the CURRENT activity is the timeless hotel-morning
                    // placeholder (it has no real time so a transfer "into" it makes no sense).
                    // We DO show a transfer AFTER the hotel morning card — the guest needs to get
                    // from the hotel to the next destination.
                    const isTimeless = (a: Activity) => a.category === "hotel" && a.estimatedDuration === 0;
                    const showTransfer = !!transferInfo && !isTimeless(activity);

                    // For hotel morning cards, find the Sleep in Hotel activity on the prev day
                    let prevSleepHotel: Activity | null = null;
                    if (isHotelMorning(activity)) {
                      const thisDayKey = toKey(activity);
                      const [ty, tm, td] = thisDayKey.split("-").map(Number);
                      const prevDayKey = new Date(Date.UTC(ty, tm - 1, td - 1)).toISOString().slice(0, 10);
                      prevSleepHotel = ordered.find(
                        (a) => toKey(a) === prevDayKey && a.category === "sleep_in_hotel",
                      ) ?? null;
                    }

                    // Auto-derive linked accommodation from nights assignment
                    // sleep_in_hotel → accommodation covering that night
                    // hotel morning  → accommodation covering the PREVIOUS night
                    let linkedAccommodation: Accommodation | null = null;
                    if (activity.category === "sleep_in_hotel") {
                      linkedAccommodation = accommodations.find(
                        (a) => (a.nights ?? []).includes(dateKey)
                      ) ?? null;
                    } else if (isHotelMorning(activity)) {
                      const [ty, tm, td] = dateKey.split("-").map(Number);
                      const prevDayKey = new Date(Date.UTC(ty, tm - 1, td - 1)).toISOString().slice(0, 10);
                      linkedAccommodation = accommodations.find(
                        (a) => (a.nights ?? []).includes(prevDayKey)
                      ) ?? null;
                    }

                    const startMins = adjMins(activity.startTime);
                    rows.push(
                      <div
                        key={activity.id}
                        className="flex flex-col gap-1.5"
                        data-day-key={dateKey}
                        data-start-mins={String(startMins)}
                        data-activity-id={activity.id}
                      >
                        {showTransfer && (
                          <TransferCard info={transferInfo!} onModeChange={handleModeChange} />
                        )}
                        <SortableActivityRow
                          activity={activity}
                          tripId={tripId}
                          isOutOfOrder={isOutOfOrder}
                          prevSleepHotel={prevSleepHotel}
                          accommodations={accommodations}
                          linkedAccommodation={linkedAccommodation}
                          onEdit={() => openEdit(activity)}
                          onDelete={() => handleDeleteActivity(activity.id)}
                        />
                      </div>
                    );
                  });

                  return rows;
                })()}
              </SortableContext>

              {/* Floating card that follows the cursor during drag */}
              <DragOverlay dropAnimation={null}>
                {activeId ? (() => {
                  const a = displayActivities.find((x) => x.id === activeId);
                  if (!a) return null;
                  const cs = getAdminCardStyle(a.category);
                  return (
                    <div className="rounded-2xl overflow-hidden shadow-2xl opacity-95 cursor-grabbing" style={{ background: cs.bg, border: `1px solid ${cs.color}40` }}>
                      <div className="h-[3px]" style={{ background: cs.bar }} />
                      <div className="px-3.5 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: cs.color }}>{cs.label}</p>
                        <p className="text-sm font-semibold text-[#1E0E0B] truncate">{a.title}</p>
                        {a.estimatedDuration > 0 && (
                          <p className="text-xs tabular-nums mt-0.5" style={{ color: `${cs.color}80` }}>
                            {tsToHHMM(a.startTime)} – {tsToHHMM(a.endTime)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })() : null}
              </DragOverlay>
            </DndContext>
          ) : null}
        </section>

        {/* ── Notifications ── */}
        <NotificationComposer tripId={tripId} memberIds={trip.memberIds} activities={activities} />

        {/* ── Personal Message ── */}
        <PersonalMessageSection tripId={tripId} initialMessage={trip.personalMessage ?? ""} />

        {/* ── Additional Info ── */}
        <AdditionalInfoSection
          tripId={tripId}
          initialClimate={trip.additionalInfoClimate ?? ""}
          initialDressCode={trip.additionalInfoDressCode ?? ""}
          initialUsefulTips={trip.additionalInfoUsefulTips ?? ""}
        />

        {/* ── Trip Members ── */}
        <TripMembersSection memberIds={trip.memberIds} />
      </main>

      {activityFormOpen && (
        <ActivityForm
          tripId={tripId}
          tripStartDate={tripStartDate}
          tripEndDate={tripEndDate}
          activity={editingActivity}
          activities={editingActivity ? undefined : activities}
          nextSortOrder={activities.length}
          presetDate={addingToDate ?? undefined}
          presetStartHour={addingAtHour}
          presetStartMinute={addingAtMinute}
          prevEndHour={editingActivity ? undefined : prevEndHour}
          prevDate={editingActivity ? undefined : prevEndDate}
          accommodations={accommodations}
          onClose={closeForm}
          onSaved={closeForm}
        />
      )}
    </div>
  );
}

// ─── Day Progress Bar ─────────────────────────────────────────────────────────
// Scroll-driven progress indicator with a FIXED 04:00 → 02:00 absolute timeline.
// Hour marks appear every 2 hours below the track so the icon position literally
// maps to the clock time of the last visible activity for this day.
//
// Timeline:  04:00 (240 adj-mins)  →  02:00 next day (1560 adj-mins)
//            Total span: 1320 minutes  (22 hours)
//
// Icon thresholds:
//   sunrise  →  before 07:00 (420 adj-mins)
//   sun      →  07:00 – 21:00 (420–1260)
//   moon     →  ≥ 21:00 (1260)

const ICON_PX = 22;

function DayProgressBar({ dayKey }: { dayKey: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fillRef      = useRef<HTMLDivElement>(null);
  const iconRef      = useRef<HTMLDivElement>(null);
  const [iconType, setIconType] = useState<"sunrise" | "sun" | "moon">("sunrise");

  useEffect(() => {
    if (fillRef.current) fillRef.current.style.width = "0%";
    if (iconRef.current) iconRef.current.style.left = "0px";
    setIconType("sunrise");

    function handleScroll() {
      const els = Array.from(
        document.querySelectorAll(`[data-day-key="${dayKey}"]`)
      ) as HTMLElement[];
      if (els.length === 0) return;

      const firstDocTop   = els[0].getBoundingClientRect().top + window.scrollY;
      const lastDocBottom = els[els.length - 1].getBoundingClientRect().bottom + window.scrollY;

      const headerEl = document.querySelector(
        `[data-day-header-key="${dayKey}"]`
      ) as HTMLElement | null;
      const headerH = headerEl?.offsetHeight ?? 80;

      const dayStartScrollY = firstDocTop - 64 - headerH;
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
        const left = Math.min(Math.max(0, (pct / 100) * w - ICON_PX / 2), w - ICON_PX);
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
    <div ref={containerRef} className="flex-1 relative" style={{ height: 34, minWidth: 40 }}>
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
        width: ICON_PX, height: ICON_PX,
        color: "#D94040",
      }}>
        <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          opacity: iconType === "sunrise" ? 1 : 0, transform: iconType === "sunrise" ? "scale(1)" : "scale(0)",
          transition: iconTransition }}>
          <SunriseProgressIcon size={ICON_PX} />
        </span>
        <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          opacity: iconType === "sun" ? 1 : 0, transform: iconType === "sun" ? "scale(1)" : "scale(0)",
          transition: iconTransition }}>
          <SunProgressIcon size={ICON_PX} />
        </span>
        <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          opacity: iconType === "moon" ? 1 : 0, transform: iconType === "moon" ? "scale(1)" : "scale(0)",
          transition: iconTransition }}>
          <MoonProgressIcon size={ICON_PX} />
        </span>
      </div>
    </div>
  );
}

// ─── Progress bar icons (from user-supplied SVG files, fill="currentColor") ───

function SunriseProgressIcon({ size }: { size: number }) {
  // sunrise.svg paths — sun rising above a horizon bar
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 1a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0V2a1 1 0 0 1 1-1ZM0 13a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2H1a1 1 0 0 1-1-1ZM20 13a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2h-2a1 1 0 0 1-1-1ZM20.485 4.515a1 1 0 0 1 0 1.414l-1.414 1.414a1 1 0 0 1-1.414-1.414l1.414-1.414a1 1 0 0 1 1.414 0ZM3.515 4.515a1 1 0 0 1 1.414 0l1.414 1.414A1 1 0 1 1 4.93 7.343L3.515 5.93a1 1 0 0 1 0-1.414ZM7 21a1 1 0 0 1 1-1h8a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1ZM20 17h-2.257A6.96 6.96 0 0 0 19 13c0-3.862-3.138-7-7-7s-7 3.138-7 7c0 1.483.459 2.865 1.247 4H4a1 1 0 1 0 0 2h16a1 1 0 1 0 0-2Z" />
    </svg>
  );
}

function SunProgressIcon({ size }: { size: number }) {
  // sun.svg paths — full sun with 8 rays
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0V1a1 1 0 0 1 1-1ZM0 12a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2H1a1 1 0 0 1-1-1ZM21 11a1 1 0 1 0 0 2h2a1 1 0 1 0 0-2h-2ZM13 21a1 1 0 1 0-2 0v2a1 1 0 1 0 2 0v-2ZM6.343 17.657a1 1 0 0 1 0 1.414L4.93 20.485a1 1 0 1 1-1.414-1.414l1.414-1.414a1 1 0 0 1 1.414 0ZM20.485 3.515a1 1 0 0 1 0 1.414l-1.414 1.414a1 1 0 1 1-1.414-1.414l1.414-1.414a1 1 0 0 1 1.414 0ZM3.515 3.515a1 1 0 0 1 1.414 0l1.414 1.414A1 1 0 1 1 4.93 6.343L3.515 4.93a1 1 0 0 1 0-1.414ZM17.657 17.657a1 1 0 0 1 1.414 0l1.414 1.414a1 1 0 1 1-1.414 1.414l-1.414-1.414a1 1 0 0 1 0-1.414ZM5 12a7 7 0 1 1 14 0 7 7 0 0 1-14 0Z" />
    </svg>
  );
}

function MoonProgressIcon({ size }: { size: number }) {
  // moon.svg path — crescent moon
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 22C17.5228 22 22 17.5228 22 12C22 11.5373 21.3065 11.4608 21.0672 11.8568C19.9289 13.7406 17.8615 15 15.5 15C11.9101 15 9 12.0899 9 8.5C9 6.13845 10.2594 4.07105 12.1432 2.93276C12.5392 2.69347 12.4627 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
    </svg>
  );
}

// ─── Small components ─────────────────────────────────────────────────────────

function ListIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="8" y1="6"  x2="21" y2="6"  />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6"  x2="3.01" y2="6"  />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function CalendarGridIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function Spinner() {
  return (
    <div className="min-h-screen bg-[#F5EDED] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-[#D94040] border-t-transparent animate-spin" />
    </div>
  );
}

function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="9"  cy="5"  r="1.5"/><circle cx="15" cy="5"  r="1.5"/>
      <circle cx="9"  cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
      <circle cx="9"  cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
    </svg>
  );
}

// ─── Personal Message section ─────────────────────────────────────────────────

function PersonalMessageSection({ tripId, initialMessage }: { tripId: string; initialMessage: string }) {
  const [message, setMessage] = useState(initialMessage);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true); setSaved(false);
    try {
      await updateDoc(doc(db, COLLECTIONS.TRIPS, tripId), { personalMessage: message.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  return (
    <section className="rounded-[12px] bg-white p-5" style={{ border: "1px solid rgba(180,100,90,0.15)", boxShadow: "0 2px 12px rgba(120,60,50,0.06)" }}>
      <h2 className="font-display text-base font-semibold text-[#1E0E0B] mb-4">Personal Message</h2>
      <div className="flex flex-col gap-3">
        <textarea
          value={message}
          onChange={(e) => { setMessage(e.target.value); setSaved(false); }}
          placeholder="Write a personal note for the travellers…"
          rows={5}
          className="w-full rounded-xl px-4 py-3 text-sm resize-none outline-none"
          style={{ background: "rgba(245,237,237,0.4)", border: "1px solid rgba(180,100,90,0.22)", color: "#1E0E0B", lineHeight: 1.7 }}
        />
        <div className="flex items-center gap-3">
          <Button variant="gold" size="md" loading={saving} onClick={handleSave}>Save Message</Button>
          {saved && <span className="text-sm text-[#1A9E72] flex items-center gap-1.5"><SmallCheckIcon /> Saved</span>}
        </div>
      </div>
    </section>
  );
}

// ─── Additional Info section ──────────────────────────────────────────────────

type AdditionalInfoTab = "climate" | "dressCode" | "usefulTips";

// CSS filters for active (coral #D94040) and inactive (muted grey) states
const FILTER_ACTIVE  = "brightness(0) saturate(100%) invert(27%) sepia(76%) saturate(1800%) hue-rotate(330deg) brightness(0.95)";
const FILTER_INACTIVE = "brightness(0) saturate(0%) opacity(0.38)";

const ADDITIONAL_INFO_TABS: {
  id: AdditionalInfoTab;
  label: string;
  placeholder: string;
  field: "additionalInfoClimate" | "additionalInfoDressCode" | "additionalInfoUsefulTips";
  iconSrc: string;
}[] = [
  {
    id: "climate",
    label: "Climate",
    placeholder: "Describe the weather, temperatures, seasons…",
    field: "additionalInfoClimate",
    iconSrc: "/icons/climate.svg",
  },
  {
    id: "dressCode",
    label: "Dress Code",
    placeholder: "Suggest what to wear, style notes, formality level…",
    field: "additionalInfoDressCode",
    iconSrc: "/icons/dress-code.svg",
  },
  {
    id: "usefulTips",
    label: "Useful Tips",
    placeholder: "Share local customs, currency, language tips, safety info…",
    field: "additionalInfoUsefulTips",
    iconSrc: "/icons/tips.svg",
  },
];

function AdditionalInfoSection({
  tripId,
  initialClimate,
  initialDressCode,
  initialUsefulTips,
}: {
  tripId: string;
  initialClimate: string;
  initialDressCode: string;
  initialUsefulTips: string;
}) {
  const [activeTab, setActiveTab] = useState<AdditionalInfoTab>("climate");
  const [values, setValues] = useState({
    climate: initialClimate,
    dressCode: initialDressCode,
    usefulTips: initialUsefulTips,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const activeTabDef = ADDITIONAL_INFO_TABS.find((t) => t.id === activeTab)!;

  async function handleSave() {
    setSaving(true); setSaved(false);
    try {
      await updateDoc(doc(db, COLLECTIONS.TRIPS, tripId), {
        additionalInfoClimate:   values.climate.trim(),
        additionalInfoDressCode: values.dressCode.trim(),
        additionalInfoUsefulTips: values.usefulTips.trim(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  return (
    <section className="rounded-[12px] bg-white p-5"
      style={{ border: "1px solid rgba(180,100,90,0.15)", boxShadow: "0 2px 12px rgba(120,60,50,0.06)" }}>
      <h2 className="font-display text-base font-semibold text-[#1E0E0B] mb-4">Additional Info</h2>

      {/* Tab row */}
      <div className="flex gap-2 mb-4">
        {ADDITIONAL_INFO_TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                background: active ? "#D94040" : "rgba(245,237,237,0.6)",
                color: active ? "white" : "#7A6060",
                border: active ? "1px solid #D94040" : "1px solid rgba(180,100,90,0.2)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={tab.iconSrc} alt="" aria-hidden width={15} height={15}
                style={{ filter: active ? FILTER_ACTIVE : FILTER_INACTIVE }} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Textarea for active tab */}
      <textarea
        key={activeTab}
        value={values[activeTab as keyof typeof values]}
        onChange={(e) => {
          setValues((v) => ({ ...v, [activeTab]: e.target.value }));
          setSaved(false);
        }}
        placeholder={activeTabDef.placeholder}
        rows={5}
        className="w-full rounded-xl px-4 py-3 text-sm resize-none outline-none"
        style={{ background: "rgba(245,237,237,0.4)", border: "1px solid rgba(180,100,90,0.22)", color: "#1E0E0B", lineHeight: 1.7 }}
      />

      <div className="flex items-center gap-3 mt-3">
        <Button variant="gold" size="md" loading={saving} onClick={handleSave}>Save</Button>
        {saved && <span className="text-sm text-[#1A9E72] flex items-center gap-1.5"><SmallCheckIcon /> Saved</span>}
      </div>
    </section>
  );
}

// ─── Service entry helpers ────────────────────────────────────────────────────

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function ServiceCard({ title, onRemove, children }: { title: string; onRemove: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-3 relative"
      style={{ background: "rgba(245,237,237,0.6)", border: "1px solid rgba(180,100,90,0.18)" }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color: "#D94040" }}>{title}</span>
        <button type="button" onClick={onRemove}
          className="p-1 rounded-md transition-colors hover:bg-red-50"
          style={{ color: "#9A7A78" }} aria-label="Remove">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      {children}
    </div>
  );
}

function SField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#9A7A78" }}>{label}</span>
      {children}
    </div>
  );
}

function SInput({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors"
      style={{ background: "#fff", border: "1px solid rgba(180,100,90,0.22)", color: "#1E0E0B" }}
    />
  );
}

function AddEntryButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
      style={{ background: "rgba(217,64,64,0.08)", color: "#D94040", border: "1.5px dashed rgba(217,64,64,0.3)" }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      {label}
    </button>
  );
}

function SectionShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(217,64,64,0.15)" }}>
      <div className="px-4 py-2.5 flex items-center gap-2"
        style={{ background: "rgba(217,64,64,0.07)", borderBottom: "1px solid rgba(217,64,64,0.10)" }}>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide"
          style={{ background: "#D94040", color: "#fff" }}>{title}</span>
      </div>
      <div className="p-4 flex flex-col gap-3 bg-white">{children}</div>
    </div>
  );
}

// ─── Pet Sitting ──────────────────────────────────────────────────────────────

function PetSittingSection({ entries, onChange }: {
  entries: PetSittingEntry[];
  onChange: (e: PetSittingEntry[]) => void;
}) {
  function update(id: string, patch: Partial<PetSittingEntry>) {
    onChange(entries.map((e) => e.id === id ? { ...e, ...patch } : e));
  }
  function remove(id: string) { onChange(entries.filter((e) => e.id !== id)); }
  function add() {
    onChange([...entries, { id: newId(), type: "pet_sitter", name: "", phone: "", address: "", dayTime: "", link: "", cost: "" }]);
  }

  return (
    <SectionShell title="Pet Sitting">
      {entries.map((entry, i) => (
        <ServiceCard key={entry.id} title={`Option ${i + 1}`} onRemove={() => remove(entry.id)}>
          {/* Type toggle */}
          <div className="flex rounded-lg overflow-hidden self-start"
            style={{ border: "1px solid rgba(180,100,90,0.2)", background: "rgba(245,237,237,0.5)" }}>
            {(["hotel", "pet_sitter"] as const).map((t) => (
              <button key={t} type="button" onClick={() => update(entry.id, { type: t })}
                className="px-3 py-1.5 text-xs font-medium transition-colors"
                style={entry.type === t ? { background: "#D94040", color: "#fff" } : { color: "#9A7A78" }}>
                {t === "hotel" ? "Hotel" : "Pet Sitter"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SField label="Name"><SInput value={entry.name} onChange={(v) => update(entry.id, { name: v })} placeholder="Name" /></SField>
            <SField label="Phone"><SInput value={entry.phone} onChange={(v) => update(entry.id, { phone: v })} placeholder="+34 000 000 000" type="tel" /></SField>
          </div>
          <SField label="Address"><SInput value={entry.address} onChange={(v) => update(entry.id, { address: v })} placeholder="Address" /></SField>
          <div className="grid grid-cols-2 gap-3">
            <SField label="Day / Time"><SInput value={entry.dayTime} onChange={(v) => update(entry.id, { dayTime: v })} placeholder="e.g. Mon–Fri 9am–6pm" /></SField>
            <SField label="Cost"><SInput value={entry.cost} onChange={(v) => update(entry.id, { cost: v })} placeholder="e.g. €30/day" /></SField>
          </div>
          <SField label="Link"><SInput value={entry.link} onChange={(v) => update(entry.id, { link: v })} placeholder="https://" type="url" /></SField>
        </ServiceCard>
      ))}
      <AddEntryButton onClick={add} label="Add pet sitting option" />
    </SectionShell>
  );
}

// ─── Babysitter ───────────────────────────────────────────────────────────────

function BabysitterSection({ entries, onChange }: {
  entries: BabysitterEntry[];
  onChange: (e: BabysitterEntry[]) => void;
}) {
  function update(id: string, patch: Partial<BabysitterEntry>) {
    onChange(entries.map((e) => e.id === id ? { ...e, ...patch } : e));
  }
  function remove(id: string) { onChange(entries.filter((e) => e.id !== id)); }
  function add() {
    onChange([...entries, { id: newId(), name: "", phone: "", address: "", dayTime: "", cost: "", link: "" }]);
  }

  return (
    <SectionShell title="Babysitter">
      {entries.map((entry, i) => (
        <ServiceCard key={entry.id} title={`Nanny ${i + 1}`} onRemove={() => remove(entry.id)}>
          <div className="grid grid-cols-2 gap-3">
            <SField label="Name"><SInput value={entry.name} onChange={(v) => update(entry.id, { name: v })} placeholder="Name" /></SField>
            <SField label="Phone"><SInput value={entry.phone} onChange={(v) => update(entry.id, { phone: v })} placeholder="+34 000 000 000" type="tel" /></SField>
          </div>
          <SField label="Address"><SInput value={entry.address} onChange={(v) => update(entry.id, { address: v })} placeholder="Address" /></SField>
          <div className="grid grid-cols-2 gap-3">
            <SField label="Day / Time"><SInput value={entry.dayTime} onChange={(v) => update(entry.id, { dayTime: v })} placeholder="e.g. daily 8am–8pm" /></SField>
            <SField label="Cost"><SInput value={entry.cost} onChange={(v) => update(entry.id, { cost: v })} placeholder="e.g. €15/hr" /></SField>
          </div>
          <SField label="Link"><SInput value={entry.link} onChange={(v) => update(entry.id, { link: v })} placeholder="https://" type="url" /></SField>
        </ServiceCard>
      ))}
      <AddEntryButton onClick={add} label="Add nanny" />
    </SectionShell>
  );
}

// ─── Special Care ─────────────────────────────────────────────────────────────

function SpecialCareSection({ entries, onChange }: {
  entries: SpecialCareEntry[];
  onChange: (e: SpecialCareEntry[]) => void;
}) {
  function update(id: string, patch: Partial<SpecialCareEntry>) {
    onChange(entries.map((e) => e.id === id ? { ...e, ...patch } : e));
  }
  function remove(id: string) { onChange(entries.filter((e) => e.id !== id)); }
  function add() {
    onChange([...entries, { id: newId(), name: "", phone: "", address: "", dayTime: "", cost: "", link: "" }]);
  }

  return (
    <SectionShell title="Special Care">
      {entries.map((entry, i) => (
        <ServiceCard key={entry.id} title={`Provider ${i + 1}`} onRemove={() => remove(entry.id)}>
          <div className="grid grid-cols-2 gap-3">
            <SField label="Name"><SInput value={entry.name} onChange={(v) => update(entry.id, { name: v })} placeholder="Name" /></SField>
            <SField label="Phone"><SInput value={entry.phone} onChange={(v) => update(entry.id, { phone: v })} placeholder="+34 000 000 000" type="tel" /></SField>
          </div>
          <SField label="Address"><SInput value={entry.address} onChange={(v) => update(entry.id, { address: v })} placeholder="Address" /></SField>
          <div className="grid grid-cols-2 gap-3">
            <SField label="Day / Time"><SInput value={entry.dayTime} onChange={(v) => update(entry.id, { dayTime: v })} placeholder="e.g. 24/7" /></SField>
            <SField label="Cost"><SInput value={entry.cost} onChange={(v) => update(entry.id, { cost: v })} placeholder="e.g. €50/day" /></SField>
          </div>
          <SField label="Link"><SInput value={entry.link} onChange={(v) => update(entry.id, { link: v })} placeholder="https://" type="url" /></SField>
        </ServiceCard>
      ))}
      <AddEntryButton onClick={add} label="Add care provider" />
    </SectionShell>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function SmallCheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function BellIcon({ active }: { active: boolean }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24"
      fill={active ? "#16A34A" : "none"}
      stroke={active ? "#16A34A" : "#9CA3AF"}
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

// ─── Reminder popup ───────────────────────────────────────────────────────────

const REMINDER_OPTIONS = [
  { mins: 10,  label: "10 min" },
  { mins: 15,  label: "15 min" },
  { mins: 20,  label: "20 min" },
  { mins: 30,  label: "30 min" },
  { mins: 45,  label: "45 min" },
  { mins: 60,  label: "1 hr" },
  { mins: 90,  label: "1.5 hr" },
  { mins: 120, label: "2 hr" },
  { mins: 150, label: "2.5 hr" },
  { mins: 180, label: "3 hr" },
];

const CATEGORY_LABEL_MAP: Record<string, string> = {
  activity:      "activity",
  transfer:      "transfer",
  meal:          "dinner",
  free_time:     "free time",
  surprise:      "surprise",
  hotel:             "hotel check-in",
  sleep_in_hotel:    "accommodation",
  wellness_grooming: "wellness & grooming session",
};

function buildDefaultMessage(activity: Activity): string {
  const type = CATEGORY_LABEL_MAP[activity.category] ?? "activity";
  const where = activity.place ? ` at ${activity.place}` : "";
  return `Hey, {name}! It's time to get ready for your ${type}${where}. Enjoy!!! 🥳`;
}

function BookingLinkPopup({ activity, tripId, onClose }: {
  activity: Activity;
  tripId: string;
  onClose: () => void;
}) {
  const [value, setValue] = useState(activity.contactLink ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateDoc(
        doc(collection(db, COLLECTIONS.TRIPS, tripId, SUBCOLLECTIONS.ACTIVITIES), activity.id),
        { contactLink: value.trim() || null },
      );
      onClose();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(30,14,11,0.45)", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 flex flex-col gap-4"
        style={{ border: "1px solid rgba(26,86,219,0.2)", boxShadow: "0 20px 60px rgba(26,86,219,0.15)", animation: "fadeUp 0.22s ease both" }}
        onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-7 h-7 rounded-full" style={{ background: "rgba(26,86,219,0.1)" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1A56DB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6"/>
              </svg>
            </span>
            <span className="font-display text-sm font-semibold" style={{ color: "#1E0E0B" }}>Booking Link</span>
          </div>
          <button onClick={onClose} style={{ color: "#9A7A78" }} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Current link — clickable */}
        {activity.contactLink && (
          <a href={activity.contactLink} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium truncate transition-colors"
            style={{ background: "rgba(26,86,219,0.07)", color: "#1A56DB", border: "1px solid rgba(26,86,219,0.15)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            <span className="truncate">{activity.contactLink}</span>
          </a>
        )}

        {/* Edit field */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#9A7A78" }}>
            {activity.contactLink ? "Edit link" : "Add link"}
          </label>
          <input
            type="url"
            placeholder="https://…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{ background: "rgba(245,237,237,0.5)", border: "1px solid rgba(180,100,90,0.22)", color: "#1E0E0B" }}
            autoFocus
          />
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onClose}
            className="flex-1 py-2 rounded-xl text-sm font-medium"
            style={{ background: "rgba(0,0,0,0.05)", color: "#6B7280" }}>
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex-1 py-2 rounded-xl text-sm font-semibold transition-colors"
            style={{ background: "#1A56DB", color: "#fff", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReminderPopup({ activity, tripId, onClose }: {
  activity: Activity;
  tripId: string;
  onClose: () => void;
}) {
  const [selectedMins, setSelectedMins] = useState(
    activity.reminderEnabled ? (activity.reminderMinutesBefore || 30) : 30
  );
  const [message, setMessage] = useState(
    activity.reminderEnabled && activity.reminderMessage
      ? activity.reminderMessage
      : buildDefaultMessage(activity)
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const fireAt = Timestamp.fromMillis(
        activity.startTime.toMillis() - selectedMins * 60_000
      );
      await updateDoc(
        doc(collection(db, COLLECTIONS.TRIPS, tripId, SUBCOLLECTIONS.ACTIVITIES), activity.id),
        {
          reminderEnabled:       true,
          reminderMinutesBefore: selectedMins,
          reminderMessage:       message.trim(),
          reminderFireAt:        fireAt,
          reminderSent:          false,
        }
      );
      onClose();
    } catch (e) {
      console.error("Reminder save failed:", e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(30,14,11,0.5)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 flex flex-col gap-4"
        style={{
          border: "1px solid rgba(217,64,64,0.15)",
          boxShadow: "0 20px 60px rgba(120,60,50,0.18)",
          animation: "fadeUp 0.22s ease both",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }`}</style>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "rgba(22,163,74,0.12)" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#16A34A" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </div>
            <span className="font-display text-sm font-semibold" style={{ color: "#1E0E0B" }}>Set Reminder</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: "#9A7A78" }} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <p className="text-xs truncate" style={{ color: "#9A7A78" }}>
          {activity.title || "Activity"}{activity.place ? ` · ${activity.place}` : ""}
        </p>

        {/* Timing */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#9A7A78" }}>
            Send before activity
          </p>
          <div className="flex flex-wrap gap-1.5">
            {REMINDER_OPTIONS.map(({ mins, label }) => (
              <button
                key={mins}
                type="button"
                onClick={() => setSelectedMins(mins)}
                className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                style={
                  selectedMins === mins
                    ? { background: "#16A34A", color: "#fff" }
                    : { background: "rgba(0,0,0,0.05)", color: "#6B7280" }
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Message */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#9A7A78" }}>Message</p>
            <button
              type="button"
              onClick={() => setMessage(buildDefaultMessage(activity))}
              className="text-[10px] transition-colors"
              style={{ color: "#D94040" }}
            >
              Reset
            </button>
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="w-full rounded-xl px-3 py-2.5 text-sm resize-none outline-none"
            style={{ background: "rgba(245,237,237,0.5)", border: "1px solid rgba(180,100,90,0.22)", color: "#1E0E0B", lineHeight: 1.5 }}
          />
          <p className="text-[10px] mt-1" style={{ color: "#9A7A78" }}>
            <span className="font-mono font-semibold" style={{ color: "#D94040" }}>{"{name}"}</span> is replaced with each member&apos;s name on send.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{ background: "rgba(0,0,0,0.05)", color: "#6B7280" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 rounded-xl text-sm font-semibold transition-colors"
            style={{ background: "#16A34A", color: "#fff", opacity: saving ? 0.7 : 1 }}
          >
            {saving ? "Saving…" : "Save Reminder"}
          </button>
        </div>
      </div>
    </div>
  );
}
