"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { JetBrains_Mono } from "next/font/google";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth } from "@/lib/firebase/auth";
import { db, COLLECTIONS } from "@/lib/firebase/firestore";
import { useTrip } from "@/hooks/useTrip";
import { BottomNav } from "@/components/trip/BottomNav";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Avatar } from "@/components/ui/Avatar";
import type { UserDocument } from "@/types";

const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], display: "swap" });

interface MemberInfo {
  uid: string;
  displayName: string;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GroupPage() {
  const router = useRouter();
  const { tripId } = useParams<{ tripId: string }>();

  const [uid, setUid] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  // ── Auth guard ───────────────────────────────────────────────────────────
  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (!user) { router.replace("/login"); return; }
      setUid(user.uid);
      setAuthLoading(false);
    });
  }, [router]);

  // ── Trip data ────────────────────────────────────────────────────────────
  const { trip, loading: tripLoading } = useTrip(tripId);

  // ── Membership guard ─────────────────────────────────────────────────────
  useEffect(() => {
    if (tripLoading || !uid || !trip) return;
    if (!trip.memberIds.includes(uid)) router.replace("/trips");
  }, [trip, tripLoading, uid, router]);

  // ── Fetch member display names — mirror MembersModal pattern with per-member try/catch
  const memberIdsKey = trip?.memberIds.join(",") ?? "";
  useEffect(() => {
    if (!memberIdsKey || !uid) return;
    const ids = memberIdsKey.split(",").filter(Boolean);
    setMembersLoading(true);
    Promise.all(
      ids.map(async (id) => {
        try {
          const snap = await getDoc(doc(db, COLLECTIONS.USERS, id));
          const name = snap.exists()
            ? ((snap.data() as UserDocument).displayName ?? "Traveller")
            : "Traveller";
          return { uid: id, displayName: name };
        } catch {
          return { uid: id, displayName: "Traveller" };
        }
      })
    ).then((results) => {
      const organizerUid = trip?.organizerUserId ?? trip?.createdBy ?? "";
      results.sort((a, b) => {
        // Current user first
        if (a.uid === uid) return -1;
        if (b.uid === uid) return 1;
        // Organizer second
        if (a.uid === organizerUid) return -1;
        if (b.uid === organizerUid) return 1;
        return a.displayName.localeCompare(b.displayName);
      });
      setMembers(results);
    }).finally(() => setMembersLoading(false));
  }, [memberIdsKey, uid, trip?.organizerUserId, trip?.createdBy]);

  // ── Web Share API ─────────────────────────────────────────────────────────
  useEffect(() => { setCanShare(!!navigator.share); }, []);

  // ── Actions ──────────────────────────────────────────────────────────────
  async function handleCopy() {
    if (!trip) return;
    await navigator.clipboard.writeText(trip.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    if (!trip || !navigator.share) return;
    await navigator.share({
      text: `Join our trip on MakeItSpain! Open app.makeitspain.com and use code: ${trip.inviteCode}`,
    });
  }

  const loading = authLoading || tripLoading;
  const organizerUid = trip?.organizerUserId ?? trip?.createdBy ?? "";

  return (
    <>
      <div className="min-h-screen bg-[#F5EDED]" style={{ paddingBottom: "80px" }}>

        {/* ── Header ── */}
        <header className="sticky top-0 z-20 bg-[#F5EDED]/95 backdrop-blur-md border-b"
          style={{ borderColor: "rgba(217,64,64,0.10)" }}>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <button
              onClick={() => router.push(`/trip/${tripId}`)}
              className="shrink-0 p-1.5 rounded-[6px] transition-colors"
              style={{ color: "#D94040" }}
              aria-label="Back to trip"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-lg font-semibold leading-tight" style={{ color: "#D94040" }}>
                Mi Grupo
              </h1>
              {loading || !trip ? (
                <Skeleton className="h-3 w-28 mt-1" />
              ) : (
                <p className="text-xs truncate" style={{ color: "#9A7A78" }}>{trip.tripName}</p>
              )}
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <a href="https://www.makeitspain.com/" target="_blank" rel="noopener noreferrer" className="shrink-0">
              <img src="/logo.png" alt="MakeItSpain" className="h-7 w-auto" />
            </a>
          </div>
        </header>

        <main className="px-4 pt-6 max-w-lg mx-auto">

          {/* ── Participants ── */}
          <section aria-label="Trip members">
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-4"
              style={{ color: "#9A7A78" }}>
              {loading
                ? "Members"
                : `${members.length} ${members.length === 1 ? "participant" : "participants"}`}
            </p>

            <div className="bg-white rounded-2xl overflow-hidden"
              style={{ border: "1px solid rgba(217,64,64,0.10)", boxShadow: "0 2px 12px rgba(120,60,50,0.06)" }}>
              {(membersLoading || loading)
                ? Array.from({ length: trip?.memberIds.length ?? 3 }).map((_, i) => (
                    <MemberRowSkeleton key={i} last={i === (trip?.memberIds.length ?? 3) - 1} />
                  ))
                : members.map((member, idx) => (
                    <MemberRow
                      key={member.uid}
                      member={member}
                      isMe={member.uid === uid}
                      isOrganizer={member.uid === organizerUid}
                      last={idx === members.length - 1}
                    />
                  ))}
            </div>
          </section>

          {/* ── Invite code ── */}
          <section aria-label="Invite code" className="mt-8 flex flex-col items-center text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1"
              style={{ color: "#9A7A78" }}>
              Invite Code
            </p>
            <p className="text-xs mb-6" style={{ color: "#9A7A78" }}>
              Share this code with your group
            </p>

            {/* Code card */}
            <div className="w-full rounded-2xl bg-white py-8 px-4 flex flex-col items-center gap-2 mb-6"
              style={{
                border: "1px solid rgba(217,64,64,0.15)",
                boxShadow: "0 4px 20px rgba(217,64,64,0.08)",
              }}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-2" style={{ color: "#9A7A78" }}>
                your code
              </p>
              {loading || !trip ? (
                <Skeleton className="h-12 w-44 rounded-xl" />
              ) : (
                <span
                  className={jetbrainsMono.className}
                  style={{ fontSize: 36, fontWeight: 700, letterSpacing: "0.3em", color: "#D94040", lineHeight: 1 }}
                >
                  {trip.inviteCode}
                </span>
              )}
            </div>

            {/* Buttons */}
            <div className="flex w-full gap-3">
              <Button variant="outline" size="md" className="flex-1"
                onClick={handleCopy} disabled={loading || !trip}>
                {copied ? <><CheckIcon /> Copied!</> : <><CopyIcon /> Copy Code</>}
              </Button>
              {canShare && (
                <Button variant="gold" size="md" className="flex-1"
                  onClick={handleShare} disabled={loading || !trip}>
                  <ShareIcon /> Share
                </Button>
              )}
            </div>
          </section>
        </main>
      </div>

      <BottomNav tripId={tripId} currentTab="group" onTabChange={() => router.push(`/trip/${tripId}`)} />
    </>
  );
}

// ─── Member row ───────────────────────────────────────────────────────────────

function MemberRow({ member, isMe, isOrganizer, last }: {
  member: MemberInfo;
  isMe: boolean;
  isOrganizer: boolean;
  last: boolean;
}) {
  return (
    <div className="flex items-center gap-3.5 px-4 py-3.5"
      style={last ? {} : { borderBottom: "1px solid rgba(217,64,64,0.07)" }}>
      <Avatar uid={member.uid} displayName={member.displayName} size={40} />
      <span className="flex-1 text-sm font-medium leading-none" style={{ color: "#1E0E0B" }}>
        {member.displayName}
        {isMe && (
          <span className="ml-1.5 text-xs font-normal" style={{ color: "#9A7A78" }}>(you)</span>
        )}
      </span>
      {isOrganizer && <CrownBadge />}
    </div>
  );
}

function CrownBadge() {
  return (
    <>
      <style>{`
        @keyframes crown-pop {
          0%   { transform: scale(0);    opacity: 0; }
          65%  { transform: scale(1.3);  opacity: 1; }
          82%  { transform: scale(0.88); }
          100% { transform: scale(1);    opacity: 1; }
        }
        .crown-pop {
          animation: crown-pop 0.55s cubic-bezier(0.34,1.56,0.64,1) both;
        }
      `}</style>
      <div
        className="crown-pop shrink-0 flex items-center justify-center rounded-full"
        style={{ width: 30, height: 30, background: "rgba(217,64,64,0.12)" }}
        title="Organiser"
      >
        <CrownIcon />
      </div>
    </>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function MemberRowSkeleton({ last }: { last: boolean }) {
  return (
    <div className="flex items-center gap-3.5 px-4 py-3.5"
      style={last ? {} : { borderBottom: "1px solid rgba(217,64,64,0.07)" }}>
      <Skeleton className="h-10 w-10 rounded-full shrink-0" />
      <Skeleton className="h-4 w-32" />
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function CrownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#D94040" stroke="#D94040"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-label="Organiser">
      <path d="M2 20h20M5 20l-1-10 6 4 4-8 4 8 6-4-1 10H5z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}
