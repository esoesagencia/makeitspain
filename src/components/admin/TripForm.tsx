"use client";

import { useState, useEffect, FormEvent } from "react";
import { collection, doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db, COLLECTIONS } from "@/lib/firebase/firestore";
import { generateInviteCode } from "@/lib/utils/inviteCode";
import { parseMadridDate } from "@/lib/utils/adminDatetime";
import { Button } from "@/components/ui/Button";
import { AField, AInput } from "@/components/admin/AdminPrimitives";
import { DateRangePicker } from "@/components/admin/DateRangePicker";

interface TripFormProps {
  createdByUid: string;
  onClose: () => void;
  onCreated: (tripId: string) => void;
}

const EMPTY = { tripName: "", clientName: "", destination: "", startDate: "", endDate: "", numberOfPeople: "2" };

export function TripForm({ createdByUid, onClose, onCreated }: TripFormProps) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function set(field: keyof typeof EMPTY) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
      setError("");
    };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const { tripName, clientName, destination, startDate, endDate, numberOfPeople } = form;
    if (!tripName || !clientName || !destination || !startDate || !endDate) {
      setError("All fields are required.");
      return;
    }
    if (endDate < startDate) { setError("End date must be after start date."); return; }
    setSaving(true);
    try {
      // Use a transaction so tripNumber is unique even under concurrent creates.
      const metaRef  = doc(db, COLLECTIONS.META, "tripCounter");
      const tripsCol = collection(db, COLLECTIONS.TRIPS);
      const newRef   = doc(tripsCol); // pre-allocate an ID

      await runTransaction(db, async (tx) => {
        const metaSnap = await tx.get(metaRef);
        const nextNum  = metaSnap.exists() ? (metaSnap.data().count as number) + 1 : 1;
        tx.set(metaRef, { count: nextNum });
        tx.set(newRef, {
          tripNumber:     nextNum,
          tripName:       tripName.trim(),
          clientName:     clientName.trim(),
          destination:    destination.trim(),
          startDate:      parseMadridDate(startDate),
          endDate:        parseMadridDate(endDate),
          numberOfPeople: parseInt(numberOfPeople, 10) || 2,
          memberIds:      [createdByUid],
          inviteCode:     generateInviteCode(),
          status:         "draft",
          createdBy:      createdByUid,
          createdAt:      serverTimestamp(),
        });
      });
      onCreated(newRef.id);
    } catch {
      setError("Failed to create trip. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md my-auto rounded-[12px] bg-white shadow-2xl" style={{ border: "1px solid rgba(180,100,90,0.15)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: "1px solid rgba(180,100,90,0.1)" }}>
          <h2 className="font-display text-lg font-semibold text-[#1E0E0B]">Create New Trip</h2>
          <button onClick={onClose} className="p-1.5 rounded-[6px] text-[#9A7A78] hover:text-[#1E0E0B] hover:bg-[rgba(217,64,64,0.06)] transition-colors">
            <XIcon />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          <AField label="Trip Name">
            <AInput placeholder="Barcelona Summer 2025" value={form.tripName} onChange={set("tripName")} required />
          </AField>

          <div className="grid grid-cols-2 gap-3">
            <AField label="Client Name">
              <AInput placeholder="Alexandra Smith" value={form.clientName} onChange={set("clientName")} required />
            </AField>
            <AField label="Number of People">
              <AInput
                type="number" min="1" max="50" placeholder="2"
                value={form.numberOfPeople} onChange={set("numberOfPeople")}
              />
            </AField>
          </div>

          <AField label="Destination">
            <AInput placeholder="Barcelona, Spain" value={form.destination} onChange={set("destination")} required />
          </AField>

          <AField label="Trip Dates">
            <DateRangePicker
              startDate={form.startDate}
              endDate={form.endDate}
              onChange={(s, e) => { setForm((f) => ({ ...f, startDate: s, endDate: e })); setError(""); }}
            />
          </AField>

          {error && <p className="text-xs text-[#E74C3C]">{error}</p>}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="ghost" size="md" className="flex-1" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="gold" size="md" className="flex-1" loading={saving}>
              Create Trip
            </Button>
          </div>
        </form>
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
