"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useJsApiLoader, GoogleMap, DirectionsRenderer } from "@react-google-maps/api";
import { cn } from "@/lib/utils/cn";
import type { Activity, TransferMode } from "@/types";

// ─── Warm map style (same as ActivityDetailModal) ─────────────────────────────

const WARM_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry",                stylers: [{ color: "#FFF8E7" }] },
  { elementType: "labels.text.fill",        stylers: [{ color: "#7A5C30" }] },
  { elementType: "labels.text.stroke",      stylers: [{ color: "#FFF8E7" }] },
  { featureType: "road",        elementType: "geometry",         stylers: [{ color: "#FFFFFF" }] },
  { featureType: "road",        elementType: "geometry.stroke",  stylers: [{ color: "#F0D080" }] },
  { featureType: "road",        elementType: "labels.text.fill", stylers: [{ color: "#8A6A30" }] },
  { featureType: "road.highway",elementType: "geometry",         stylers: [{ color: "#F5C842" }] },
  { featureType: "road.highway",elementType: "geometry.stroke",  stylers: [{ color: "#E0A820" }] },
  { featureType: "water",       elementType: "geometry",         stylers: [{ color: "#B8D8E8" }] },
  { featureType: "landscape",   elementType: "geometry",         stylers: [{ color: "#FFF3CC" }] },
  { featureType: "poi",         elementType: "geometry",         stylers: [{ color: "#FFE8A0" }] },
  { featureType: "poi.park",    elementType: "geometry",         stylers: [{ color: "#C8E6A0" }] },
  { featureType: "transit",     stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#E0C060" }] },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface TravelOption {
  mode: TransferMode;
  durationMins: number;
  label: string;
}

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

function toEmbedMode(mode: TransferMode): string {
  switch (mode) {
    case "taxi":    return "driving";
    case "walking": return "walking";
    case "transit": return "transit";
  }
}

function formatGap(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
}

// ─── Mode buttons config ──────────────────────────────────────────────────────

const MODES: { id: TransferMode; label: string; icon: React.ReactNode }[] = [
  {
    id: "taxi",
    label: "Taxi",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="7" cy="17" r="2" />
        <circle cx="17" cy="17" r="2" />
        <path d="M5 17H3a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1l3-4h8l3 4h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-2" />
        <path d="M5 17h10" />
        <path d="M7 12l1.5-3h7L17 12" />
      </svg>
    ),
  },
  {
    id: "walking",
    label: "Walk",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="13" cy="4" r="2" />
        <path d="M9 9l2-2 4 2 2 4H9l1-3" />
        <path d="M7 15l2 3 4-3" />
        <path d="M13 12l2 6" />
      </svg>
    ),
  },
  {
    id: "transit",
    label: "Transit",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="3" width="18" height="14" rx="2" />
        <path d="M3 10h18" />
        <circle cx="8" cy="19" r="2" />
        <circle cx="16" cy="19" r="2" />
        <path d="M8 17v-3" />
        <path d="M16 17v-3" />
      </svg>
    ),
  },
];

// ─── Full-screen map popup ────────────────────────────────────────────────────

const TAXI_SERVICES = [
  { id: "uber",    label: "Uber",     bg: "#000000", textColor: "white" as const },
  { id: "cabify",  label: "Cabify",   bg: "#5C38BC", textColor: "white" as const },
  { id: "freenow", label: "FREE NOW", bg: "#1A1A2E", textColor: "#FFD700" as const },
];

const TRAVEL_MODE_MAP: Record<TransferMode, string> = {
  taxi:    "DRIVING",
  walking: "WALKING",
  transit: "TRANSIT",
};

/** Scrolling marquee for text that may overflow */
function MarqueeText({ text, className, style }: { text: string; className?: string; style?: React.CSSProperties }) {
  return (
    <>
      <style>{`
        @keyframes marquee-scroll {
          0%, 15%  { transform: translateX(0); }
          85%, 100% { transform: translateX(-50%); }
        }
      `}</style>
      <div className={cn("overflow-hidden w-full", className)} style={style}>
        <div
          className="whitespace-nowrap inline-block"
          style={{ animation: "marquee-scroll 7s ease-in-out infinite" }}
        >
          {text}
          <span className="inline-block w-16" />
          {text}
          <span className="inline-block w-16" />
        </div>
      </div>
    </>
  );
}

interface TransferMapPopupProps {
  from: Activity;
  to: Activity;
  initialMode: TransferMode;
  travelOptions: TravelOption[];
  isOpen: boolean;
  onClose: () => void;
}

function TransferMapPopup({ from, to, initialMode, travelOptions, isOpen, onClose }: TransferMapPopupProps) {
  const [activeMode, setActiveMode] = useState<TransferMode>(initialMode);
  const [showTaxiApps, setShowTaxiApps] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const touchStartY = useRef<number | null>(null);

  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: MAPS_KEY, id: "google-map-script" });

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!isOpen) { setShowTaxiApps(false); setIsExpanded(false); }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // Fetch directions whenever mode or open state changes
  useEffect(() => {
    if (!isLoaded || !isOpen || !from.address || !to.address) return;
    setDirections(null);
    const svc = new google.maps.DirectionsService();
    svc.route(
      {
        origin: from.address,
        destination: to.address,
        travelMode: google.maps.TravelMode[TRAVEL_MODE_MAP[activeMode] as keyof typeof google.maps.TravelMode],
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) setDirections(result);
      },
    );
  }, [isLoaded, isOpen, from.address, to.address, activeMode]);

  function zoomIn()  { mapInstance?.setZoom((mapInstance.getZoom() ?? 14) + 1); }
  function zoomOut() { mapInstance?.setZoom((mapInstance.getZoom() ?? 14) - 1); }

  function handleModeClick(mode: TransferMode) {
    if (mode === "taxi") {
      setActiveMode("taxi");
      setShowTaxiApps((p) => !p);
    } else {
      setActiveMode(mode);
      setShowTaxiApps(false);
    }
  }

  // Drag handle — touch to expand; also tap to toggle
  function onHandleTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY;
  }
  function onHandleTouchEnd(e: React.TouchEvent) {
    if (touchStartY.current === null) return;
    const delta = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(delta) < 8) {
      // Treat as tap → toggle
      setIsExpanded((p) => !p);
    } else if (!isExpanded && delta < -30) {
      setIsExpanded(true);
    } else if (isExpanded && delta > 30) {
      setIsExpanded(false);
    }
    touchStartY.current = null;
  }

  const lat = to.location?.latitude;
  const lng = to.location?.longitude;
  const placeName = encodeURIComponent(to.place || to.title);
  const taxiUrls: Record<string, string> = {
    uber:    `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${lat ?? ""}&dropoff[longitude]=${lng ?? ""}&dropoff[nickname]=${placeName}`,
    cabify:  "https://cabify.com/",
    freenow: "https://free-now.com/",
  };

  const googleMapsUrl = from.address && to.address
    ? `https://www.google.com/maps/dir/${encodeURIComponent(from.address)}/${encodeURIComponent(to.address)}/?travelmode=${toEmbedMode(activeMode)}`
    : null;

  const routeLabel = `${from.place || from.title}  →  ${to.place || to.title}`;

  if (!mounted) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[9999] flex flex-col transition-opacity duration-300",
        isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
      )}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />

      {/* Panel */}
      <div
        className={cn(
          "absolute bottom-0 inset-x-0 flex flex-col bg-white overflow-hidden",
          "transition-all duration-300 ease-out",
          isExpanded ? "top-0 rounded-none" : "h-[82vh] rounded-t-[20px]",
          isOpen ? "translate-y-0" : "translate-y-full",
        )}
        style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.22)" }}
      >
        {/* Coral header — entire header is the drag target */}
        <div
          className="shrink-0 select-none"
          style={{
            background: "linear-gradient(135deg, #C83030 0%, #E8603A 55%, #F07840 100%)",
          }}
          onTouchStart={onHandleTouchStart}
          onTouchEnd={onHandleTouchEnd}
        >
          {/* Drag pill — big tap target, click also toggles */}
          <div
            className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing"
            onClick={() => setIsExpanded((p) => !p)}
          >
            <div
              className="rounded-full bg-white/50 transition-all duration-300"
              style={{ height: 5, width: isExpanded ? 28 : 40 }}
            />
          </div>

          {/* Row: close · marquee route · open-in-maps */}
          <div className="flex items-center gap-2 px-4 pb-3">
            <button
              onClick={onClose}
              className="shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center transition-opacity active:opacity-60"
              aria-label="Close"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>

            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-white/60 mb-0.5">Transfer route</p>
              <MarqueeText text={routeLabel} className="text-sm font-semibold text-white" />
            </div>

            {googleMapsUrl && (
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/20 text-white text-[10px] font-semibold transition-opacity active:opacity-70"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                </svg>
                Open
              </a>
            )}
          </div>
        </div>

        {/* Map — fills remaining space */}
        <div className="flex-1 relative overflow-hidden bg-[#FFF8E7]">
          {isLoaded && from.address && to.address ? (
            <GoogleMap
              mapContainerStyle={{ width: "100%", height: "100%" }}
              zoom={14}
              center={{ lat: lat ?? 40.4168, lng: lng ?? -3.7038 }}
              onLoad={setMapInstance}
              options={{
                styles: WARM_MAP_STYLE,
                disableDefaultUI: true,
                gestureHandling: "greedy",
                keyboardShortcuts: false,
              }}
            >
              {directions && <DirectionsRenderer directions={directions} options={{ suppressMarkers: false }} />}
            </GoogleMap>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <p className="text-sm text-[#9A7A78]">{from.address && to.address ? "Loading map…" : "No address available"}</p>
            </div>
          )}

          {/* Zoom controls */}
          <div className="absolute right-3 bottom-4 flex flex-col gap-2 z-10">
            <button
              onClick={zoomIn}
              className="w-10 h-10 rounded-full bg-white flex items-center justify-center font-semibold text-xl text-[#3D2020] transition-all active:scale-90"
              style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.18)" }}
              aria-label="Zoom in"
            >+</button>
            <button
              onClick={zoomOut}
              className="w-10 h-10 rounded-full bg-white flex items-center justify-center font-semibold text-xl text-[#3D2020] transition-all active:scale-90"
              style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.18)" }}
              aria-label="Zoom out"
            >−</button>
          </div>
        </div>

        {/* Bottom panel */}
        <div
          className="shrink-0 px-4 pt-3"
          style={{
            paddingBottom: "max(16px, env(safe-area-inset-bottom))",
            background: "white",
            boxShadow: "0 -2px 12px rgba(0,0,0,0.08)",
          }}
        >
          {/* Taxi apps — slide in */}
          <div
            style={{
              overflow: "hidden",
              maxHeight: showTaxiApps ? 72 : 0,
              opacity: showTaxiApps ? 1 : 0,
              transition: "max-height 0.28s ease, opacity 0.22s ease",
              marginBottom: showTaxiApps ? 10 : 0,
            }}
          >
            <div className="flex gap-2">
              {TAXI_SERVICES.map((svc) => (
                <a
                  key={svc.id}
                  href={taxiUrls[svc.id]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex flex-col items-center justify-center gap-0.5 rounded-xl py-2.5 transition-opacity active:opacity-75"
                  style={{ background: svc.bg }}
                >
                  <span className="text-sm font-black leading-none" style={{ color: svc.textColor }}>{svc.label[0]}</span>
                  <span className="text-[10px] font-bold tracking-wide" style={{ color: svc.textColor }}>{svc.label}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Mode buttons */}
          <div className="flex gap-2.5">
            {MODES.map((m) => {
              const active = activeMode === m.id;
              const color = m.id === "taxi" ? "#D94040" : m.id === "walking" ? "#16A34A" : "#1D4ED8";
              const opt = travelOptions.find((o) => o.mode === m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => handleModeClick(m.id)}
                  className="flex-1 flex flex-col items-center gap-0.5 py-2.5 rounded-xl transition-all duration-200 active:scale-95"
                  style={{
                    background: active ? color : `${color}12`,
                    border: active ? "none" : `1px solid ${color}30`,
                  }}
                >
                  <span style={{ color: active ? "white" : color }}>{m.icon}</span>
                  <span className="text-[10px] font-semibold" style={{ color: active ? "white" : color }}>{m.label}</span>
                  {opt && (
                    <span className="text-[10px] font-bold tabular-nums" style={{ color: active ? "rgba(255,255,255,0.9)" : color }}>
                      {formatGap(opt.durationMins)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface TransferPlanCardProps {
  from: Activity;
  to: Activity;
  nowMs: number;
}

export function TransferPlanCard({ from, to, nowMs }: TransferPlanCardProps) {
  const [activeMode, setActiveMode] = useState<TransferMode>(to.transferMode ?? "taxi");
  const [travelOptions, setTravelOptions] = useState<TravelOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [mapPopupOpen, setMapPopupOpen] = useState(false);

  // Transfer is "past" when the destination activity has already started
  const isPast = to.startTime.toMillis() < nowMs;

  const gapMins = Math.round(
    (to.startTime.toMillis() - from.endTime.toMillis()) / 60_000,
  );

  const fetchTravelTimes = useCallback(async () => {
    if (!from.address || !to.address) return;
    setLoading(true);
    try {
      const res = await fetch("/api/travel-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin: from.address, destination: to.address }),
      });
      if (!res.ok) return;
      const data = await res.json() as { results: { mode: string; durationMinutes: number; durationText: string }[] };
      const modeMap: Record<string, TransferMode> = {
        driving: "taxi",
        walking: "walking",
        transit: "transit",
      };
      const options: TravelOption[] = (data.results ?? [])
        .filter((d) => modeMap[d.mode])
        .map((d) => ({
          mode: modeMap[d.mode],
          durationMins: d.durationMinutes,
          label: d.durationText,
        }));
      setTravelOptions(options);
    } catch {
      // silently fail — still show map
    } finally {
      setLoading(false);
    }
  }, [from.address, to.address]);

  useEffect(() => { fetchTravelTimes(); }, [fetchTravelTimes]);

  const currentOption = travelOptions.find((o) => o.mode === activeMode);

  const mapSrc =
    from.address && to.address
      ? `https://www.google.com/maps/embed/v1/directions?key=${MAPS_KEY}` +
        `&origin=${encodeURIComponent(from.address)}` +
        `&destination=${encodeURIComponent(to.address)}` +
        `&mode=${toEmbedMode(activeMode)}`
      : null;

  return (
    <div className="relative my-1">
      {/* Connecting line from prev card */}
      <div className="absolute left-6 -top-3 w-px h-3"
        style={{ background: isPast ? "rgba(0,0,0,0.1)" : "rgba(217,64,64,0.2)" }} />

      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: isPast ? "#EDEAE9" : "white",
          border: isPast ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(217,64,64,0.1)",
        }}
      >
        {/* Header */}
        <div
          className="px-4 py-2.5"
          style={{ borderBottom: isPast ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(217,64,64,0.08)" }}
        >
          {/* Route label */}
          <div className="flex items-center gap-1.5 mb-0.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke={isPast ? "#B0A8A6" : "#7A7060"} strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
            <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: isPast ? "#B0A8A6" : "#9A7A78" }}>
              Transfer
            </span>
          </div>
          <p className="text-xs font-medium leading-snug" style={{ color: isPast ? "#B0A8A6" : "#6B4845" }}>
            <span style={{ color: isPast ? "#B0A8A6" : "#1E0E0B" }}>{from.place || from.title}</span>
            <span className="mx-1.5" style={{ color: isPast ? "#C4B8B6" : "#9A7A78" }}>→</span>
            <span style={{ color: isPast ? "#B0A8A6" : "#1E0E0B" }}>{to.place || to.title}</span>
            {gapMins > 0 && (
              <span className="ml-2 font-normal" style={{ color: isPast ? "#C4B8B6" : "#9A7A78" }}>
                · {formatGap(gapMins)} window
              </span>
            )}
          </p>
        </div>

        {/* Map — tap to open full-screen popup */}
        {mapSrc ? (
          <div className="relative w-full" style={{ height: 160 }}>
            <iframe
              key={`${activeMode}-${from.address}-${to.address}`}
              src={mapSrc}
              width="100%"
              height="160"
              style={{ border: 0, display: "block", pointerEvents: "none" }}
              allowFullScreen={false}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title={`Route from ${from.title} to ${to.title}`}
            />
            {/* Tap overlay — sits on top of iframe to intercept touch */}
            {!isPast && (
              <button
                onClick={() => setMapPopupOpen(true)}
                className="absolute inset-0 w-full h-full flex items-end justify-center pb-3 group"
                aria-label="Open full-screen map"
                style={{ background: "transparent" }}
              >
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white shadow transition-opacity group-active:opacity-70"
                  style={{ background: "rgba(217,64,64,0.85)" }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                  </svg>
                  Tap for directions
                </div>
              </button>
            )}
            {/* Grey overlay when past */}
            {isPast && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: "rgba(180,170,165,0.55)" }}
              />
            )}
          </div>
        ) : (
          <div
            className="w-full flex items-center justify-center"
            style={{ height: 160, background: isPast ? "#E5E0DF" : "#FAF4F2" }}
          >
            <span className="text-xs" style={{ color: isPast ? "#B0A8A6" : "#9A7A78" }}>
              No address available
            </span>
          </div>
        )}

        {/* Mode switcher */}
        <div className="px-3 py-2.5">
          <div className="flex items-center gap-2">
            {MODES.map((m) => {
              const opt = travelOptions.find((o) => o.mode === m.id);
              const active = activeMode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => !isPast && setActiveMode(m.id)}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl transition-all duration-200",
                    isPast
                      ? "text-[#B0A8A6]"
                      : active
                        ? "bg-[#D94040]/15 text-[#D94040]"
                        : "text-[#9A7A78] hover:bg-[#D94040]/06",
                  )}
                  style={isPast && active ? { background: "rgba(0,0,0,0.06)" } : {}}
                >
                  {m.icon}
                  <span className="text-[10px] font-medium">{m.label}</span>
                  {opt && !loading && (
                    <span className="text-[9px] tabular-nums" style={{ color: isPast ? "#C4B8B6" : active ? "rgba(217,64,64,0.8)" : "#C4AAA8" }}>
                      {formatGap(opt.durationMins)}
                    </span>
                  )}
                  {loading && active && !isPast && (
                    <span className="text-[9px] text-[#D94040]/40 animate-pulse">···</span>
                  )}
                </button>
              );
            })}
          </div>

          {currentOption && (
            <p className="text-center text-xs mt-1.5" style={{ color: isPast ? "#B0A8A6" : "#9A7A78" }}>
              <span className="font-medium" style={{ color: isPast ? "#9A9290" : "#6B4845" }}>
                {formatGap(currentOption.durationMins)}
              </span>
              {" "}by {currentOption.mode === "taxi" ? "taxi/car" : currentOption.mode}
            </p>
          )}
        </div>
      </div>

      {/* Connecting line to next card */}
      <div className="absolute left-6 -bottom-3 w-px h-3"
        style={{ background: isPast ? "rgba(0,0,0,0.1)" : "rgba(217,64,64,0.2)" }} />

      {/* Full-screen map popup */}
      <TransferMapPopup
        from={from}
        to={to}
        initialMode={activeMode}
        travelOptions={travelOptions}
        isOpen={mapPopupOpen}
        onClose={() => setMapPopupOpen(false)}
      />
    </div>
  );
}
