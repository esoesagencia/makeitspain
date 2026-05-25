"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { auth } from "@/lib/firebase/auth";
import { db, COLLECTIONS } from "@/lib/firebase/firestore";
import { TripCard } from "@/components/trip/TripCard";
import { TripCardSkeleton } from "@/components/ui/Skeleton";
import { JoinTripModal } from "@/components/trip/JoinTripModal";
import { Avatar } from "@/components/ui/Avatar";
import type { Trip, TripDocument, UserDocument } from "@/types";

type PageState = "loading-auth" | "loading-trips" | "ready" | "error";

// ─── Confetti particle ────────────────────────────────────────────────────────

interface Particle {
  id: number;
  cx: string;
  cy: string;
  cr: string;
  color: string;
  size: number;
  delay: string;
}

const CONFETTI_COLORS = ["#D94040", "#F06050", "#3B6FCA", "#1A9E72", "#C07C10", "#8B4DC0"];

function useConfettiParticles(count = 18): Particle[] {
  return useMemo(() => {
    // Deterministic "random" via simple LCG so SSR and client match
    let seed = 42;
    const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0xffffffff; };

    return Array.from({ length: count }, (_, i) => {
      const angle = rng() * 360;
      const dist = 40 + rng() * 60;
      const rad = (angle * Math.PI) / 180;
      return {
        id: i,
        cx: `${Math.cos(rad) * dist}px`,
        cy: `${Math.sin(rad) * dist}px`,
        cr: `${rng() * 720 - 360}deg`,
        color: CONFETTI_COLORS[Math.floor(rng() * CONFETTI_COLORS.length)],
        size: 4 + Math.floor(rng() * 5),
        delay: `${(rng() * 0.15).toFixed(2)}s`,
      };
    });
  }, [count]);
}

// ─── Trip journey line animation ─────────────────────────────────────────────

const S            = 34; // icon size px
const GAP          = 6;  // px gap left side (suitcase → track)
const RIGHT_OFFSET = S - 3; // compensates for pin SVG's ~9px internal left whitespace

// Timing (ms from mount)
const EMERGE_START = 900;
const EMERGE_DUR   = 350;
const LID_START       = EMERGE_START;              // lid opens as plane emerges
const LID_DUR         = 480;
const FLY_START       = EMERGE_START + EMERGE_DUR; // 1250
const LID_CLOSE_START = FLY_START + 350;           // lid closes once plane has cleared
const LID_CLOSE_DUR   = 420;
const FLY_DUR      = 2100;
const JOURNEY_END  = FLY_START + FLY_DUR;       // 3350

function TripJourneyLine() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const [lidAngle, setLidAngle]       = useState(0);        // 0 → 130 (open)
  const [planeVisible, setPlaneVisible] = useState(false);
  const [planeLeft, setPlaneLeft]     = useState(S / 2);    // px, centre of plane
  const [planeY, setPlaneY]           = useState(0);
  const [planeScale, setPlaneScale]   = useState(0.25);
  const [progress, setProgress]       = useState(0);        // 0-1, drives line fill
  const [showPin, setShowPin]         = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const particles = useConfettiParticles(22);

  useEffect(() => {
    const t0 = performance.now();

    const tick = (now: number) => {
      const e   = now - t0;
      const W   = containerRef.current?.offsetWidth ?? 320;
      const trackW = W - (S + GAP) - RIGHT_OFFSET;

      // ── Lid opens ──────────────────────────────────────────────────────
      if (e >= LID_START && e < LID_CLOSE_START) {
        const f = Math.min((e - LID_START) / LID_DUR, 1);
        setLidAngle(130 * (1 - Math.pow(1 - f, 3)));
      }

      // ── Lid closes ─────────────────────────────────────────────────────
      if (e >= LID_CLOSE_START) {
        const f = Math.min((e - LID_CLOSE_START) / LID_CLOSE_DUR, 1);
        setLidAngle(130 * Math.pow(1 - f, 3)); // ease-in cubic back to 0
      }

      // ── Plane emerges (small → full size, arcs up out of suitcase) ────
      if (e >= EMERGE_START && e < FLY_START) {
        const f = Math.min((e - EMERGE_START) / EMERGE_DUR, 1);
        setPlaneVisible(true);
        setPlaneScale(0.25 + 0.75 * f);
        // centre moves from suitcase centre (S/2) to track start (S + GAP)
        setPlaneLeft(S / 2 + (S / 2 + GAP) * f);
        // arcs upward then comes back down to track level at f=1 (sin curve)
        setPlaneY(Math.sin(f * Math.PI) * -S * 0.9);
      }

      // ── Plane flies ────────────────────────────────────────────────────
      if (e >= FLY_START && e < JOURNEY_END) {
        const f = Math.min((e - FLY_START) / FLY_DUR, 1);
        setPlaneVisible(true);
        setPlaneScale(1);
        setProgress(f);
        setPlaneLeft(S + GAP + f * trackW);
        const env = Math.sin(f * Math.PI);
        setPlaneY(Math.sin(f * Math.PI * 3.5) * env * 10);
      }

      // ── Done ───────────────────────────────────────────────────────────
      if (e >= JOURNEY_END) {
        setPlaneVisible(false);
        setShowPin(true);
        setTimeout(() => setShowConfetti(true), 80);
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  return (
    <div ref={containerRef} className="mt-3 relative select-none" style={{ height: 64, overflow: "visible" }}>

      {/* Grey wire track */}
      <div style={{ position: "absolute", left: S + GAP, right: RIGHT_OFFSET, top: "50%", height: 3, transform: "translateY(-50%)" }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: 999, background: "rgba(180,100,90,0.15)" }} />
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0,
          borderRadius: 999, background: "#D94040",
          width: `${progress * 100}%`,
        }} />
      </div>

      {/* ── Suitcase — bottom half static, top half (lid) rotates open ── */}
      {/* Outer: positions at vertical center. Inner: animates scale without clobbering translateY */}
      <div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: S, height: S }}>
        <div style={{ position: "relative", width: S, height: S, animation: "iconPop 0.6s cubic-bezier(0.34,1.56,0.64,1) both" }}>
          {/* Bottom half — stays put always */}
          <div style={{ position: "absolute", bottom: 0, left: 0, width: S, height: S / 2, overflow: "hidden" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/suitcase.svg" alt="" width={S} height={S}
              style={{ position: "absolute", bottom: 0, left: 0, display: "block" }} />
          </div>

          {/* Top half (lid) — includes handle, rotates back to open */}
          <div style={{
            position: "absolute", top: 0, left: 0,
            width: S, height: S / 2, overflow: "hidden",
            transformOrigin: "bottom center",
            transform: `perspective(${S * 5}px) rotateX(${lidAngle}deg)`,
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/suitcase.svg" alt="" width={S} height={S}
              style={{ position: "absolute", top: 0, left: 0, display: "block" }} />
          </div>
        </div>
      </div>

      {/* ── Paper plane — emerges then flies ── */}
      {planeVisible && (
        <div style={{
          position: "absolute",
          left: planeLeft,
          top: "50%",
          width: S, height: S,
          transform: `translate(-50%, calc(-50% + ${planeY}px)) scale(${planeScale}) scaleX(-1)`,
          transformOrigin: "center center",
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/paper-plane.svg" alt="" width={S} height={S} style={{ display: "block" }} />
        </div>
      )}

      {/* ── Spain map pin — pops in at the end + confetti ── */}
      {showPin && (
        <div style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", width: S, height: S, overflow: "visible" }}>
          <div style={{ position: "relative", width: S, height: S, animation: "iconPop 0.6s cubic-bezier(0.34,1.56,0.64,1) both", overflow: "visible" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/spain-map-pin.svg" alt="" width={S} height={S} style={{ display: "block" }} />
          {showConfetti && particles.map((p) => (
            <div key={p.id} className="absolute rounded-sm pointer-events-none" style={{
              width: p.size, height: p.size, background: p.color,
              top: "50%", left: "50%",
              marginTop: -p.size / 2, marginLeft: -p.size / 2,
              // @ts-expect-error custom CSS vars
              "--cx": p.cx, "--cy": p.cy, "--cr": p.cr,
              animation: `confettiFly 0.7s ease-out ${p.delay} forwards`,
              opacity: 1,
            }} />
          ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TripsPage() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [pageState, setPageState] = useState<PageState>("loading-auth");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) { router.replace("/login"); return; }
      setUid(user.uid);
      try {
        const snap = await getDoc(doc(db, COLLECTIONS.USERS, user.uid));
        if (snap.exists()) {
          const data = snap.data() as UserDocument;
          setDisplayName(data.displayName ?? user.displayName ?? "");
          setPhotoUrl(data.photoUrl ?? null);
        } else {
          setDisplayName(user.displayName ?? "");
        }
      } catch {
        setDisplayName(user.displayName ?? "");
      }
    });
  }, [router]);

  useEffect(() => {
    if (!uid) return;
    setPageState("loading-trips");
    const q = query(collection(db, COLLECTIONS.TRIPS), where("memberIds", "array-contains", uid));
    return onSnapshot(q,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as TripDocument) }));
        docs.sort((a, b) => b.startDate.toMillis() - a.startDate.toMillis());
        setTrips(docs);
        setPageState("ready");
      },
      () => setPageState("error"),
    );
  }, [uid]);

  const isLoading = pageState === "loading-auth" || pageState === "loading-trips";
  const firstName = displayName.split(" ")[0] || "";

  return (
    <>
      <div className="min-h-screen bg-[#F5EDED]">

        {/* ── Header ── */}
        <header className="sticky top-0 z-10"
          style={{ background: "#D94040", boxShadow: "0 2px 12px rgba(217,64,64,0.3)" }}>
          <div className="flex items-center gap-3 max-w-5xl mx-auto px-5 py-4 lg:px-10 lg:py-5">
            <h1 className="font-display text-xl font-semibold" style={{ color: "#fff" }}>My Trips</h1>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <a href="https://www.makeitspain.com/" target="_blank" rel="noopener noreferrer" className="ml-auto shrink-0">
              <img src="/logo.png" alt="MakeItSpain" className="h-7 w-auto" style={{ filter: "brightness(0) invert(1)" }} />
            </a>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-5 pt-6 pb-28 lg:px-10 lg:pt-10 lg:pb-16">

          {/* Loading */}
          {isLoading && (
            <div className="flex flex-col gap-3 max-w-lg mx-auto">
              <TripCardSkeleton /><TripCardSkeleton /><TripCardSkeleton />
            </div>
          )}

          {/* Error */}
          {pageState === "error" && (
            <div className="mt-16 text-center">
              <p className="text-[#D94040] text-sm mb-4">Couldn&apos;t load your trips. Check your connection.</p>
              <button onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-xl text-sm font-medium border text-[#D94040] hover:bg-[#D94040]/08 transition-colors"
                style={{ borderColor: "rgba(217,64,64,0.3)" }}>
                Retry
              </button>
            </div>
          )}

          {/* Trip list */}
          {pageState === "ready" && trips.length > 0 && (
            <>
              {/* Personalised greeting */}
              {firstName && uid && (
                <div className="mb-6 animate-fade-in">
                  <div className="flex items-center gap-3 mb-1">
                    <Avatar uid={uid} displayName={displayName} photoUrl={photoUrl} size={44} />
                    <h2 className="font-display text-3xl lg:text-4xl font-light text-[#1E0E0B]">
                      Hi, <span className="text-[#D94040] font-semibold">{firstName}</span>{" "}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/icons/waving-hand-new-again.svg" alt="" aria-hidden width={34} height={34} className="wave-hand inline-block align-middle" />
                    </h2>
                  </div>
                  <p className="mt-1 text-sm text-[#9A7A78]">
                    Here {trips.length === 1 ? "is" : "are"} your{" "}
                    {trips.length === 1 ? "upcoming trip" : `${trips.length} trips`} to Spain.
                  </p>
                  <TripJourneyLine />
                </div>
              )}

              {/* Desktop intro — no name */}
              {!firstName && (
                <div className="hidden lg:block mb-8">
                  <p className="text-xs font-semibold tracking-[0.3em] uppercase text-[#9A7A78] mb-2">Your Journeys</p>
                  <h2 className="font-display text-4xl font-light text-[#1E0E0B]">Curated for you</h2>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="w-10 h-px bg-[#D94040]/30 rounded-full" />
                    <span className="text-xs text-[#9A7A78] tracking-widest uppercase">
                      {trips.length} {trips.length === 1 ? "trip" : "trips"}
                    </span>
                  </div>
                </div>
              )}

              <ul className={`flex flex-col gap-3 lg:gap-4 ${trips.length > 1 ? "lg:grid lg:grid-cols-2" : ""}`}>
                {trips.map((trip) => (
                  <li key={trip.id}>
                    <TripCard trip={trip} onClick={() => router.push(`/trip/${trip.id}`)} />
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Empty state */}
          {pageState === "ready" && trips.length === 0 && (
            <EmptyState firstName={firstName} onJoin={() => setModalOpen(true)} />
          )}
        </main>
      </div>

      {/* FAB — join trip */}
      {pageState === "ready" && trips.length > 0 && (
        <button
          onClick={() => setModalOpen(true)}
          className="fixed bottom-6 right-6 z-20 h-14 w-14 rounded-full flex items-center justify-center active:scale-95 transition-all duration-150 focus-visible:outline-none"
          style={{ background: "#D94040", boxShadow: "0 4px 20px rgba(217,64,64,0.4)" }}
          aria-label="Join a trip"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      )}

      {/* Support FAB */}
      <SupportFAB offsetBottom={trips.length > 0 && pageState === "ready" ? 88 : 24} />

      {modalOpen && uid && <JoinTripModal uid={uid} onClose={() => setModalOpen(false)} />}
    </>
  );
}

// ─── Support FAB ──────────────────────────────────────────────────────────────

function SupportFAB({ offsetBottom = 24 }: { offsetBottom?: number }) {
  const [tooltip, setTooltip] = useState(false);
  return (
    <div
      className="fixed right-6 z-40 flex flex-col items-end gap-2 transition-all duration-300"
      style={{ bottom: offsetBottom + 16 }}
    >
      {tooltip && (
        <div className="animate-fade-in mb-1 px-3 py-2 rounded-xl text-xs font-medium text-white whitespace-nowrap relative"
          style={{ background: "#1E0E0B", boxShadow: "0 4px 16px rgba(0,0,0,0.2)" }}>
          📬 hola@makeitspain.com
        </div>
      )}
      <a
        href="mailto:hola@makeitspain.com"
        aria-label="Contact support – hola@makeitspain.com"
        onMouseEnter={() => setTooltip(true)}
        onMouseLeave={() => setTooltip(false)}
        className="h-14 w-14 shrink-0 flex items-center justify-center rounded-full transition-all duration-200 active:scale-95"
        style={{
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

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ firstName, onJoin }: { firstName: string; onJoin: () => void }) {
  return (
    <div className="mt-16 flex flex-col items-center text-center px-4 max-w-sm mx-auto">
      <div className="mb-6 w-16 h-16 rounded-full bg-white flex items-center justify-center"
        style={{ boxShadow: "0 4px 20px rgba(217,64,64,0.12)", border: "1px solid rgba(217,64,64,0.15)" }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
          stroke="#D94040" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
        </svg>
      </div>
      <h2 className="font-display text-2xl font-semibold text-[#1E0E0B] mb-2">
        {firstName ? `Welcome, ${firstName}!` : "No trips yet"}
      </h2>
      <p className="text-sm text-[#9A7A78] leading-relaxed mb-6">
        Enter your invite code to access your personalised Spain experience.
      </p>
      <button onClick={onJoin}
        className="px-7 py-3 rounded-2xl text-sm font-semibold text-white transition-all duration-200"
        style={{ background: "#D94040", boxShadow: "0 4px 16px rgba(217,64,64,0.3)" }}>
        Enter invite code
      </button>
    </div>
  );
}
