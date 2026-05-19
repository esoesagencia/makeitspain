"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth } from "@/lib/firebase/auth";
import { db, COLLECTIONS } from "@/lib/firebase/firestore";
import { useTrip } from "@/hooks/useTrip";
import { useTripActivities } from "@/hooks/useTripActivities";
import { BottomNav } from "@/components/trip/BottomNav";
import type { TripTab } from "@/components/trip/BottomNav";
import { TripPlanView } from "@/components/trip/TripPlanView";
import { InfoView } from "@/components/trip/InfoView";
import { Skeleton } from "@/components/ui/Skeleton";
import { useFCMToken } from "@/hooks/useFCMToken";
import { formatDateRange } from "@/lib/utils/time";
import type { UserDocument, Author } from "@/types";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TripPage() {
  const router = useRouter();
  const params = useParams<{ tripId: string }>();
  const tripId = params.tripId;

  const [uid, setUid] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [authLoading, setAuthLoading] = useState(true);
  const [author, setAuthor] = useState<Author | null>(null);

  useFCMToken(uid);
  const [activeTab, setActiveTab] = useState<TripTab>("plan");

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // ── Auth + pull display name ─────────────────────────────────────────────
  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) { router.replace("/login"); return; }
      setUid(user.uid);
      setAuthLoading(false);

      try {
        const snap = await getDoc(doc(db, COLLECTIONS.USERS, user.uid));
        if (snap.exists()) {
          const data = snap.data() as UserDocument;
          setDisplayName(data.displayName ?? user.displayName ?? "");
        } else {
          setDisplayName(user.displayName ?? "");
        }
      } catch {
        setDisplayName(user.displayName ?? "");
      }
    });
  }, [router]);

  const { trip, loading: tripLoading } = useTrip(tripId);
  const { activities, loading: activitiesLoading } = useTripActivities(tripId);

  // Fetch author when trip has an authorId
  useEffect(() => {
    if (!trip?.authorId) { setAuthor(null); return; }
    getDoc(doc(db, COLLECTIONS.AUTHORS, trip.authorId))
      .then((snap) => {
        if (snap.exists()) setAuthor({ id: snap.id, ...(snap.data() as Omit<Author, "id">) });
      })
      .catch(() => setAuthor(null));
  }, [trip?.authorId]);

  useEffect(() => {
    if (tripLoading || !uid || !trip) return;
    if (!trip.memberIds.includes(uid)) router.replace("/trips");
  }, [trip, tripLoading, uid, router]);

  const isOrganizer = !!uid && !!trip && trip.organizerUserId === uid;

  const visibleActivities = useMemo(() => {
    return activities.filter((a) => {
      if (!a.isSurprise) return true;
      if (a.surpriseOrganizerOnly ?? true) return isOrganizer;
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, isOrganizer]);

  const loading = authLoading || tripLoading || activitiesLoading;
  const firstName = displayName.split(" ")[0] || "";

  return (
    <>
      <div className="min-h-screen bg-[#F5EDED]" style={{ paddingBottom: "var(--bottom-nav-offset, 88px)" }}>

        {/* ── Header ── */}
        <header className="sticky top-0 z-20 bg-[#F5EDED]/95 backdrop-blur-md border-b" style={{ borderColor: "rgba(217,64,64,0.1)" }}>
          <div className="flex items-center gap-3 px-4 py-3.5 lg:px-6 lg:py-4">
            <button
              onClick={() => router.push("/trips")}
              className="shrink-0 p-1.5 rounded-lg text-[#9A7A78] hover:text-[#D94040] hover:bg-[#D94040]/08 transition-colors"
              aria-label="Back to trips"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            {loading || !trip ? (
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-5 w-40" />
              </div>
            ) : (
              <div className="flex-1 min-w-0">
                <h1 className="font-display text-lg font-semibold truncate leading-tight" style={{ color: "#D94040" }}>
                  {trip.tripName}
                </h1>
              </div>
            )}

            {/* Organizer badge */}
            {!loading && isOrganizer && (
              <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{ background: "rgba(217,64,64,0.1)", border: "1px solid rgba(217,64,64,0.2)" }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                  stroke="#D94040" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                <span className="text-[10px] font-semibold text-[#D94040] tracking-wide">Organizer</span>
              </div>
            )}

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <a href="https://www.makeitspain.com/" target="_blank" rel="noopener noreferrer" className="shrink-0">
              <img src="/logo.png" alt="MakeItSpain" className="h-7 w-auto" />
            </a>
          </div>
        </header>

        {/* ── Personalised greeting banner (hidden on Info tab) ── */}
        {!loading && trip && firstName && activeTab !== "info" && (
          <div className="lg:max-w-[1400px] lg:mx-auto">
            <WelcomeBanner
              firstName={firstName}
              tripName={trip.tripName}
              destination={trip.destination}
              dateRange={trip.startDate && trip.endDate ? formatDateRange(trip.startDate, trip.endDate) : undefined}
            />
          </div>
        )}

        {/* ── Main content ── */}
        <main className="lg:max-w-none">
          {activeTab === "plan" && (
            loading ? (
              <div className="px-4 max-w-lg mx-auto">
                <TripPlanSkeleton />
              </div>
            ) : (
              <TripPlanView
                activities={visibleActivities}
                trip={trip!}
                nowMs={nowMs}
                onTabChange={(tab) => setActiveTab(tab)}
              />
            )
          )}

          {activeTab === "info" && !loading && trip && (
            <InfoView
              firstName={firstName}
              trip={trip}
              activities={visibleActivities}
              author={author}
              nowMs={nowMs}
              tripId={tripId}
            />
          )}
        </main>
      </div>

      {/* ── Bottom nav (mobile) ── */}
      <BottomNav
        tripId={tripId}
        currentTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
      />

      {/* ── Support FAB ── */}
      <SupportFAB />

    </>
  );
}

// ─── Welcome banner ───────────────────────────────────────────────────────────

function WelcomeBanner({
  firstName,
  tripName,
  destination,
  dateRange,
}: {
  firstName: string;
  tripName: string;
  destination?: string;
  dateRange?: string;
}) {
  return (
    <div
      className="mx-4 mt-4 mb-1 lg:mx-10 lg:mt-5 rounded-2xl overflow-hidden animate-fade-in"
      style={{
        background: "linear-gradient(135deg, #D94040 0%, #E85550 50%, #C83030 100%)",
        boxShadow: "0 4px 24px rgba(217,64,64,0.25)",
      }}
    >
      {/* Decorative circles */}
      <div className="relative px-5 py-4 lg:px-7 lg:py-5 overflow-hidden">
        <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/10" />
        <div className="absolute -right-2 -top-2 w-20 h-20 rounded-full bg-white/08" />
        <div className="absolute right-16 -bottom-8 w-24 h-24 rounded-full bg-white/06" />

        <div className="relative z-10">
          <h2 className="font-display text-xl lg:text-2xl font-semibold text-white leading-tight mb-2">
            <span style={{ color: "#FFE9A0" }}>Hola, {firstName}!</span>{" "}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/fan.svg" alt="" aria-hidden width={36} height={36} className="wave-hand inline-block align-middle" style={{ transformOrigin: "50% 90%", filter: "contrast(1.5) saturate(1.2)" }} />
          </h2>
          <p className="text-white/85 text-sm leading-relaxed">
            {destination
              ? <>This is your plan for your amazing trip to <strong className="font-semibold text-white">{destination}</strong>.</>
              : <>This is your plan for <strong className="font-semibold text-white">{tripName}</strong>.</>
            }
            {dateRange && (
              <span className="text-white/65"> Enjoy every moment.</span>
            )}
          </p>

          {/* Date + location chips */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {destination && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-white/90 px-2.5 py-1 rounded-full bg-white/15">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                  <circle cx="12" cy="9" r="2.5"/>
                </svg>
                {destination}
              </span>
            )}
            {dateRange && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-white/90 px-2.5 py-1 rounded-full bg-white/15">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                {dateRange}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Support FAB ──────────────────────────────────────────────────────────────

function SupportFAB() {
  const [tooltip, setTooltip] = useState(false);

  return (
    <div className="fixed bottom-24 right-5 z-40 lg:bottom-8 lg:right-8 flex flex-col items-end gap-2">
      {tooltip && (
        <div
          className="animate-fade-in mb-1 px-3 py-2 rounded-xl text-xs font-medium text-white whitespace-nowrap"
          style={{
            background: "#1E0E0B",
            boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
          }}
        >
          📬 hola@makeitspain.com
        </div>
      )}

      <a
        href="mailto:hola@makeitspain.com"
        aria-label="Contact support"
        onMouseEnter={() => setTooltip(true)}
        onMouseLeave={() => setTooltip(false)}
        onTouchStart={() => setTooltip((v) => !v)}
        className="flex items-center justify-center rounded-full transition-all duration-200 active:scale-95"
        style={{
          width: 52,
          height: 52,
          background: "white",
          border: "2px solid rgba(217,64,64,0.2)",
          boxShadow: "0 4px 20px rgba(120,60,50,0.18)",
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke="#D94040" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
          <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
        </svg>
      </a>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function TripPlanSkeleton() {
  return (
    <div className="pt-4 space-y-3">
      <Skeleton className="h-28 w-full rounded-2xl mb-2" />

      <div className="flex gap-2 pb-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-9 w-16 rounded-full shrink-0" />
        ))}
      </div>

      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl bg-white overflow-hidden"
          style={{ border: "1px solid rgba(180,100,90,0.1)", boxShadow: "0 1px 4px rgba(120,60,50,0.06)" }}>
          <div className="h-[3px]" style={{ background: "rgba(217,64,64,0.15)" }} />
          <div className="p-4 space-y-3">
            <div className="flex justify-between">
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-5 w-3/5" />
            <Skeleton className="h-4 w-2/5 rounded-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
