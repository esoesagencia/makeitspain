"use client";

import { useState, useEffect } from "react";
import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where,
} from "firebase/firestore";
import { db, COLLECTIONS, SUBCOLLECTIONS } from "@/lib/firebase/firestore";
import { AField } from "@/components/admin/AdminPrimitives";
import { AddressAutocomplete } from "@/components/admin/AddressAutocomplete";
import { PlacesInput } from "@/components/admin/PlacesInput";
import type { Accommodation, AccommodationType } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function digitsOnly(phone: string) { return phone.replace(/\D/g, ""); }
function waLink(phone: string)     { return `https://wa.me/${digitsOnly(phone)}`; }

/** All check-in dates for a trip: startDate (inclusive) up to endDate (exclusive).
 *  Uses Date.UTC throughout to avoid local-timezone offsets shifting the date. */
function getTripNights(startDate: string, endDate: string): string[] {
  if (!startDate || !endDate) return [];
  const nights: string[] = [];
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const cur = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));
  while (cur < end) {
    nights.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return nights;
}

function fmtNightLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const checkIn  = new Date(Date.UTC(y, m - 1, d));
  const checkOut = new Date(Date.UTC(y, m - 1, d + 1));
  const fmt = (date: Date) =>
    date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${fmt(checkIn)} → ${fmt(checkOut)}`;
}

// ─── NightsPicker ─────────────────────────────────────────────────────────────

interface NightsPickerProps {
  allNights:   string[];  // all trip nights
  selected:    string[];  // currently chosen nights
  takenByOther: Map<string, string>; // dateKey → other accommodation name
  onChange:    (nights: string[]) => void;
}

function NightsPicker({ allNights, selected, takenByOther, onChange }: NightsPickerProps) {
  if (allNights.length === 0) return null;

  function toggle(night: string) {
    onChange(
      selected.includes(night)
        ? selected.filter((n) => n !== night)
        : [...selected, night],
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-[#9A7A78]">Nights</span>
      <div className="flex flex-wrap gap-1.5">
        {allNights.map((night, idx) => {
          const isSelected = selected.includes(night);
          const takenBy    = takenByOther.get(night);
          return (
            <button
              key={night}
              type="button"
              title={takenBy ? `Currently assigned to "${takenBy}" — click to move here` : undefined}
              onClick={() => toggle(night)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold border transition-all"
              style={isSelected
                ? { background: "#D94040", borderColor: "#D94040", color: "white" }
                : takenBy
                  ? { background: "rgba(180,100,90,0.06)", borderColor: "rgba(180,100,90,0.25)", color: "#9A7A78" }
                  : { background: "white", borderColor: "rgba(180,100,90,0.2)", color: "#9A7A78" }
              }
            >
              <span style={{ opacity: 0.6 }}>N{idx + 1}</span>
              <span>{fmtNightLabel(night)}</span>
              {takenBy && !isSelected && (
                <span style={{ opacity: 0.5, fontSize: 8 }}>↗</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Draft state ──────────────────────────────────────────────────────────────

interface DraftState {
  type:         AccommodationType;
  name:         string;
  address:      string;
  contactPhone: string;
  nights:       string[];
}

const inputCls =
  "w-full rounded-[8px] border px-3 h-9 text-sm text-[#1E0E0B] bg-white " +
  "placeholder:text-[#9A7A78]/60 focus:outline-none focus:ring-2 " +
  "focus:ring-[#D94040] focus:border-transparent";

// ─── AccommodationCard ────────────────────────────────────────────────────────

function AccommodationCard({
  item, tripId, allNights, takenByOther, accommodations, onDelete,
}: {
  item:           Accommodation;
  tripId:         string;
  allNights:      string[];
  takenByOther:   Map<string, string>;
  accommodations: Accommodation[];
  onDelete:       () => void;
}) {
  const [editing, setEditing]     = useState(false);
  const [draft, setDraft]         = useState<DraftState>({
    type: item.type, name: item.name, address: item.address,
    contactPhone: item.contactPhone, nights: item.nights ?? [],
  });
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState("");

  // Keep draft in sync with latest Firestore data when NOT actively editing.
  // This prevents stale nights from overwriting changes made by mutual exclusivity.
  useEffect(() => {
    if (!editing) {
      setDraft({
        type: item.type, name: item.name, address: item.address,
        contactPhone: item.contactPhone, nights: item.nights ?? [],
      });
    }
  }, [item, editing]);

  async function save() {
    if (!draft.address.trim()) { setSaveError("Address is required."); return; }
    setSaveError("");
    setSaving(true);
    try {
      const colRef = collection(db, COLLECTIONS.TRIPS, tripId, SUBCOLLECTIONS.ACCOMMODATIONS);

      // Strip nights claimed here from every other accommodation (mutual exclusivity)
      const claimed = new Set(draft.nights);
      await Promise.all(
        accommodations
          .filter((a) => a.id !== item.id)
          .filter((a) => (a.nights ?? []).some((n) => claimed.has(n)))
          .map((a) =>
            updateDoc(doc(colRef, a.id), {
              nights: (a.nights ?? []).filter((n) => !claimed.has(n)),
            })
          )
      );

      await updateDoc(doc(colRef, item.id), {
        type:         draft.type,
        name:         draft.name.trim(),
        address:      draft.address.trim(),
        contactPhone: draft.contactPhone.trim(),
        nights:       draft.nights,
      });
      setEditing(false);
    } catch (err) {
      console.error("Failed to update accommodation:", err);
      setSaveError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  const typeLabel = item.type === "hotel" ? "Hotel" : "Apartment / Villa";
  const typeIcon  = item.type === "hotel" ? "🏨" : "🏠";
  const nights    = item.nights ?? [];

  if (editing) {
    return (
      <div className="rounded-2xl overflow-hidden" style={{ background: "#FED7AA", border: "1px solid #C05A2840" }}>
        <div className="h-[3px]" style={{ background: "linear-gradient(90deg,#C05A28,#FB923C88)" }} />
        <div className="p-4 flex flex-col gap-3">
          {/* Type toggle */}
          <div className="flex gap-2">
            {(["hotel", "apartment_villa"] as AccommodationType[]).map((t) => (
              <button key={t} type="button"
                onClick={() => setDraft((d) => ({ ...d, type: t }))}
                className="flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                style={draft.type === t
                  ? { background: "#C05A28", borderColor: "#C05A28", color: "white" }
                  : { background: "rgba(255,255,255,0.5)", borderColor: "#C05A2830", color: "#9A3412" }}
              >
                {t === "hotel" ? "🏨 Hotel" : "🏠 Apartment / Villa"}
              </button>
            ))}
          </div>

          {draft.type === "hotel" && (
            <AField label="Name">
              <PlacesInput
                searchType="establishment"
                placeholder="Hotel Arts Barcelona"
                value={draft.name}
                onChange={(v) => setDraft((d) => ({ ...d, name: v }))}
                onPlaceSelected={(details) =>
                  setDraft((d) => ({
                    ...d,
                    name:    details.name,
                    address: details.address,
                  }))
                }
              />
            </AField>
          )}

          <AField label="Address">
            <AddressAutocomplete
              value={draft.address}
              onChange={(v) => setDraft((d) => ({ ...d, address: v }))}
              placeholder="Carrer de la Marina 19-21, Barcelona"
            />
          </AField>

          <AField label="Contact Phone">
            <input className={inputCls} style={{ borderColor: "rgba(180,100,90,0.2)" }}
              type="tel" placeholder="+34 932 211 000"
              value={draft.contactPhone}
              onChange={(e) => setDraft((d) => ({ ...d, contactPhone: e.target.value }))}
            />
          </AField>

          {/* Nights picker */}
          {allNights.length > 0 && (
            <NightsPicker
              allNights={allNights}
              selected={draft.nights}
              takenByOther={takenByOther}
              onChange={(n) => setDraft((d) => ({ ...d, nights: n }))}
            />
          )}

          {saveError && <p className="text-xs text-[#E74C3C] px-1">{saveError}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => { setEditing(false); setSaveError(""); }}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
              style={{ borderColor: "rgba(180,100,90,0.2)", color: "#9A7A78" }}
            >
              Cancel
            </button>
            <button type="button" onClick={save} disabled={saving}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{ background: "#C05A28", color: "white", opacity: saving ? 0.6 : 1 }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group rounded-2xl overflow-hidden" style={{ background: "#FED7AA", border: "1px solid #C05A2830", boxShadow: "0 1px 4px rgba(120,60,50,0.07)" }}>
      <div className="h-[3px]" style={{ background: "linear-gradient(90deg,#C05A28,#FB923C88)" }} />
      <div className="px-4 py-3">
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">{typeIcon}</span>
            <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#9A3412" }}>
              {typeLabel}
            </span>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button type="button" onClick={() => setEditing(true)}
              className="px-2 py-0.5 rounded text-[10px] font-semibold"
              style={{ background: "rgba(192,90,40,0.12)", color: "#9A3412" }}
            >
              Edit
            </button>
            <button type="button" onClick={onDelete}
              className="px-2 py-0.5 rounded text-[10px] font-semibold"
              style={{ background: "rgba(231,76,60,0.1)", color: "#E74C3C" }}
            >
              ×
            </button>
          </div>
        </div>

        {item.name && (
          <p className="text-sm font-semibold mt-1" style={{ color: "#1E0E0B" }}>{item.name}</p>
        )}
        {item.address && (
          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "#9A3412" }}>{item.address}</p>
        )}

        {/* Phone */}
        {item.contactPhone && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs" style={{ color: "#9A7A78" }}>{item.contactPhone}</span>
            <a href={`tel:${digitsOnly(item.contactPhone)}`}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ background: "rgba(26,86,219,0.1)", color: "#1A56DB" }}
            >📞 Call</a>
            <a href={waLink(item.contactPhone)} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ background: "rgba(37,211,102,0.12)", color: "#128C7E" }}
            >💬 WhatsApp</a>
          </div>
        )}

        {/* Assigned nights */}
        {nights.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2.5">
            {[...nights].sort().map((n) => (
              <span key={n}
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "rgba(192,90,40,0.15)", color: "#9A3412" }}
              >
                {fmtNightLabel(n)}
              </span>
            ))}
          </div>
        )}
        {nights.length === 0 && (
          <p className="text-[10px] mt-2 italic" style={{ color: "#C4AAA8" }}>No nights assigned — click Edit</p>
        )}
      </div>
    </div>
  );
}

// ─── AddForm ──────────────────────────────────────────────────────────────────

function AddForm({
  tripId, nextOrder, allNights, takenByOther, accommodations, onDone,
}: {
  tripId:         string;
  nextOrder:      number;
  allNights:      string[];
  takenByOther:   Map<string, string>;
  accommodations: Accommodation[];
  onDone:         () => void;
}) {
  const [draft, setDraft] = useState<DraftState>({
    type: "hotel", name: "", address: "", contactPhone: "", nights: [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  async function save() {
    if (!draft.address.trim()) { setError("Address is required."); return; }
    setError("");
    setSaving(true);
    try {
      const colRef = collection(db, COLLECTIONS.TRIPS, tripId, SUBCOLLECTIONS.ACCOMMODATIONS);

      // Strip nights claimed here from every existing accommodation (mutual exclusivity)
      const claimed = new Set(draft.nights);
      await Promise.all(
        accommodations
          .filter((a) => (a.nights ?? []).some((n) => claimed.has(n)))
          .map((a) =>
            updateDoc(doc(colRef, a.id), {
              nights: (a.nights ?? []).filter((n) => !claimed.has(n)),
            })
          )
      );

      const newRef = await addDoc(colRef, {
        type:         draft.type,
        name:         draft.name.trim(),
        address:      draft.address.trim(),
        contactPhone: draft.contactPhone.trim(),
        nights:       draft.nights,
        sortOrder:    nextOrder,
      });

      onDone();
    } catch (err) {
      console.error("[Accom] addDoc failed:", err);
      setError(err instanceof Error ? err.message : "Failed to save. See console.");
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(245,237,237,0.8)", border: "1px solid rgba(180,100,90,0.15)" }}>
      <div className="p-4 flex flex-col gap-3">
        {/* Type toggle */}
        <div className="flex gap-2">
          {(["hotel", "apartment_villa"] as AccommodationType[]).map((t) => (
            <button key={t} type="button"
              onClick={() => setDraft((d) => ({ ...d, type: t }))}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
              style={draft.type === t
                ? { background: "#D94040", borderColor: "#D94040", color: "white" }
                : { background: "white", borderColor: "rgba(180,100,90,0.2)", color: "#9A7A78" }}
            >
              {t === "hotel" ? "🏨 Hotel" : "🏠 Apartment / Villa"}
            </button>
          ))}
        </div>

        {draft.type === "hotel" && (
          <AField label="Name">
            <PlacesInput
              searchType="establishment"
              placeholder="Hotel Arts Barcelona"
              value={draft.name}
              onChange={(v) => setDraft((d) => ({ ...d, name: v }))}
              onPlaceSelected={(details) =>
                setDraft((d) => ({
                  ...d,
                  name:    details.name,
                  address: details.address,
                }))
              }
            />
          </AField>
        )}

        <AField label="Address">
          <AddressAutocomplete
            value={draft.address}
            onChange={(v) => setDraft((d) => ({ ...d, address: v }))}
            placeholder="Carrer de la Marina 19-21, Barcelona"
            required
          />
        </AField>

        <AField label="Contact Phone">
          <input className={inputCls} style={{ borderColor: "rgba(180,100,90,0.2)" }}
            type="tel" placeholder="+34 932 211 000"
            value={draft.contactPhone}
            onChange={(e) => setDraft((d) => ({ ...d, contactPhone: e.target.value }))}
          />
        </AField>

        {/* Nights picker */}
        {allNights.length > 0 && (
          <NightsPicker
            allNights={allNights}
            selected={draft.nights}
            takenByOther={takenByOther}
            onChange={(n) => setDraft((d) => ({ ...d, nights: n }))}
          />
        )}

        {error && <p className="text-xs text-[#E74C3C] px-1">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onDone}
            className="flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
            style={{ borderColor: "rgba(180,100,90,0.2)", color: "#9A7A78" }}
          >
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving}
            className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{ background: "#D94040", color: "white", opacity: saving ? 0.6 : 1 }}
          >
            {saving ? "Adding…" : "Add Accommodation"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main section ─────────────────────────────────────────────────────────────

interface AccommodationSectionProps {
  tripId:         string;
  tripStartDate:  string;
  tripEndDate:    string;
  accommodations: Accommodation[];
}

export function AccommodationSection({
  tripId, tripStartDate, tripEndDate, accommodations,
}: AccommodationSectionProps) {
  const [adding, setAdding] = useState(false);

  const allNights = getTripNights(tripStartDate, tripEndDate);

  // Map of dateKey → accommodation name for nights already taken by OTHER entries
  // (used in each card/form so you can see conflicts)
  function takenByOtherFor(excludeId?: string): Map<string, string> {
    const map = new Map<string, string>();
    accommodations.forEach((acc) => {
      if (acc.id === excludeId) return;
      (acc.nights ?? []).forEach((n) => {
        map.set(n, acc.name || acc.address || "another accommodation");
      });
    });
    return map;
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this accommodation?")) return;
    const actColRef = collection(db, COLLECTIONS.TRIPS, tripId, SUBCOLLECTIONS.ACTIVITIES);
    const linked = await getDocs(query(actColRef, where("linkedAccommodationId", "==", id)));
    await Promise.all(linked.docs.map((d) => deleteDoc(doc(actColRef, d.id))));
    const colRef = collection(db, COLLECTIONS.TRIPS, tripId, SUBCOLLECTIONS.ACCOMMODATIONS);
    await deleteDoc(doc(colRef, id));
  }

  return (
    <section
      className="rounded-[12px] bg-white p-5"
      style={{ border: "1px solid rgba(180,100,90,0.15)", boxShadow: "0 2px 12px rgba(120,60,50,0.06)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-base font-semibold text-[#1E0E0B]">
          Accommodation
          <span className="ml-2 text-xs font-sans font-normal text-[#9A7A78]">
            ({accommodations.length})
          </span>
        </h2>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-[6px] text-xs font-semibold text-[#D94040] shrink-0"
            style={{ border: "1px solid rgba(217,64,64,0.25)" }}
          >
            <span className="text-sm leading-none">+</span> Add
          </button>
        )}
      </div>

      {accommodations.length === 0 && !adding && (
        <p className="text-sm text-[#9A7A78] text-center py-4">
          No accommodation added yet — click + Add to get started.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {accommodations.map((item) => (
          <AccommodationCard
            key={item.id}
            item={item}
            tripId={tripId}
            allNights={allNights}
            takenByOther={takenByOtherFor(item.id)}
            accommodations={accommodations}
            onDelete={() => handleDelete(item.id)}
          />
        ))}
        {adding && (
          <AddForm
            tripId={tripId}
            nextOrder={accommodations.length}
            allNights={allNights}
            takenByOther={takenByOtherFor()}
            accommodations={accommodations}
            onDone={() => setAdding(false)}
          />
        )}
      </div>
    </section>
  );
}
