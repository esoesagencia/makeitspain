"use client";

import { useState, useEffect, FormEvent } from "react";
import { Timestamp, collection, addDoc, doc, updateDoc } from "firebase/firestore";
import { db, COLLECTIONS, SUBCOLLECTIONS } from "@/lib/firebase/firestore";
import { parseMadridDateTime, parseMadridDate } from "@/lib/utils/adminDatetime";
import { Button } from "@/components/ui/Button";
import { AField, ATextarea, ASelect, AToggle, ADivider } from "@/components/admin/AdminPrimitives";
import { PlacesInput } from "@/components/admin/PlacesInput";
import { TripDayPicker } from "@/components/admin/TripDayPicker";
import { TimeDrumPicker } from "@/components/admin/DrumRollPicker";
import { RangeSlider, formatDurationMins, formatReminderMins } from "@/components/admin/RangeSlider";
import type { Activity, ActivityCategory, Accommodation } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toHHMM(h: number, m: number) {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parseHHMM(t: string): [number, number] {
  const [h, m] = t.split(":").map(Number);
  return [h ?? 0, m ?? 0];
}

function tsToHour(ts: { toDate(): Date }): number {
  const d = ts.toDate();
  return d.toLocaleString("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/Madrid" }) === "24"
    ? 0
    : Number(d.toLocaleString("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/Madrid" }));
}

function tsToMinute(ts: { toDate(): Date }): number {
  return Number(ts.toDate().toLocaleString("en-GB", { minute: "numeric", timeZone: "Europe/Madrid" }));
}

function tsToDateISO(ts: { toDate(): Date }): string {
  return ts.toDate().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
}

// Round minute down to nearest 5
function roundMin(m: number): number { return Math.floor(m / 5) * 5; }

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  title: string;
  place: string;
  address: string;
  description: string;
  date: string;
  startHour: number;
  startMinute: number;
  durationMinutes: number;
  category: ActivityCategory;
  isSurprise: boolean;
  surpriseDescription: string;
  surpriseContactName: string;
  surpriseContactPhone: string;
  surpriseLink: string;
  surpriseOrganizerOnly: boolean;
  isBooked: boolean;
  contactPhone: string;
  contactLink: string;
  coordinatorNote: string;
  reminderEnabled: boolean;
  reminderMinutesBefore: number;
  reminderMessage: string;
}

function makeEmpty(defaultDate: string, category: ActivityCategory = "activity"): FormState {
  return {
    title: category === "sleep_in_hotel" ? "Sleep in Hotel / Accommodation" : "",
    place: "", address: "", description: "", date: defaultDate,
    startHour: 9, startMinute: 0, durationMinutes: 60,
    category: "activity",
    isSurprise: false,
    surpriseDescription: "", surpriseContactName: "", surpriseContactPhone: "", surpriseLink: "", surpriseOrganizerOnly: true,
    isBooked: false, contactPhone: "", contactLink: "", coordinatorNote: "",
    reminderEnabled: false, reminderMinutesBefore: 30, reminderMessage: "",
  };
}

function activityToForm(a: Activity): FormState {
  return {
    title:               a.title,
    place:               a.place ?? "",
    address:             a.address,
    description:         a.description,
    date:                tsToDateISO(a.startTime),
    startHour:           tsToHour(a.startTime),
    startMinute:         roundMin(tsToMinute(a.startTime)),
    durationMinutes:     a.estimatedDuration,
    category:            a.category,
    isSurprise:            a.isSurprise,
    surpriseDescription:   a.surpriseDescription ?? "",
    surpriseContactName:   a.surpriseContactName ?? "",
    surpriseContactPhone:  a.surpriseContactPhone ?? "",
    surpriseLink:          a.surpriseLink ?? "",
    surpriseOrganizerOnly: a.surpriseOrganizerOnly ?? true,
    isBooked:            a.isBooked ?? false,
    contactPhone:        a.contactPhone ?? "",
    contactLink:         a.contactLink ?? "",
    coordinatorNote:     a.coordinatorNote ?? "",
    reminderEnabled:     a.reminderEnabled ?? false,
    reminderMinutesBefore: a.reminderMinutesBefore ?? 30,
    reminderMessage:     a.reminderMessage ?? "",
  };
}

// ─── Smart next-day logic ─────────────────────────────────────────────────────

function smartNextDate(prevEndHour: number | undefined, tripStartDate: string, prevDate: string): string {
  if (prevEndHour === undefined) return tripStartDate;
  if (prevEndHour >= 20) {
    // Use UTC arithmetic so local-timezone offset doesn't shift the date.
    const [y, m, d] = prevDate.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  }
  return prevDate;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ActivityFormProps {
  tripId: string;
  tripStartDate: string;
  tripEndDate: string;
  activity?: Activity | null;
  /** Full activities list — used to compute correct insert position for new activities */
  activities?: Activity[];
  nextSortOrder: number;
  /** When set, the form is locked to this date and the day picker is hidden */
  presetDate?: string;
  /** Pre-fill start time (from calendar view click) */
  presetStartHour?: number;
  presetStartMinute?: number;
  prevEndHour?: number;
  prevDate?: string;
  /** Available accommodations for sleep_in_hotel auto-fill */
  accommodations?: Accommodation[];
  onClose: () => void;
  onSaved: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ActivityForm({
  tripId, tripStartDate, tripEndDate, activity, activities, nextSortOrder,
  presetDate, presetStartHour, presetStartMinute, prevEndHour, prevDate,
  accommodations = [], onClose, onSaved,
}: ActivityFormProps) {
  const isEdit = !!activity;

  const defaultDate = isEdit
    ? tsToDateISO(activity.startTime)
    : presetDate ?? smartNextDate(prevEndHour, tripStartDate, prevDate ?? tripStartDate);

  const [form, setForm] = useState<FormState>(() => {
    const base = activity ? activityToForm(activity) : makeEmpty(defaultDate);
    // Pre-fill time from calendar click
    if (!activity && presetStartHour !== undefined) base.startHour = presetStartHour;
    if (!activity && presetStartMinute !== undefined) base.startMinute = presetStartMinute;
    return base;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Auto advance date when start hour is earlier than prev end hour (past midnight)
  useEffect(() => {
    if (isEdit || prevEndHour === undefined || !prevDate) return;
    if (prevEndHour >= 20 && form.startHour < prevEndHour) {
      const d = new Date(`${tripStartDate}T00:00:00`);
      const prevD = new Date(`${prevDate}T00:00:00`);
      const next = new Date(prevD);
      next.setDate(next.getDate() + 1);
      const nextISO = next.toISOString().slice(0, 10);
      if (form.date !== nextISO && nextISO <= tripEndDate) {
        setForm((f) => ({ ...f, date: nextISO }));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.startHour]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setError("");
  }

  // Computed end time
  const endTotalMin = form.startHour * 60 + form.startMinute + form.durationMinutes;
  const endHour   = Math.floor(endTotalMin / 60) % 24;
  const endMinute = endTotalMin % 60;
  // If end overflows past midnight, it's next day
  const endDate = endTotalMin >= 1440
    ? (() => { const [y, m, d] = form.date.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10); })()
    : form.date;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.title.trim())   return setError("Activity name is required.");
    if (!form.date)           return setError("Please select a date.");
    if (form.date < tripStartDate || form.date > tripEndDate)
      return setError(`Date must be within the trip dates (${tripStartDate} – ${tripEndDate}).`);
    if (!form.address.trim()) return setError("Address is required.");

    setSaving(true);
    try {
      const startTimeStr = toHHMM(form.startHour, form.startMinute);
      const endTimeStr   = toHHMM(endHour, endMinute);

      const isSleepInHotel = form.category === "sleep_in_hotel";

      const dateTs  = parseMadridDate(form.date);
      const startTs = parseMadridDateTime(form.date, startTimeStr);
      // For sleep_in_hotel, endTime = startTime and duration = 0 (arrival time only)
      const endTs   = isSleepInHotel
        ? startTs
        : parseMadridDateTime(endDate, endTimeStr);

      // Compute reminder fire time
      let reminderFireAt: Timestamp | null = null;
      if (form.reminderEnabled && form.reminderMinutesBefore > 0) {
        const fireMs = startTs.toMillis() - form.reminderMinutesBefore * 60_000;
        reminderFireAt = Timestamp.fromMillis(fireMs);
      }

      const payload = {
        title:                 form.title.trim(),
        place:                 form.place.trim(),
        address:               form.address.trim(),
        description:           form.description.trim(),
        date:                  dateTs,
        startTime:             startTs,
        endTime:               endTs,
        estimatedDuration:     isSleepInHotel ? 0 : form.durationMinutes,
        category:              form.category,
        recommendations:       null,
        isSurprise:            form.isSurprise,
        surpriseVisibleAt:     null,
        surpriseDescription:   form.isSurprise ? form.surpriseDescription.trim() : "",
        surpriseContactName:   form.isSurprise ? form.surpriseContactName.trim() : "",
        surpriseContactPhone:  form.isSurprise ? form.surpriseContactPhone.trim() : "",
        surpriseLink:          form.isSurprise ? form.surpriseLink.trim() : "",
        surpriseOrganizerOnly: form.isSurprise ? form.surpriseOrganizerOnly : false,
        isBooked:              form.isBooked,
        contactPhone:          form.contactPhone.trim() || null,
        contactLink:           form.contactLink.trim() || null,
        coordinatorNote:       form.coordinatorNote.trim() || null,
        imageUrl:              null,
        reminderEnabled:       form.reminderEnabled,
        reminderMinutesBefore: form.reminderEnabled ? form.reminderMinutesBefore : 0,
        reminderMessage:       form.reminderEnabled ? form.reminderMessage.trim() : "",
        reminderFireAt,
        reminderSent:          false,
      };

      const colRef = collection(db, COLLECTIONS.TRIPS, tripId, SUBCOLLECTIONS.ACTIVITIES);

      if (isEdit && activity) {
        await updateDoc(doc(colRef, activity.id), payload);
      } else {
        // Compute a sortOrder that places the new activity in chronological position
        // WITHOUT shifting any existing activity. We use a fractional value that slots
        // between the two neighbours — no other Firestore document is touched, so stale
        // data in this form can never corrupt other activities' positions.
        // Drag-and-drop renormalises all sortOrders to clean integers after any reorder.
        const newStartMs = startTs.toMillis();
        let insertOrder = nextSortOrder; // default: append

        if (activities && activities.length > 0) {
          const sorted = [...activities].sort((a, b) => a.sortOrder - b.sortOrder);
          const insertIdx = sorted.findIndex((a) => a.startTime.toMillis() > newStartMs);

          if (insertIdx === 0) {
            // Before everything — go one below the first
            insertOrder = sorted[0].sortOrder - 1;
          } else if (insertIdx > 0) {
            // Slot between insertIdx-1 and insertIdx
            insertOrder = (sorted[insertIdx - 1].sortOrder + sorted[insertIdx].sortOrder) / 2;
          }
          // insertIdx === -1 means all existing activities start before the new one → append
        }

        await addDoc(colRef, {
          ...payload,
          sortOrder:        insertOrder,
          isVisited:        false,
          visitedBy:        [],
          transferMode:     "taxi",
          transferDuration: null,
        });
      }
      onSaved();
    } catch (err) {
      console.error(err);
      setError("Failed to save activity. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-2xl my-auto rounded-[12px] bg-white shadow-2xl flex flex-col max-h-[90vh]" style={{ border: "1px solid rgba(180,100,90,0.15)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0" style={{ borderBottom: "1px solid rgba(180,100,90,0.1)" }}>
          <h2 className="font-display text-lg font-semibold text-[#1E0E0B]">
            {isEdit ? "Edit Activity" : "Add Activity"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-[6px] text-[#9A7A78] hover:text-[#1E0E0B] hover:bg-[rgba(217,64,64,0.06)] transition-colors">
            <XIcon />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5">
          <div className="flex flex-col gap-5">

            {/* 1. Activity Name */}
            <AField label="Activity Name">
              <input
                className="w-full rounded-[8px] border px-3 h-9 text-sm text-[#1E0E0B] bg-white placeholder:text-[#9A7A78]/60 focus:outline-none focus:ring-2 focus:ring-[#D94040] focus:border-transparent" style={{ borderColor: 'rgba(180,100,90,0.2)' }}
                placeholder="Sunset Dinner"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                required
              />
            </AField>

            {/* 2. Place — Google Places establishment search */}
            <AField label="Place">
              <PlacesInput
                searchType="establishment"
                placeholder="Tickets Restaurant"
                value={form.place}
                onChange={(v) => set("place", v)}
                onPlaceSelected={(details) => {
                  // Auto-fill both name and address when a venue is picked
                  setForm((f) => ({
                    ...f,
                    place:   details.name,
                    address: details.address,
                  }));
                }}
              />
            </AField>

            {/* 3. Address — Google Places address search */}
            <AField label="Address">
              <PlacesInput
                searchType="address"
                placeholder="Carrer del Parlament, 164, Barcelona"
                value={form.address}
                onChange={(v) => set("address", v)}
                onPlaceSelected={(details) => {
                  set("address", details.address);
                }}
                required
              />
            </AField>

            {/* 4. Description */}
            <AField label="Description">
              <ATextarea rows={2} placeholder="A brief description…" value={form.description} onChange={(e) => set("description", e.target.value)} />
            </AField>

            {/* 5. Category */}
            <AField label="Category">
              <ASelect value={form.category} onChange={(e) => {
                const cat = e.target.value as ActivityCategory;
                set("category", cat);
                // Auto-fill title when switching to sleep_in_hotel on a blank new form
                if (!isEdit && cat === "sleep_in_hotel" && !form.title.trim()) {
                  set("title", "Sleep in Hotel / Accommodation");
                }
              }}>
                <option value="activity">Activity</option>
                <option value="sleep_in_hotel">Sleep in Hotel</option>
                <option value="hotel">Hotel / Accommodation</option>
                <option value="transfer">Transfer</option>
                <option value="meal">Meal</option>
                <option value="free_time">Free Time</option>
                <option value="wellness_grooming">Wellness &amp; Grooming</option>
                <option value="surprise">Surprise</option>
              </ASelect>
            </AField>

            {/* Accommodation picker — only for sleep_in_hotel */}
            {form.category === "sleep_in_hotel" && accommodations.length > 0 && (
              <div
                className="rounded-[10px] px-4 py-3 flex flex-col gap-2"
                style={{ background: "rgba(254,215,170,0.4)", border: "1px solid rgba(192,90,40,0.2)" }}
              >
                <p className="text-xs font-semibold text-[#9A3412] uppercase tracking-widest">Link Accommodation</p>
                <select
                  className="w-full rounded-[8px] border px-3 h-9 text-sm text-[#1E0E0B] bg-white focus:outline-none focus:ring-2 focus:ring-[#D94040] focus:border-transparent"
                  style={{ borderColor: "rgba(180,100,90,0.2)" }}
                  defaultValue=""
                  onChange={(e) => {
                    const acc = accommodations.find((a) => a.id === e.target.value);
                    if (!acc) return;
                    setForm((f) => ({
                      ...f,
                      place:        acc.name || acc.address,
                      address:      acc.address,
                      contactPhone: acc.contactPhone,
                      title: f.title || "Sleep in Hotel / Accommodation",
                    }));
                  }}
                >
                  <option value="" disabled>Select accommodation…</option>
                  {accommodations.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.type === "hotel" ? "🏨" : "🏠"}{" "}
                      {acc.name || acc.address}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-[#9A3412]/70">
                  Selecting auto-fills name, address and phone — you can still edit them below.
                </p>
              </div>
            )}

            <ADivider />

            {/* Date picker — hidden when day is pre-set from the day header button */}
            {!presetDate && !isEdit && (
              <>
                <AField label="Day">
                  <TripDayPicker
                    tripStartDate={tripStartDate}
                    tripEndDate={tripEndDate}
                    value={form.date}
                    onChange={(d) => set("date", d)}
                  />
                </AField>
                <ADivider />
              </>
            )}
            {(presetDate || isEdit) && <ADivider />}

            {/* Time pickers */}
            {form.category === "sleep_in_hotel" ? (
              /* Sleep in hotel — arrival time only */
              <div className="flex justify-center">
                <TimeDrumPicker
                  label="Arrival Time"
                  hour={form.startHour}
                  minute={form.startMinute}
                  onChange={(h, m) => { set("startHour", h); set("startMinute", m); }}
                />
              </div>
            ) : (
              <div className="flex gap-8 justify-center">
                <TimeDrumPicker
                  label="Start Time"
                  hour={form.startHour}
                  minute={form.startMinute}
                  onChange={(h, m) => { set("startHour", h); set("startMinute", m); }}
                />
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-[#9A7A78]">End Time</span>
                  <div className="flex items-center gap-1 h-[220px] rounded-[10px] border bg-[#F5EDED] px-4" style={{ borderColor: "rgba(180,100,90,0.15)" }}>
                    <span className="text-2xl font-bold text-[#9A7A78]">
                      {toHHMM(endHour, endMinute)}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#9A7A78]">auto-calculated</span>
                </div>
              </div>
            )}

            <ADivider />

            {/* Duration slider — hidden for sleep_in_hotel */}
            {form.category !== "sleep_in_hotel" && (
              <AField label="Duration">
                <RangeSlider
                  min={30} max={720} step={30}
                  value={form.durationMinutes}
                  onChange={(v) => set("durationMinutes", v)}
                  format={formatDurationMins}
                />
              </AField>
            )}

            <ADivider />

            {/* Toggles */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#1E0E0B]">Programmed & time-fixed</p>
                <p className="text-xs text-[#9A7A78] mt-0.5">Start time cannot be moved by transfer changes</p>
              </div>
              <AToggle checked={form.isBooked} onChange={(v) => set("isBooked", v)} label="Booked toggle" />
            </div>

            {/* ── Add a surprise ── */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#1E0E0B]">Add a surprise</p>
                <p className="text-xs text-[#9A7A78] mt-0.5">Attach surprise details visible to the organizer</p>
              </div>
              <AToggle checked={form.isSurprise} onChange={(v) => set("isSurprise", v)} label="Surprise toggle" />
            </div>

            {form.isSurprise && (
              <div className="flex flex-col gap-4 rounded-[10px] px-4 py-4" style={{ border: "1px solid rgba(196,119,224,0.2)", background: "rgba(196,119,224,0.04)" }}>
                <AField label="Surprise Description">
                  <ATextarea
                    rows={2}
                    placeholder="Describe what the surprise is…"
                    value={form.surpriseDescription}
                    onChange={(e) => set("surpriseDescription", e.target.value)}
                  />
                </AField>

                <div className="grid grid-cols-2 gap-3">
                  <AField label="Contact Name">
                    <input
                      className="w-full rounded-[8px] border px-3 h-9 text-sm text-[#1E0E0B] bg-white placeholder:text-[#9A7A78]/60 focus:outline-none focus:ring-2 focus:ring-[#C477E0] focus:border-transparent" style={{ borderColor: 'rgba(180,100,90,0.2)' }}
                      placeholder="Name or venue"
                      value={form.surpriseContactName}
                      onChange={(e) => set("surpriseContactName", e.target.value)}
                    />
                  </AField>
                  <AField label="Contact Phone">
                    <input
                      type="tel"
                      className="w-full rounded-[8px] border px-3 h-9 text-sm text-[#1E0E0B] bg-white placeholder:text-[#9A7A78]/60 focus:outline-none focus:ring-2 focus:ring-[#C477E0] focus:border-transparent" style={{ borderColor: 'rgba(180,100,90,0.2)' }}
                      placeholder="+34 600 000 000"
                      value={form.surpriseContactPhone}
                      onChange={(e) => set("surpriseContactPhone", e.target.value)}
                    />
                  </AField>
                </div>

                <AField label="Link / URL">
                  <input
                    type="url"
                    className="w-full rounded-[8px] border px-3 h-9 text-sm text-[#1E0E0B] bg-white placeholder:text-[#9A7A78]/60 focus:outline-none focus:ring-2 focus:ring-[#C477E0] focus:border-transparent" style={{ borderColor: 'rgba(180,100,90,0.2)' }}
                    placeholder="https://..."
                    value={form.surpriseLink}
                    onChange={(e) => set("surpriseLink", e.target.value)}
                  />
                </AField>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <p className="text-sm font-medium text-[#1E0E0B]">Only seen by trip organizer</p>
                    <p className="text-xs text-[#9A7A78] mt-0.5">Hidden from all other members of the trip</p>
                  </div>
                  <AToggle
                    checked={form.surpriseOrganizerOnly}
                    onChange={(v) => set("surpriseOrganizerOnly", v)}
                    label="Organizer only toggle"
                  />
                </div>
              </div>
            )}

            <ADivider />

            {/* Reminder */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#1E0E0B]">Send Reminder</p>
                <p className="text-xs text-[#9A7A78] mt-0.5">Push notification sent to clients before this activity</p>
              </div>
              <AToggle checked={form.reminderEnabled} onChange={(v) => set("reminderEnabled", v)} label="Reminder toggle" />
            </div>

            {form.reminderEnabled && (
              <div className="flex flex-col gap-4 rounded-[10px] px-4 py-4" style={{ border: "1px solid rgba(180,100,90,0.15)", background: "rgba(245,237,237,0.8)" }}>
                <AField label="Remind how long before">
                  <RangeSlider
                    min={5} max={180} step={5}
                    value={form.reminderMinutesBefore}
                    onChange={(v) => set("reminderMinutesBefore", v)}
                    format={formatReminderMins}
                  />
                </AField>
                <AField label="Notification Message">
                  <ATextarea
                    rows={2}
                    placeholder="Your dinner at Tickets starts soon! Head to Carrer del Parlament."
                    value={form.reminderMessage}
                    onChange={(e) => set("reminderMessage", e.target.value)}
                  />
                </AField>
              </div>
            )}

            <ADivider />

            {/* Coordinator fields */}
            <div className="grid grid-cols-2 gap-3">
              <AField label="Contact Phone">
                <input
                  type="tel"
                  className="w-full rounded-[8px] border px-3 h-9 text-sm text-[#1E0E0B] bg-white placeholder:text-[#9A7A78]/60 focus:outline-none focus:ring-2 focus:ring-[#D94040] focus:border-transparent" style={{ borderColor: 'rgba(180,100,90,0.2)' }}
                  placeholder="+34 600 000 000"
                  value={form.contactPhone}
                  onChange={(e) => set("contactPhone", e.target.value)}
                />
              </AField>
              <AField label="Booking Link">
                <input
                  type="url"
                  className="w-full rounded-[8px] border px-3 h-9 text-sm text-[#1E0E0B] bg-white placeholder:text-[#9A7A78]/60 focus:outline-none focus:ring-2 focus:ring-[#D94040] focus:border-transparent" style={{ borderColor: 'rgba(180,100,90,0.2)' }}
                  placeholder="https://…"
                  value={form.contactLink}
                  onChange={(e) => set("contactLink", e.target.value)}
                />
              </AField>
            </div>

            <AField label="Coordinator Note (internal)">
              <ATextarea rows={2} placeholder="Only visible to admin…" value={form.coordinatorNote} onChange={(e) => set("coordinatorNote", e.target.value)} />
            </AField>

            {error && <p className="text-xs text-[#E74C3C]">{error}</p>}
          </div>
        </form>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-5 pt-4 shrink-0" style={{ borderTop: "1px solid rgba(180,100,90,0.1)" }}>
          <Button type="button" variant="ghost" size="md" className="flex-1" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="gold" size="md" className="flex-1" loading={saving} onClick={handleSubmit}>
            {isEdit ? "Save Changes" : "Add Activity"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
