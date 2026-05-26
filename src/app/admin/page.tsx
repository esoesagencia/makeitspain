"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection, doc, onSnapshot, orderBy, query,
  getDocs, deleteDoc, writeBatch, runTransaction, serverTimestamp,
  addDoc, updateDoc, deleteField,
} from "firebase/firestore";
import { db, COLLECTIONS, SUBCOLLECTIONS } from "@/lib/firebase/firestore";
import { uploadAuthorAvatar } from "@/lib/firebase/storage";
import { useAuth } from "@/hooks/useAuth";
import { TripForm } from "@/components/admin/TripForm";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatDateRange } from "@/lib/utils/time";
import { generateInviteCode } from "@/lib/utils/inviteCode";
import type { Trip, Author } from "@/types";

// ─── Number formatter ─────────────────────────────────────────────────────────

function fmtNum(n: number | undefined) {
  if (n == null) return "—";
  return `#${String(n).padStart(3, "0")}`;
}


// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const { userDoc, loading } = useAuth();

  const [trips, setTrips]             = useState<Trip[]>([]);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [deleting, setDeleting]       = useState<string | null>(null);
  const [authors, setAuthors]         = useState<Author[]>([]);
  const [authorPickerTripId, setAuthorPickerTripId] = useState<string | null>(null);
  const [authorEditTarget, setAuthorEditTarget] = useState<Author | "new" | null>(null);


  // Auth guard
  useEffect(() => {
    if (!loading && (!userDoc || userDoc.role !== "admin")) {
      router.replace("/login");
    }
  }, [loading, userDoc, router]);

  // Real-time trips listener
  useEffect(() => {
    if (!userDoc || userDoc.role !== "admin") return;
    const q = query(collection(db, COLLECTIONS.TRIPS), orderBy("createdAt", "desc"));
    return onSnapshot(
      q,
      (snap) => {
        setTrips(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Trip)));
        setTripsLoading(false);
      },
      (err) => console.warn("[Trips] snapshot error:", err.code),
    );
  }, [userDoc]);

  // Real-time authors listener
  useEffect(() => {
    if (!userDoc || userDoc.role !== "admin") return;
    const q = query(collection(db, COLLECTIONS.AUTHORS), orderBy("createdAt", "asc"));
    return onSnapshot(
      q,
      (snap) => setAuthors(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Author))),
      (err) => console.warn("[Authors] snapshot error:", err.code),
    );
  }, [userDoc]);

  // ── Duplicate ────────────────────────────────────────────────────────────────
  async function duplicateTrip(e: React.MouseEvent, trip: Trip) {
    e.stopPropagation();
    if (!userDoc) return;
    setDuplicating(trip.id);
    try {
      // 1. Reserve next trip number atomically
      const metaRef = doc(db, COLLECTIONS.META, "tripCounter");
      let nextNum = 1;
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(metaRef);
        nextNum = snap.exists() ? (snap.data().count as number) + 1 : 1;
        tx.set(metaRef, { count: nextNum });
      });

      // 2. Read source subcollections
      const [actSnap, accomSnap] = await Promise.all([
        getDocs(query(
          collection(db, COLLECTIONS.TRIPS, trip.id, SUBCOLLECTIONS.ACTIVITIES),
          orderBy("sortOrder"),
        )),
        getDocs(collection(db, COLLECTIONS.TRIPS, trip.id, SUBCOLLECTIONS.ACCOMMODATIONS)),
      ]);

      // 3. Create new trip document
      const newTripRef = doc(collection(db, COLLECTIONS.TRIPS));
      const newId = newTripRef.id;
      const { id: _id, ...tripData } = trip;
      const tripBatch = writeBatch(db);
      tripBatch.set(newTripRef, {
        ...tripData,
        tripNumber:  nextNum,
        tripName:    `${trip.tripName} (Copy)`,
        memberIds:   [userDoc.uid],
        inviteCode:  generateInviteCode(),
        status:      "draft",
        createdAt:   serverTimestamp(),
      });
      await tripBatch.commit();

      // 4. Copy activities in chunks of 400
      const actDocs = actSnap.docs;
      for (let i = 0; i < actDocs.length; i += 400) {
        const b = writeBatch(db);
        actDocs.slice(i, i + 400).forEach((d) =>
          b.set(doc(collection(db, COLLECTIONS.TRIPS, newId, SUBCOLLECTIONS.ACTIVITIES)), d.data())
        );
        await b.commit();
      }

      // 5. Copy accommodations in chunks of 400
      const accomDocs = accomSnap.docs;
      for (let i = 0; i < accomDocs.length; i += 400) {
        const b = writeBatch(db);
        accomDocs.slice(i, i + 400).forEach((d) =>
          b.set(doc(collection(db, COLLECTIONS.TRIPS, newId, SUBCOLLECTIONS.ACCOMMODATIONS)), d.data())
        );
        await b.commit();
      }

      router.push(`/admin/trip/${newId}`);
    } catch (err) {
      console.error("Duplicate failed:", err);
      alert("Failed to duplicate trip. Please try again.");
    } finally {
      setDuplicating(null);
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  async function deleteTrip(e: React.MouseEvent, trip: Trip) {
    e.stopPropagation();
    if (!confirm(`Delete "${trip.tripName}"?\n\nThis will permanently remove the plan, all activities and accommodations. This cannot be undone.`))
      return;

    setDeleting(trip.id);
    try {
      // Read subcollections
      const [actSnap, accomSnap] = await Promise.all([
        getDocs(collection(db, COLLECTIONS.TRIPS, trip.id, SUBCOLLECTIONS.ACTIVITIES)),
        getDocs(collection(db, COLLECTIONS.TRIPS, trip.id, SUBCOLLECTIONS.ACCOMMODATIONS)),
      ]);

      // Delete activities in chunks
      for (let i = 0; i < actSnap.docs.length; i += 400) {
        const b = writeBatch(db);
        actSnap.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref));
        await b.commit();
      }

      // Delete accommodations in chunks
      for (let i = 0; i < accomSnap.docs.length; i += 400) {
        const b = writeBatch(db);
        accomSnap.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref));
        await b.commit();
      }

      // Delete trip doc
      await deleteDoc(doc(db, COLLECTIONS.TRIPS, trip.id));
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete trip. Please try again.");
    } finally {
      setDeleting(null);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────

  if (loading || !userDoc) {
    return (
      <div className="min-h-screen bg-[#F5EDED] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#D94040] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (userDoc.role !== "admin") return null;

  return (
    <div className="min-h-screen bg-[#F5EDED]">
      {/* Header */}
      <header className="sticky top-0 z-20" style={{ background: "#D94040", boxShadow: "0 2px 12px rgba(217,64,64,0.3)" }}>
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <h1 className="font-display text-xl font-semibold" style={{ color: "#fff" }}>MakeItSpain Admin</h1>
          <Button variant="gold" size="md" onClick={() => setShowCreateForm(true)}
            className="!bg-[#c1f8cd] !text-[#D94040] hover:!bg-[#a8f0b8]">
            + Create Trip
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {tripsLoading ? (
          <TripTableSkeleton />
        ) : trips.length === 0 ? (
          <EmptyState onCreateClick={() => setShowCreateForm(true)} />
        ) : (
          <div className="rounded-[12px] bg-white overflow-hidden" style={{ border: "1px solid rgba(180,100,90,0.15)", boxShadow: "0 2px 12px rgba(120,60,50,0.06)" }}>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(180,100,90,0.1)", background: "rgba(180,100,90,0.03)" }}>
                  <Th>#</Th>
                  <Th>Trip</Th>
                  <Th>Client</Th>
                  <Th>Destination</Th>
                  <Th>Dates</Th>
                  <Th>Status</Th>
                  <Th>Author</Th>
                  <Th align="right">Members</Th>
                  <Th align="right"> </Th>
                </tr>
              </thead>
              <tbody>
                {trips.map((trip, i) => {
                  const isBusy = duplicating === trip.id || deleting === trip.id;
                  return (
                    <tr
                      key={trip.id}
                      onClick={() => !isBusy && router.push(`/admin/trip/${trip.id}`)}
                      className="cursor-pointer transition-colors group"
                      style={i !== trips.length - 1 ? { borderBottom: "1px solid rgba(180,100,90,0.08)" } : {}}
                      onMouseEnter={(e) => (e.currentTarget as HTMLTableRowElement).style.background = "rgba(217,64,64,0.03)"}
                      onMouseLeave={(e) => (e.currentTarget as HTMLTableRowElement).style.background = ""}
                    >
                      {/* Number */}
                      <td className="px-5 py-4 w-14">
                        <span className="text-[11px] font-bold tabular-nums tracking-wider"
                          style={{ color: trip.tripNumber ? "#D94040" : "#C4AAA8" }}>
                          {fmtNum(trip.tripNumber)}
                        </span>
                      </td>

                      {/* Trip name */}
                      <td className="px-3 py-4">
                        <span className="font-display text-sm font-medium text-[#1E0E0B] group-hover:text-[#D94040] transition-colors">
                          {trip.tripName}
                        </span>
                      </td>

                      <td className="px-3 py-4 text-sm text-[#9A7A78]">{trip.clientName}</td>
                      <td className="px-3 py-4 text-sm text-[#9A7A78]">{trip.destination}</td>
                      <td className="px-3 py-4 text-sm text-[#9A7A78] whitespace-nowrap">
                        {formatDateRange(trip.startDate, trip.endDate)}
                      </td>
                      <td className="px-3 py-4">
                        <Badge status={trip.status} />
                      </td>
                      {/* Author */}
                      <td className="px-3 py-4" onClick={(e) => e.stopPropagation()}>
                        <AuthorCell
                          trip={trip}
                          authors={authors}
                          onOpenPicker={() => setAuthorPickerTripId(trip.id)}
                        />
                      </td>

                      <td className="px-3 py-4 text-sm text-[#9A7A78] text-right">
                        {trip.memberIds.length}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4 text-right w-28">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* Duplicate */}
                          <button
                            type="button"
                            title="Duplicate trip"
                            disabled={isBusy}
                            onClick={(e) => duplicateTrip(e, trip)}
                            className="flex items-center gap-1 px-2 py-1 rounded-[6px] text-[11px] font-semibold transition-colors"
                            style={{ background: "rgba(26,86,219,0.08)", color: "#1A56DB" }}
                          >
                            {duplicating === trip.id ? (
                              <span className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin inline-block" />
                            ) : (
                              <CopyIcon />
                            )}
                            Copy
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            title="Delete trip"
                            disabled={isBusy}
                            onClick={(e) => deleteTrip(e, trip)}
                            className="flex items-center gap-1 px-2 py-1 rounded-[6px] text-[11px] font-semibold transition-colors"
                            style={{ background: "rgba(231,76,60,0.08)", color: "#E74C3C" }}
                          >
                            {deleting === trip.id ? (
                              <span className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin inline-block" />
                            ) : (
                              <TrashIcon />
                            )}
                            Del
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </main>

      {showCreateForm && (
        <TripForm
          createdByUid={userDoc.uid}
          onClose={() => setShowCreateForm(false)}
          onCreated={(tripId) => {
            setShowCreateForm(false);
            router.push(`/admin/trip/${tripId}`);
          }}
        />
      )}

      {/* Author picker — assign author to a trip */}
      {authorPickerTripId && (
        <AuthorPickerPopup
          tripId={authorPickerTripId}
          authors={authors}
          currentAuthorId={trips.find((t) => t.id === authorPickerTripId)?.authorId}
          onClose={() => setAuthorPickerTripId(null)}
          onEditAuthor={(a) => setAuthorEditTarget(a)}
          onNewAuthor={() => setAuthorEditTarget("new")}
          onRemoveAuthor={async () => {
            await updateDoc(doc(db, COLLECTIONS.TRIPS, authorPickerTripId), { authorId: deleteField() });
            setAuthorPickerTripId(null);
          }}
        />
      )}

      {/* Author edit / create popup */}
      {authorEditTarget && (
        <AuthorEditPopup
          author={authorEditTarget === "new" ? null : authorEditTarget}
          onClose={() => setAuthorEditTarget(null)}
        />
      )}
    </div>
  );
}

// ─── Author components ────────────────────────────────────────────────────────

function AuthorAvatar({ author, size = 28 }: { author: Author; size?: number }) {
  if (author.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={author.avatarUrl} alt={author.name}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }} />
    );
  }
  const initials = author.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="rounded-full flex items-center justify-center shrink-0 font-semibold text-white"
      style={{ width: size, height: size, background: "#D94040", fontSize: size * 0.38 }}>
      {initials}
    </div>
  );
}

function AuthorCell({ trip, authors, onOpenPicker }: {
  trip: Trip;
  authors: Author[];
  onOpenPicker: () => void;
}) {
  const author = authors.find((a) => a.id === trip.authorId);
  if (!author) {
    return (
      <button type="button" onClick={onOpenPicker}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] transition-colors"
        style={{ background: "rgba(180,100,90,0.08)", color: "#9A7A78" }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
        </svg>
        Assign
      </button>
    );
  }
  return (
    <button type="button" onClick={onOpenPicker}
      className="flex items-center gap-1.5 max-w-[120px] rounded-lg px-1.5 py-1 transition-colors hover:bg-[rgba(180,100,90,0.07)]">
      <AuthorAvatar author={author} size={22} />
      <span className="text-xs font-medium truncate" style={{ color: "#1E0E0B" }}>{author.name}</span>
    </button>
  );
}

function AuthorPickerPopup({ tripId, authors, currentAuthorId, onClose, onEditAuthor, onNewAuthor, onRemoveAuthor }: {
  tripId: string;
  authors: Author[];
  currentAuthorId?: string;
  onClose: () => void;
  onEditAuthor: (a: Author) => void;
  onNewAuthor: () => void;
  onRemoveAuthor: () => Promise<void>;
}) {
  const [saving, setSaving] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [deletingAuthorId, setDeletingAuthorId] = useState<string | null>(null);

  async function assign(authorId: string) {
    setSaving(authorId);
    try {
      await updateDoc(doc(db, COLLECTIONS.TRIPS, tripId), { authorId });
      onClose();
    } finally { setSaving(null); }
  }

  async function handleRemove() {
    setRemoving(true);
    try { await onRemoveAuthor(); } finally { setRemoving(false); }
  }

  async function deleteAuthor(authorId: string) {
    setDeletingAuthorId(authorId);
    try {
      await deleteDoc(doc(db, COLLECTIONS.AUTHORS, authorId));
    } finally { setDeletingAuthorId(null); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(30,14,11,0.45)", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <div className="w-full max-w-xs rounded-2xl bg-white p-5 flex flex-col gap-4"
        style={{ border: "1px solid rgba(217,64,64,0.15)", boxShadow: "0 20px 60px rgba(120,60,50,0.18)", animation: "fadeUp 0.22s ease both" }}
        onClick={(e) => e.stopPropagation()}>
        <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>

        <div className="flex items-center justify-between">
          <span className="font-display text-sm font-semibold" style={{ color: "#1E0E0B" }}>Choose Author</span>
          <button onClick={onClose} style={{ color: "#9A7A78" }} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-1">
          {authors.map((a) => (
            <div key={a.id} className="flex items-center gap-2 rounded-xl px-2 py-2 group transition-colors"
              style={{ background: currentAuthorId === a.id ? "rgba(217,64,64,0.07)" : "transparent" }}>
              <button type="button" className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                onClick={() => assign(a.id)} disabled={saving === a.id}>
                <AuthorAvatar author={a} size={32} />
                <span className="text-sm font-medium truncate" style={{ color: "#1E0E0B" }}>{a.name}</span>
                {currentAuthorId === a.id && (
                  <span className="ml-auto shrink-0 text-[10px] font-semibold" style={{ color: "#D94040" }}>current</span>
                )}
                {saving === a.id && (
                  <span className="ml-auto w-3 h-3 rounded-full border border-[#D94040] border-t-transparent animate-spin shrink-0" />
                )}
              </button>
              <button type="button" title="Edit author"
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg"
                style={{ color: "#9A7A78" }}
                onClick={() => onEditAuthor(a)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button type="button" title="Delete author"
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg"
                style={{ color: "#9A7A78" }}
                disabled={deletingAuthorId === a.id}
                onClick={() => deleteAuthor(a.id)}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#E74C3C"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#9A7A78"; }}>
                {deletingAuthorId === a.id ? (
                  <span className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin inline-block" />
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                    <path d="M9 6V4h6v2"/>
                  </svg>
                )}
              </button>
            </div>
          ))}

          {authors.length === 0 && (
            <p className="text-xs text-center py-2" style={{ color: "#9A7A78" }}>No authors yet</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <button type="button" onClick={onNewAuthor}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors w-full"
            style={{ background: "rgba(217,64,64,0.07)", color: "#D94040", border: "1.5px dashed rgba(217,64,64,0.3)" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New author
          </button>

          {currentAuthorId && (
            <button type="button" onClick={handleRemove} disabled={removing}
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors w-full"
              style={{ background: "rgba(231,76,60,0.07)", color: "#E74C3C", border: "1.5px solid rgba(231,76,60,0.2)", opacity: removing ? 0.6 : 1 }}>
              {removing ? (
                <span className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin" />
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                  <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                  <line x1="17" y1="17" x2="23" y2="17"/>
                </svg>
              )}
              Remove author
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AuthorEditPopup({ author, onClose }: { author: Author | null; onClose: () => void }) {
  const [name, setName] = useState(author?.name ?? "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(author?.avatarUrl ?? null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setUploadError(null);
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    setUploadError(null);
    let hadUploadError = false;
    try {
      if (author) {
        let avatarUrl = author.avatarUrl;
        if (avatarFile) {
          try {
            avatarUrl = await uploadAuthorAvatar(author.id, avatarFile);
          } catch (err) {
            hadUploadError = true;
            setUploadError("Photo upload failed — name saved without image.");
            console.error("[AuthorEdit] upload error:", err);
          }
        }
        await updateDoc(doc(db, COLLECTIONS.AUTHORS, author.id), { name: name.trim(), avatarUrl });
      } else {
        const docRef = await addDoc(collection(db, COLLECTIONS.AUTHORS), {
          name: name.trim(), avatarUrl: null, createdAt: serverTimestamp(),
        });
        if (avatarFile) {
          try {
            const avatarUrl = await uploadAuthorAvatar(docRef.id, avatarFile);
            await updateDoc(docRef, { avatarUrl });
          } catch (err) {
            hadUploadError = true;
            setUploadError("Photo upload failed — author created without image.");
            console.error("[AuthorEdit] upload error:", err);
          }
        }
      }
      if (!hadUploadError) onClose();
    } catch (err) {
      console.error("[AuthorEdit] save error:", err);
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(30,14,11,0.5)", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <div className="w-full max-w-xs rounded-2xl bg-white p-5 flex flex-col gap-4"
        style={{ border: "1px solid rgba(217,64,64,0.15)", boxShadow: "0 20px 60px rgba(120,60,50,0.18)", animation: "fadeUp 0.22s ease both" }}
        onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between">
          <span className="font-display text-sm font-semibold" style={{ color: "#1E0E0B" }}>
            {author ? "Edit Author" : "New Author"}
          </span>
          <button onClick={onClose} style={{ color: "#9A7A78" }} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Avatar upload */}
        <div className="flex flex-col items-center gap-2">
          <button type="button" onClick={() => fileRef.current?.click()}
            className="relative group">
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarPreview} alt="" className="w-20 h-20 rounded-full object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white"
                style={{ background: "#D94040" }}>
                {name ? name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() : "?"}
              </div>
            )}
            <div className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: "rgba(0,0,0,0.35)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
          </button>
          <span className="text-[10px]" style={{ color: "#9A7A78" }}>Click to upload photo</span>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>

        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#9A7A78" }}>Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Author name"
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{ background: "rgba(245,237,237,0.5)", border: "1px solid rgba(180,100,90,0.22)", color: "#1E0E0B" }}
          />
        </div>

        {uploadError && (
          <p className="text-xs rounded-lg px-3 py-2" style={{ background: "rgba(231,76,60,0.08)", color: "#E74C3C" }}>
            {uploadError}
          </p>
        )}

        <div className="flex gap-2">
          <button type="button" onClick={onClose}
            className="flex-1 py-2 rounded-xl text-sm font-medium"
            style={{ background: "rgba(0,0,0,0.05)", color: "#6B7280" }}>
            {uploadError ? "Close" : "Cancel"}
          </button>
          {!uploadError && (
            <button type="button" onClick={handleSave} disabled={saving || !name.trim()}
              className="flex-1 py-2 rounded-xl text-sm font-semibold transition-colors"
              style={{ background: "#D94040", color: "#fff", opacity: saving || !name.trim() ? 0.6 : 1 }}>
              {saving ? "Saving…" : author ? "Save" : "Create"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Table helpers ────────────────────────────────────────────────────────────

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`px-3 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#9A7A78] text-${align} first:px-5`}>
      {children}
    </th>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function CopyIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

// ─── Skeleton / Empty ─────────────────────────────────────────────────────────

function TripTableSkeleton() {
  return (
    <div className="rounded-[12px] bg-white overflow-hidden" style={{ border: "1px solid rgba(180,100,90,0.15)" }}>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex gap-4 px-5 py-4" style={i !== 3 ? { borderBottom: "1px solid rgba(180,100,90,0.08)" } : {}}>
          <div className="h-4 w-12 rounded-full animate-pulse" style={{ background: "rgba(180,100,90,0.1)" }} />
          <div className="h-4 w-40 rounded-full animate-pulse" style={{ background: "rgba(180,100,90,0.1)" }} />
          <div className="h-4 w-28 rounded-full animate-pulse" style={{ background: "rgba(180,100,90,0.08)" }} />
          <div className="h-4 w-24 rounded-full animate-pulse" style={{ background: "rgba(180,100,90,0.08)" }} />
          <div className="h-4 w-32 rounded-full animate-pulse" style={{ background: "rgba(180,100,90,0.08)" }} />
          <div className="h-4 w-16 rounded-full animate-pulse" style={{ background: "rgba(180,100,90,0.08)" }} />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="text-center py-20">
      <p className="text-[#9A7A78] text-sm mb-4">No trips yet.</p>
      <Button variant="gold" size="md" onClick={onCreateClick}>Create your first trip</Button>
    </div>
  );
}
