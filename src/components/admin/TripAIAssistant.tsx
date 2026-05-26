"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { collection, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, getDocs } from "firebase/firestore";
import { db, COLLECTIONS, SUBCOLLECTIONS } from "@/lib/firebase/firestore";
import { parseMadridDateTime, parseMadridDate } from "@/lib/utils/adminDatetime";
import { syncHotelCardsForAccommodation } from "@/lib/utils/hotelCards";
import type { Trip, Activity, Accommodation } from "@/types";
import type { AIMessage, AIOperation, AIActivityFields } from "@/app/api/ai-trip-assistant/route";
import { Timestamp } from "firebase/firestore";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  operations?: AIOperation[];
  loading?: boolean;
}

interface Props {
  trip: Trip;
  activities: Activity[];
  accommodations: Accommodation[];
  onActivitiesChanged: () => void;
}

// ─── Web Speech API types ─────────────────────────────────────────────────────

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}
interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}
interface SpeechRecognitionAlternative {
  transcript: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: Event) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildFirestoreActivity(fields: AIActivityFields, trip: Trip, sortOrder: number) {
  const dateStr = fields.date ?? trip.startDate?.toDate?.()?.toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }) ?? new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
  const startTimeStr = fields.startTime ?? "10:00";
  const endTimeStr = fields.endTime ?? fields.startTime ?? "11:00";

  const startTs = parseMadridDateTime(dateStr, startTimeStr);
  const endTs = parseMadridDateTime(dateStr, endTimeStr);

  let reminderFireAt: Timestamp | null = null;
  if (fields.reminderEnabled && fields.reminderMinutesBefore) {
    reminderFireAt = Timestamp.fromMillis(startTs.toMillis() - fields.reminderMinutesBefore * 60_000);
  }

  return {
    title: fields.title ?? "Activity",
    description: fields.description ?? "",
    date: parseMadridDate(dateStr),
    startTime: startTs,
    endTime: endTs,
    estimatedDuration: fields.estimatedDuration ?? 60,
    category: fields.category ?? "activity",
    place: fields.place ?? "",
    address: fields.address ?? "",
    recommendations: fields.recommendations ?? null,
    contactPhone: fields.contactPhone ?? null,
    contactLink: fields.contactLink ?? null,
    coordinatorNote: fields.coordinatorNote ?? null,
    isVisited: false,
    visitedBy: [],
    sortOrder,
    isSurprise: fields.isSurprise ?? false,
    surpriseVisibleAt: null,
    surpriseDescription: fields.surpriseDescription ?? "",
    surpriseContactName: fields.surpriseContactName ?? "",
    surpriseContactPhone: fields.surpriseContactPhone ?? "",
    surpriseLink: fields.surpriseLink ?? "",
    surpriseOrganizerOnly: fields.surpriseOrganizerOnly ?? true,
    imageUrl: null,
    isBooked: fields.isBooked ?? false,
    transferMode: (fields.transferMode as "taxi" | "walking" | "transit") ?? "taxi",
    transferDuration: fields.transferDuration ?? null,
    breakfastType: fields.breakfastType ?? null,
    specialBreakfastInfo: fields.specialBreakfastInfo ?? "",
    specialBreakfastContact: fields.specialBreakfastContact ?? "",
    reminderEnabled: fields.reminderEnabled ?? false,
    reminderMinutesBefore: fields.reminderMinutesBefore ?? 30,
    reminderMessage: fields.reminderMessage ?? "",
    reminderFireAt,
    reminderSent: false,
    createdAt: serverTimestamp(),
  };
}

// ─── Re-sort all activities so hotel morning is always first and hotel night is always last ──

async function resortDayActivities(tripId: string) {
  const actColl = collection(db, COLLECTIONS.TRIPS, tripId, SUBCOLLECTIONS.ACTIVITIES);
  const snap = await getDocs(actColl);

  // Group by Madrid date
  const byDate = new Map<string, { id: string; category: string; startTimeMs: number }[]>();
  snap.docs.forEach(d => {
    const data = d.data();
    const dateKey = (data.date as { toDate(): Date }).toDate()
      .toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
    const startTimeMs = (data.startTime as { toDate(): Date } | null)?.toDate?.()?.getTime?.() ?? 0;
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey)!.push({ id: d.id, category: data.category as string, startTimeMs });
  });

  let globalSort = 0;
  const sortedDates = [...byDate.keys()].sort();

  const writes: Promise<void>[] = [];
  for (const date of sortedDates) {
    const day = byDate.get(date)!;
    day.sort((a, b) => {
      // hotel morning (category: "hotel") always first
      if (a.category === "hotel" && b.category !== "hotel") return -1;
      if (b.category === "hotel" && a.category !== "hotel") return 1;
      // sleep_in_hotel always last
      if (a.category === "sleep_in_hotel" && b.category !== "sleep_in_hotel") return 1;
      if (b.category === "sleep_in_hotel" && a.category !== "sleep_in_hotel") return -1;
      // everything else by startTime
      return a.startTimeMs - b.startTimeMs;
    });
    for (const act of day) {
      globalSort += 10;
      writes.push(updateDoc(doc(actColl, act.id), { sortOrder: globalSort }));
    }
  }
  await Promise.all(writes);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TripAIAssistant({ trip, activities, accommodations, onActivitiesChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingDeletes, setPendingDeletes] = useState<{ msgId: string; ops: AIOperation[] } | null>(null);
  const [listening, setListening] = useState(false);
  const [canVoice, setCanVoice] = useState(false);
  const [interimText, setInterimText] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Check voice support
  useEffect(() => {
    setCanVoice(!!(window.SpeechRecognition || window.webkitSpeechRecognition));
  }, []);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  // ── Apply AI operations to Firestore ────────────────────────────────────────
  const applyOperations = useCallback(async (operations: AIOperation[]) => {
    if (!operations.length) return;
    const actColl = collection(db, COLLECTIONS.TRIPS, trip.id, SUBCOLLECTIONS.ACTIVITIES);
    const accomColl = collection(db, COLLECTIONS.TRIPS, trip.id, SUBCOLLECTIONS.ACCOMMODATIONS);
    const maxSort = activities.length > 0 ? Math.max(...activities.map(a => a.sortOrder ?? 0)) : 0;
    let sortCounter = maxSort;

    for (const op of operations) {
      // ── Activity operations ───────────────────────────────────────────────
      if (op.type === "add" && op.fields) {
        sortCounter += 10;
        await addDoc(actColl, buildFirestoreActivity(op.fields, trip, sortCounter));

      } else if (op.type === "update" && op.activityId && op.fields) {
        const ref = doc(db, COLLECTIONS.TRIPS, trip.id, SUBCOLLECTIONS.ACTIVITIES, op.activityId);
        const fields = op.fields;
        const updates: Record<string, unknown> = {};
        if (fields.title !== undefined) updates.title = fields.title;
        if (fields.description !== undefined) updates.description = fields.description;
        if (fields.place !== undefined) updates.place = fields.place;
        if (fields.address !== undefined) updates.address = fields.address;
        if (fields.category !== undefined) updates.category = fields.category;
        if (fields.coordinatorNote !== undefined) updates.coordinatorNote = fields.coordinatorNote;
        if (fields.recommendations !== undefined) updates.recommendations = fields.recommendations;
        if (fields.isSurprise !== undefined) updates.isSurprise = fields.isSurprise;
        if (fields.surpriseOrganizerOnly !== undefined) updates.surpriseOrganizerOnly = fields.surpriseOrganizerOnly;
        if (fields.surpriseDescription !== undefined) updates.surpriseDescription = fields.surpriseDescription;
        if (fields.isBooked !== undefined) updates.isBooked = fields.isBooked;
        if (fields.reminderEnabled !== undefined) updates.reminderEnabled = fields.reminderEnabled;
        if (fields.reminderMinutesBefore !== undefined) updates.reminderMinutesBefore = fields.reminderMinutesBefore;
        if (fields.reminderMessage !== undefined) updates.reminderMessage = fields.reminderMessage;
        if (fields.estimatedDuration !== undefined) updates.estimatedDuration = fields.estimatedDuration;
        if (fields.transferMode !== undefined) updates.transferMode = fields.transferMode;
        if (fields.transferDuration !== undefined) updates.transferDuration = fields.transferDuration;
        if (fields.contactPhone !== undefined) updates.contactPhone = fields.contactPhone;
        if (fields.contactLink !== undefined) updates.contactLink = fields.contactLink;
        if (fields.surpriseContactName !== undefined) updates.surpriseContactName = fields.surpriseContactName;
        if (fields.surpriseContactPhone !== undefined) updates.surpriseContactPhone = fields.surpriseContactPhone;
        if (fields.surpriseLink !== undefined) updates.surpriseLink = fields.surpriseLink;
        if (fields.breakfastType !== undefined) updates.breakfastType = fields.breakfastType;
        if (fields.specialBreakfastInfo !== undefined) updates.specialBreakfastInfo = fields.specialBreakfastInfo;
        if (fields.specialBreakfastContact !== undefined) updates.specialBreakfastContact = fields.specialBreakfastContact;
        const existing = activities.find(a => a.id === op.activityId);
        const dateStr = fields.date ?? existing?.date?.toDate?.()?.toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
        if (dateStr) {
          if (fields.startTime) updates.startTime = parseMadridDateTime(dateStr, fields.startTime);
          if (fields.endTime) updates.endTime = parseMadridDateTime(dateStr, fields.endTime);
          if (fields.date) updates.date = parseMadridDate(dateStr);
        }
        // Recalculate reminderFireAt when reminder settings change
        const newEnabled = fields.reminderEnabled ?? (existing?.reminderEnabled ?? false);
        const newMinutes = fields.reminderMinutesBefore ?? (existing?.reminderMinutesBefore ?? 30);
        if (fields.reminderEnabled !== undefined || fields.reminderMinutesBefore !== undefined || fields.startTime !== undefined) {
          if (newEnabled && dateStr) {
            const startStr = fields.startTime ?? existing?.startTime?.toDate?.()?.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }) ?? "10:00";
            const startTs = parseMadridDateTime(dateStr, startStr);
            updates.reminderFireAt = Timestamp.fromMillis(startTs.toMillis() - newMinutes * 60_000);
            updates.reminderSent = false;
          } else if (!newEnabled) {
            updates.reminderFireAt = null;
          }
        }
        await updateDoc(ref, updates);

      } else if (op.type === "delete" && op.activityId) {
        await deleteDoc(doc(db, COLLECTIONS.TRIPS, trip.id, SUBCOLLECTIONS.ACTIVITIES, op.activityId));

      // ── Accommodation operations ──────────────────────────────────────────
      } else if (op.type === "add_accommodation" && op.fields) {
        // Hard guard: if an accommodation already exists, redirect to update (never create duplicate)
        if (accommodations.length > 0) {
          const existing = accommodations[0];
          const ref = doc(db, COLLECTIONS.TRIPS, trip.id, SUBCOLLECTIONS.ACCOMMODATIONS, existing.id);
          const updates: Record<string, unknown> = {};
          if (op.fields.type !== undefined) updates.type = op.fields.type;
          if (op.fields.name !== undefined) updates.name = op.fields.name;
          if (op.fields.address !== undefined) updates.address = op.fields.address;
          if (op.fields.contactPhone !== undefined) updates.contactPhone = op.fields.contactPhone;
          // Never touch nights — they are set by the admin
          if (Object.keys(updates).length > 0) await updateDoc(ref, updates);
        } else {
          // No accommodation yet — calculate nights from trip dates in Madrid timezone, never trust AI-provided nights
          const toMadridDate = (ts: { toDate(): Date } | undefined) =>
            ts?.toDate?.()?.toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }) ?? "";
          const tripStartDate = toMadridDate(trip.startDate);
          const tripEndDate   = toMadridDate(trip.endDate);
          const nights: string[] = [];
          if (tripStartDate && tripEndDate) {
            const cur = new Date(tripStartDate + "T12:00:00Z"); // noon UTC avoids DST edge cases
            const end = new Date(tripEndDate   + "T12:00:00Z");
            while (cur < end) {
              nights.push(cur.toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }));
              cur.setUTCDate(cur.getUTCDate() + 1);
            }
          }
          const maxAccomSort = Math.max(...accommodations.map(a => a.sortOrder ?? 0), 0);
          const accomRef = await addDoc(accomColl, {
            type: op.fields.type ?? "hotel",
            name: op.fields.name ?? "",
            address: op.fields.address ?? "",
            contactPhone: op.fields.contactPhone ?? "",
            nights,
            sortOrder: maxAccomSort + 10,
          });
          if (nights.length > 0) {
            await syncHotelCardsForAccommodation(
              trip.id,
              { id: accomRef.id, name: op.fields.name ?? "", address: op.fields.address ?? "", nights },
              tripStartDate,
              tripEndDate,
            );
          }
        }

      } else if (op.type === "update_accommodation" && op.accommodationId && op.fields) {
        const ref = doc(db, COLLECTIONS.TRIPS, trip.id, SUBCOLLECTIONS.ACCOMMODATIONS, op.accommodationId);
        const updates: Record<string, unknown> = {};
        if (op.fields.type !== undefined) updates.type = op.fields.type;
        if (op.fields.name !== undefined) updates.name = op.fields.name;
        if (op.fields.address !== undefined) updates.address = op.fields.address;
        if (op.fields.contactPhone !== undefined) updates.contactPhone = op.fields.contactPhone;
        // NEVER allow AI to change nights — admin-set dates are locked
        await updateDoc(ref, updates);

      } else if (op.type === "delete_accommodation" && op.accommodationId) {
        await deleteDoc(doc(db, COLLECTIONS.TRIPS, trip.id, SUBCOLLECTIONS.ACCOMMODATIONS, op.accommodationId));

      // ── Trip-level field update ───────────────────────────────────────────
      } else if (op.type === "update_trip" && op.fields) {
        const tripRef = doc(db, COLLECTIONS.TRIPS, trip.id);
        const updates: Record<string, unknown> = {};
        // Core trip fields
        if (op.fields.tripName !== undefined) updates.tripName = op.fields.tripName;
        if (op.fields.clientName !== undefined) updates.clientName = op.fields.clientName;
        if (op.fields.destination !== undefined) updates.destination = op.fields.destination;
        if (op.fields.numberOfPeople !== undefined) updates.numberOfPeople = op.fields.numberOfPeople;
        if (op.fields.tripType !== undefined) updates.tripType = op.fields.tripType;
        if (op.fields.budgetFrom !== undefined) updates.budgetFrom = op.fields.budgetFrom;
        if (op.fields.budgetTo !== undefined) updates.budgetTo = op.fields.budgetTo;
        if (op.fields.budgetMode !== undefined) updates.budgetMode = op.fields.budgetMode;
        if (op.fields.specialRequirements !== undefined) updates.specialRequirements = op.fields.specialRequirements;
        // Info sections
        if (op.fields.personalMessage !== undefined) updates.personalMessage = op.fields.personalMessage;
        if (op.fields.additionalInfoClimate !== undefined) updates.additionalInfoClimate = op.fields.additionalInfoClimate;
        if (op.fields.additionalInfoDressCode !== undefined) updates.additionalInfoDressCode = op.fields.additionalInfoDressCode;
        if (op.fields.additionalInfoUsefulTips !== undefined) updates.additionalInfoUsefulTips = op.fields.additionalInfoUsefulTips;
        if (op.fields.petSitting !== undefined) {
          updates.petSitting = op.fields.petSitting.map(p => ({
            id: p.id ?? crypto.randomUUID(),
            type: p.type ?? "pet_sitter",
            name: p.name ?? "",
            phone: p.phone ?? "",
            address: p.address ?? "",
            dayTime: p.dayTime ?? "",
            link: p.link ?? "",
            cost: p.cost ?? "",
          }));
        }
        if (op.fields.babysitter !== undefined) {
          updates.babysitter = op.fields.babysitter.map(b => ({
            id: b.id ?? crypto.randomUUID(),
            name: b.name ?? "",
            phone: b.phone ?? "",
            address: b.address ?? "",
            dayTime: b.dayTime ?? "",
            cost: b.cost ?? "",
            link: b.link ?? "",
          }));
        }
        if (op.fields.specialCare !== undefined) {
          updates.specialCare = op.fields.specialCare.map(s => ({
            id: s.id ?? crypto.randomUUID(),
            name: s.name ?? "",
            phone: s.phone ?? "",
            address: s.address ?? "",
            dayTime: s.dayTime ?? "",
            cost: s.cost ?? "",
            link: s.link ?? "",
          }));
        }
        if (Object.keys(updates).length > 0) await updateDoc(tripRef, updates);
      }
    }
    // Re-sort all activities: hotel morning always first, sleep_in_hotel always last
    await resortDayActivities(trip.id);
    onActivitiesChanged();
  }, [trip, activities, accommodations, onActivitiesChanged]);

  // Confirm and apply pending delete operations
  async function handleConfirmDeletes() {
    if (!pendingDeletes) return;
    const ops = pendingDeletes.ops;
    setPendingDeletes(null);
    try {
      await applyOperations(ops);
    } catch (err) {
      console.error("Delete confirmation failed", err);
    }
  }

  // ── Direct plan execution (bypasses Gemini entirely) ────────────────────────
  function extractDirectPlan(text: string): AIOperation[] | null {
    const marker = text.indexOf("MAKEITSPAIN_PLAN:");
    if (marker === -1) return null;
    try {
      const jsonStr = text.slice(marker + "MAKEITSPAIN_PLAN:".length).trim();
      const parsed = JSON.parse(jsonStr) as { operations: AIOperation[] };
      if (!Array.isArray(parsed.operations)) return null;
      return parsed.operations;
    } catch {
      return null;
    }
  }

  // ── Send message ─────────────────────────────────────────────────────────────
  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    setPendingDeletes(null);
    setInput("");
    setInterimText("");

    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: text.trim() };
    const loadingMsg: ChatMessage = { id: "loading", role: "assistant", content: "", loading: true };
    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setLoading(true);

    // ── Direct plan execution — skip Gemini if message contains a plan JSON ──
    const directOps = extractDirectPlan(text.trim());
    if (directOps) {
      try {
        await applyOperations(directOps);
        const count = directOps.length;
        const aiMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `Plan executed directly — ${count} operation${count !== 1 ? "s" : ""} applied with no AI interpretation.`,
          operations: directOps,
        };
        setMessages(prev => prev.filter(m => m.id !== "loading").concat(aiMsg));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setMessages(prev => prev.filter(m => m.id !== "loading").concat({
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `Plan execution failed: ${msg}`,
        }));
      } finally {
        setLoading(false);
      }
      return;
    }

    const history: AIMessage[] = [...messages, userMsg]
      .filter(m => !m.loading)
      .slice(-10)
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch("/api/ai-trip-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          trip: {
            tripName: trip.tripName,
            clientName: trip.clientName,
            destination: trip.destination,
            startDate: trip.startDate?.toDate?.()?.toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }) ?? "",
            endDate: trip.endDate?.toDate?.()?.toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }) ?? "",
            numberOfPeople: trip.numberOfPeople,
            tripType: trip.tripType,
            budgetFrom: trip.budgetFrom,
            budgetTo: trip.budgetTo,
            budgetMode: trip.budgetMode,
            specialRequirements: trip.specialRequirements,
            personalMessage: trip.personalMessage,
            additionalInfoClimate: trip.additionalInfoClimate,
            additionalInfoDressCode: trip.additionalInfoDressCode,
            additionalInfoUsefulTips: trip.additionalInfoUsefulTips,
          },
          existingActivities: activities.map(a => ({
            id: a.id,
            title: a.title,
            date: a.date?.toDate?.()?.toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }) ?? "",
            startTime: a.startTime?.toDate?.()?.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }) ?? "",
            category: a.category,
            place: a.place,
            linkedAccommodationId: a.linkedAccommodationId,
          })),
          existingAccommodations: accommodations.map(a => ({
            id: a.id,
            name: a.name,
            type: a.type,
            nights: a.nights ?? [],
          })),
          careServices: {
            petSitting: trip.petSitting ?? [],
            babysitter: trip.babysitter ?? [],
            specialCare: trip.specialCare ?? [],
          },
        }),
      });

      const data = await res.json();
      const msgId = (Date.now() + 1).toString();
      const aiMsg: ChatMessage = {
        id: msgId,
        role: "assistant",
        content: data.message,
        operations: data.operations,
      };

      setMessages(prev => prev.filter(m => m.id !== "loading").concat(aiMsg));

      if (data.operations?.length) {
        const safeOps = data.operations.filter((op: AIOperation) => op.type !== "delete" && op.type !== "delete_accommodation");
        const riskyOps = data.operations.filter((op: AIOperation) => op.type === "delete" || op.type === "delete_accommodation");
        if (safeOps.length) await applyOperations(safeOps);
        if (riskyOps.length) setPendingDeletes({ msgId, ops: riskyOps });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages(prev => prev.filter(m => m.id !== "loading").concat({
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Sorry, something went wrong: ${msg}`,
      }));
    } finally {
      setLoading(false);
    }
  }

  // ── Voice ────────────────────────────────────────────────────────────────────
  function toggleVoice() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    recognitionRef.current = rec;

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";
      for (let i = 0; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      if (final) {
        setInput(prev => (prev + " " + final).trim());
        setInterimText("");
      } else {
        setInterimText(interim);
      }
    };

    rec.onerror = () => { setListening(false); setInterimText(""); };
    rec.onend = () => { setListening(false); setInterimText(""); };

    rec.start();
    setListening(true);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const opSummary = (ops: AIOperation[]) => {
    const parts = [];
    const actAdds = ops.filter(o => o.type === "add").length;
    const actUpdates = ops.filter(o => o.type === "update").length;
    const actDeletes = ops.filter(o => o.type === "delete").length;
    const accomAdds = ops.filter(o => o.type === "add_accommodation").length;
    const accomUpdates = ops.filter(o => o.type === "update_accommodation").length;
    const accomDeletes = ops.filter(o => o.type === "delete_accommodation").length;
    const tripUpdates = ops.filter(o => o.type === "update_trip").length;
    if (actAdds) parts.push(`+${actAdds} activity`);
    if (actUpdates) parts.push(`${actUpdates} updated`);
    if (actDeletes) parts.push(`${actDeletes} deleted`);
    if (accomAdds) parts.push(`+${accomAdds} accommodation`);
    if (accomUpdates) parts.push(`${accomUpdates} accommodation updated`);
    if (accomDeletes) parts.push(`${accomDeletes} accommodation deleted`);
    if (tripUpdates) parts.push("trip info updated");
    return parts.join(" · ");
  };

  return (
    <>
      {/* ── FAB ── */}
      <button
        onClick={() => setOpen(v => !v)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl font-semibold text-sm shadow-xl transition-all duration-200 active:scale-95"
        style={{ background: "#D94040", color: "white", boxShadow: "0 8px 32px rgba(217,64,64,0.4)" }}
        title="AI Trip Assistant"
      >
        <SparkleIcon />
        AI Assistant
      </button>

      {/* ── Panel ── */}
      {open && (
        <div
          className="fixed bottom-20 right-6 z-50 flex flex-col rounded-2xl overflow-hidden"
          style={{
            width: 420,
            height: 580,
            background: "white",
            border: "1px solid rgba(217,64,64,0.15)",
            boxShadow: "0 24px 80px rgba(120,60,50,0.22)",
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3.5 shrink-0" style={{ background: "#D94040" }}>
            <SparkleIcon color="white" />
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm leading-none">AI Trip Assistant</p>
              <p className="text-white/70 text-[11px] mt-0.5 truncate">{trip.tripName} · {trip.destination}</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white p-1 transition-colors" aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ background: "rgba(245,237,237,0.4)" }}>
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-8">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(217,64,64,0.1)" }}>
                  <SparkleIcon color="#D94040" size={22} />
                </div>
                <p className="text-sm font-semibold text-[#1E0E0B]">Your AI Travel Planner</p>
                <p className="text-xs text-[#9A7A78] max-w-[260px] leading-relaxed">
                  Describe the trip and I&apos;ll generate the full itinerary. You can edit, add or change anything by just asking.
                </p>
                <div className="mt-2 flex flex-col gap-2 w-full">
                  {[
                    "Generate a full 4-day itinerary for this trip",
                    "Add a surprise romantic dinner on day 2",
                    "Make day 3 more relaxed and spa-focused",
                  ].map(s => (
                    <button key={s} onClick={() => setInput(s)}
                      className="text-left px-3 py-2 rounded-xl text-xs transition-colors"
                      style={{ background: "white", border: "1px solid rgba(217,64,64,0.15)", color: "#D94040" }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed"
                  style={msg.role === "user"
                    ? { background: "#D94040", color: "white", borderBottomRightRadius: 4 }
                    : { background: "white", color: "#1E0E0B", borderBottomLeftRadius: 4, border: "1px solid rgba(217,64,64,0.1)" }
                  }
                >
                  {msg.loading ? (
                    <div className="flex items-center gap-1.5 py-0.5">
                      {[0, 150, 300].map(d => (
                        <div key={d} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "#D94040", animationDelay: `${d}ms` }} />
                      ))}
                    </div>
                  ) : (
                    <>
                      <p style={{ whiteSpace: "pre-wrap" }}>{msg.content}</p>
                      {msg.operations && msg.operations.length > 0 && (
                        <>
                          {msg.operations.some(op => op.type !== "delete" && op.type !== "delete_accommodation") && (
                            <div className="mt-2 pt-2 flex items-center gap-1.5" style={{ borderTop: "1px solid rgba(217,64,64,0.15)" }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#1A9E72" strokeWidth="2.5" strokeLinecap="round">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                              <span className="text-[10px] font-semibold" style={{ color: "#1A9E72" }}>
                                {opSummary(msg.operations.filter(op => op.type !== "delete" && op.type !== "delete_accommodation"))}
                              </span>
                            </div>
                          )}
                          {pendingDeletes?.msgId === msg.id && (
                            <div className="mt-2 pt-2 flex flex-col gap-1.5" style={{ borderTop: "1px solid rgba(217,64,64,0.15)" }}>
                              <p className="text-[10px] font-semibold" style={{ color: "#D94040" }}>
                                {pendingDeletes.ops.length} deletion{pendingDeletes.ops.length > 1 ? "s" : ""} — confirm to apply
                              </p>
                              <div className="flex gap-1.5">
                                <button
                                  onClick={handleConfirmDeletes}
                                  className="text-[10px] font-semibold px-2 py-1 rounded-lg text-white transition-opacity hover:opacity-80"
                                  style={{ background: "#D94040" }}
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setPendingDeletes(null)}
                                  className="text-[10px] font-semibold px-2 py-1 rounded-lg transition-opacity hover:opacity-70"
                                  style={{ color: "#9A7A78", background: "rgba(154,122,120,0.1)" }}
                                >
                                  Skip
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="shrink-0 px-3 py-3 border-t" style={{ borderColor: "rgba(217,64,64,0.1)" }}>
            {/* Interim voice text */}
            {interimText && (
              <p className="text-xs italic px-1 mb-1.5" style={{ color: "#9A7A78" }}>{interimText}…</p>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={listening ? "Listening…" : "Ask me anything about this trip…"}
                rows={1}
                className="flex-1 resize-none rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{
                  background: "rgba(245,237,237,0.6)",
                  border: "1.5px solid rgba(217,64,64,0.15)",
                  color: "#1E0E0B",
                  maxHeight: 100,
                }}
                onInput={e => {
                  const t = e.currentTarget;
                  t.style.height = "auto";
                  t.style.height = `${Math.min(t.scrollHeight, 100)}px`;
                }}
              />

              {/* Mic button */}
              {canVoice && (
                <button
                  onClick={toggleVoice}
                  className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all"
                  style={{
                    background: listening ? "#D94040" : "rgba(217,64,64,0.1)",
                    color: listening ? "white" : "#D94040",
                    animation: listening ? "pulse 1s infinite" : "none",
                  }}
                  title={listening ? "Stop recording" : "Voice input"}
                >
                  <MicIcon />
                </button>
              )}

              {/* Send button */}
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
                style={{ background: "#D94040", color: "white" }}
                title="Send"
              >
                <SendIcon />
              </button>
            </div>
            <p className="text-[10px] text-center mt-2" style={{ color: "#C4AAA8" }}>
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function SparkleIcon({ color = "currentColor", size = 16 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/>
      <path d="M19 15l.75 2.25L22 18l-2.25.75L19 21l-.75-2.25L16 18l2.25-.75z"/>
      <path d="M5 3l.5 1.5L7 5l-1.5.5L5 7l-.5-1.5L3 5l1.5-.5z"/>
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="2" width="6" height="11" rx="3"/>
      <path d="M19 10a7 7 0 0 1-14 0"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  );
}
