"use client";

import { useState, useEffect, useRef } from "react";
import { useJsApiLoader, GoogleMap, Marker } from "@react-google-maps/api";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatTime, formatDuration } from "@/lib/utils/time";
import { cn } from "@/lib/utils/cn";
import type { Activity, ActivityCategory } from "@/types";

// ─── Per-category style tokens (mirrors ActivityPlanCard palette) ─────────────

interface ModalCategoryStyle {
  label:    string;
  color:    string;  // dark text / icon colour
  bg:       string;  // pastel header background
}

function getModalCategoryStyle(cat: ActivityCategory): ModalCategoryStyle {
  switch (cat) {
    case "transfer":         return { label: "Transfer",           color: "#1A56DB", bg: "#BFDBFE" };
    case "meal":             return { label: "Dining",             color: "#92570A", bg: "#FDE68A" };
    case "free_time":        return { label: "Free Time",          color: "#5B21B6", bg: "#C4B5FD" };
    case "surprise":         return { label: "Surprise",           color: "#6B21A8", bg: "#E9D5FF" };
    case "hotel":            return { label: "Hotel",              color: "#9A3412", bg: "#FED7AA" };
    case "sleep_in_hotel":   return { label: "Hotel Night",        color: "#1E3A8A", bg: "#C7D2FE" };
    case "wellness_grooming":return { label: "Wellness & Grooming",color: "#BE185D", bg: "#FBCFE8" };
    default:                 return { label: "Activity",           color: "#0D6E4E", bg: "#A7F3D0" };
  }
}

function CategoryBadge({ category }: { category: ActivityCategory }) {
  const { label, color, bg } = getModalCategoryStyle(category);
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
    >
      {label}
    </span>
  );
}

// ─── Warm yellow map style ────────────────────────────────────────────────────

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
  { featureType: "water",       elementType: "labels.text.fill", stylers: [{ color: "#5A8AA0" }] },
  { featureType: "landscape",   elementType: "geometry",         stylers: [{ color: "#FFF3CC" }] },
  { featureType: "poi",         elementType: "geometry",         stylers: [{ color: "#FFE8A0" }] },
  { featureType: "poi.park",    elementType: "geometry",         stylers: [{ color: "#C8E6A0" }] },
  { featureType: "transit",     stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#E0C060" }] },
];

// ─── Inline map widget with zoom controls ─────────────────────────────────────

interface MapWidgetProps {
  lat: number | null;
  lng: number | null;
}

function MapWidget({ lat, lng }: MapWidgetProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const center = { lat: lat ?? 40.4168, lng: lng ?? -3.7038 };
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    id: "google-map-script",
  });

  function zoomIn()  { mapInstance?.setZoom((mapInstance.getZoom() ?? 15) + 1); }
  function zoomOut() { mapInstance?.setZoom((mapInstance.getZoom() ?? 15) - 1); }

  if (!apiKey) {
    return (
      <div className="h-[200px] rounded-[8px] bg-[#FFF8E7] flex items-center justify-center">
        <p className="text-xs text-[#7A7060]">Map requires Google Maps API key</p>
      </div>
    );
  }

  if (!isLoaded) {
    return <Skeleton className="h-[200px] w-full rounded-[8px]" />;
  }

  return (
    <div className="relative h-[200px] w-full rounded-[8px] overflow-hidden">
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={center}
        zoom={15}
        onLoad={setMapInstance}
        options={{
          styles: WARM_MAP_STYLE,
          disableDefaultUI: true,
          gestureHandling: "none",
          keyboardShortcuts: false,
        }}
      >
        <Marker position={center} />
      </GoogleMap>

      {/* Zoom controls */}
      <div className="absolute right-3 bottom-3 flex flex-col gap-1.5 z-10">
        <button
          onClick={zoomIn}
          className="w-8 h-8 rounded-full bg-white flex items-center justify-center font-semibold text-lg text-[#3D2020] transition-all active:scale-90"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.18)" }}
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          onClick={zoomOut}
          className="w-8 h-8 rounded-full bg-white flex items-center justify-center font-semibold text-lg text-[#3D2020] transition-all active:scale-90"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.18)" }}
          aria-label="Zoom out"
        >
          −
        </button>
      </div>
    </div>
  );
}

// ─── Copy-to-clipboard button ─────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={copy}
      className="ml-1.5 shrink-0 p-1 rounded text-[#7A7060] hover:text-white hover:bg-white/5 transition-colors"
      aria-label="Copy address"
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2ECC71" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

interface ActivityDetailModalProps {
  activity: Activity;
  tripId?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ActivityDetailModal({
  activity,
  isOpen,
  onClose,
}: ActivityDetailModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const touchStartY = useRef<number | null>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // Reset expanded state when closed
  useEffect(() => {
    if (!isOpen) setIsExpanded(false);
  }, [isOpen]);

  // Scroll panel back to top when a new activity is shown
  useEffect(() => {
    if (isOpen) scrollRef.current?.scrollTo({ top: 0 });
  }, [isOpen, activity.id]);

  // Drag-to-expand handlers
  function onHandleTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY;
  }
  function onHandleTouchEnd(e: React.TouchEvent) {
    if (touchStartY.current === null) return;
    const delta = e.changedTouches[0].clientY - touchStartY.current;
    if (!isExpanded && delta < -50) setIsExpanded(true);
    if (isExpanded  && delta >  50) setIsExpanded(false);
    touchStartY.current = null;
  }

  const mapsUrl = activity.location
    ? `https://www.google.com/maps/dir/?api=1&destination=${activity.location.latitude},${activity.location.longitude}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(activity.address)}`;

  const { color: catColor } = getModalCategoryStyle(activity.category);

  return (
    /* Root — always in DOM so the slide-in transition is smooth */
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-end transition-opacity duration-300",
        isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
      )}
      role="dialog"
      aria-modal="true"
      aria-label={activity.title}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={cn(
          "relative w-full flex flex-col bg-white overflow-hidden",
          "transition-all duration-300 ease-out",
          isExpanded ? "h-screen rounded-none" : "max-h-[88vh] rounded-t-[20px]",
          isOpen ? "translate-y-0" : "translate-y-full",
        )}
        style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.18)" }}
      >
        {/* ── Coloured header ── */}
        <div
          className="relative shrink-0 px-5 pt-4 pb-5 overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #C83030 0%, #E8603A 55%, #F07840 100%)",
          }}
        >
          {/* Decorative circle */}
          <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />
          <div className="absolute right-16 bottom-2 w-16 h-16 rounded-full bg-white/08 pointer-events-none" />

          {/* Drag handle — touch here to expand / collapse */}
          <div
            className="flex justify-center mb-3 py-1 cursor-grab active:cursor-grabbing"
            onTouchStart={onHandleTouchStart}
            onTouchEnd={onHandleTouchEnd}
            aria-label={isExpanded ? "Pull down to collapse" : "Pull up to expand"}
          >
            <div
              className="rounded-full bg-white/40 transition-all duration-300"
              style={{ height: 4, width: isExpanded ? 32 : 40 }}
            />
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors z-10"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* Category badge */}
          <div className="mb-2">
            <span
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{ background: "rgba(255,255,255,0.3)", color: "white" }}
            >
              {getModalCategoryStyle(activity.category).label}
            </span>
          </div>

          {/* Title */}
          <h2 className="font-display text-[22px] font-semibold text-white leading-tight pr-8 drop-shadow-sm">
            {activity.title}
          </h2>

          {/* Time & duration */}
          <div className="flex items-center gap-4 mt-2 text-sm text-white/80">
            <span className="flex items-center gap-1.5">
              <ClockIcon />
              {formatTime(activity.startTime)} – {formatTime(activity.endTime)}
            </span>
            <span className="flex items-center gap-1.5">
              <TimerIcon />
              {formatDuration(activity.estimatedDuration)}
            </span>
          </div>
        </div>

        {/* Scrollable content */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-4">

          {/* ── Map ── */}
          <div className="mb-5">
            <MapWidget
              lat={activity.location?.latitude ?? null}
              lng={activity.location?.longitude ?? null}
            />
          </div>

          {/* ── Address + copy ── */}
          <div className="flex items-start mb-5">
            <PinIcon className="mt-0.5 shrink-0" style={{ color: catColor }} />
            <p className="ml-2 text-sm leading-snug flex-1" style={{ color: "#3D2020" }}>
              {activity.address}
            </p>
            <CopyButton text={activity.address} />
          </div>

          {/* ── Get Directions ── */}
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-5 flex w-full items-center justify-center gap-2 h-11 rounded-[10px] font-semibold text-sm text-white transition-opacity active:opacity-80"
            style={{ background: "linear-gradient(90deg, #E8603A, #D94040)" }}
          >
            <DirectionsIcon />
            Get Directions
          </a>

          {/* ── Description ── */}
          {activity.description && (
            <Section title="About" accentColor={catColor}>
              <p className="text-sm leading-relaxed" style={{ color: "#5C3A3A" }}>{activity.description}</p>
            </Section>
          )}

          {/* ── Recommendations ── */}
          {activity.recommendations && (
            <Section title="Recommendations" icon={<LightbulbIcon />} accentColor={catColor}>
              <p className="text-sm leading-relaxed" style={{ color: "#5C3A3A" }}>{activity.recommendations}</p>
            </Section>
          )}

          {/* ── Surprise details ── */}
          {activity.isSurprise && (
            <div className="mb-5 rounded-[10px] border px-4 py-4"
              style={{ borderColor: `${catColor}33`, background: `${catColor}0A` }}>
              <div className="flex items-center gap-2 mb-3">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke={catColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="20 12 20 22 4 22 4 12" />
                  <rect x="2" y="7" width="20" height="5" />
                  <line x1="12" y1="22" x2="12" y2="7" />
                  <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
                  <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
                </svg>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: catColor }}>
                  Surprise Details
                </p>
              </div>
              {activity.surpriseDescription && (
                <p className="text-sm leading-relaxed mb-3" style={{ color: "#5C3A3A" }}>{activity.surpriseDescription}</p>
              )}
              {(activity.surpriseContactName || activity.surpriseContactPhone) && (
                <div className="flex flex-col gap-2">
                  {activity.surpriseContactName && (
                    <div className="flex items-center gap-2.5 text-sm" style={{ color: "#3D2020" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                        stroke={catColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      <span>{activity.surpriseContactName}</span>
                    </div>
                  )}
                  {activity.surpriseContactPhone && (
                    <a href={`tel:${activity.surpriseContactPhone}`}
                      className="flex items-center gap-2.5 text-sm transition-opacity active:opacity-70"
                      style={{ color: catColor }}>
                      <PhoneIcon className="shrink-0" style={{ color: catColor }} />
                      {activity.surpriseContactPhone}
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Contact phone (if present) ── */}
          {activity.contactPhone && (
            <div className="mb-5 rounded-[10px] pl-4 pr-4 py-4"
              style={{ borderLeft: "3px solid #E8603A", background: "rgba(232,96,58,0.05)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#E8603A" }}>
                Contact
              </p>
              <a
                href={`tel:${activity.contactPhone}`}
                className="flex items-center gap-2.5 text-sm transition-opacity active:opacity-70"
                style={{ color: "#E8603A" }}
              >
                <PhoneIcon className="shrink-0" style={{ color: "#E8603A" }} />
                {activity.contactPhone}
              </a>
            </div>
          )}

          {/* ── Booking link ── */}
          {activity.contactLink && (
            <a
              href={activity.contactLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-5 flex w-full items-center justify-center gap-2 h-11 rounded-[10px] font-semibold text-sm text-white transition-opacity active:opacity-80"
              style={{ background: "linear-gradient(90deg, #E8603A, #F07840)" }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6"/>
              </svg>
              Booking Link
            </a>
          )}

        </div>
      </div>

    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  icon,
  accentColor = "#E8603A",
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  accentColor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-1.5 mb-2">
        {icon && <span style={{ color: accentColor }}>{icon}</span>}
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: accentColor }}>
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function TimerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="13" r="8" /><polyline points="12 9 12 13 14 15" />
      <path d="M9 2h6M12 2v3" />
    </svg>
  );
}

function PinIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden>
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

function DirectionsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="3 11 22 2 13 21 11 13 3 11" />
    </svg>
  );
}

function LightbulbIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="9" y1="18" x2="15" y2="18" /><line x1="10" y1="22" x2="14" y2="22" />
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A7 7 0 1 0 6.5 11.5c.76.76 1.23 1.52 1.41 2.5" />
    </svg>
  );
}

function PhoneIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.26h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.03z" />
    </svg>
  );
}

function LinkIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

