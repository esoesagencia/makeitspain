"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Prediction {
  placeId: string;
  mainText: string;
  secondaryText: string;
}

export interface PlaceDetails {
  name: string;
  address: string;
}

interface PlacesInputProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected: (details: PlaceDetails) => void;
  placeholder?: string;
  searchType: "establishment" | "address";
  required?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PlacesInput({
  value,
  onChange,
  onPlaceSelected,
  placeholder,
  searchType,
  required,
}: PlacesInputProps) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isOpen, setIsOpen]           = useState(false);
  const [isLoading, setIsLoading]     = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dropPos, setDropPos]         = useState<{ top: number; left: number; width: number } | null>(null);
  const [mounted, setMounted]         = useState(false);

  const inputRef        = useRef<HTMLInputElement>(null);
  const debounceRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justSelectedRef = useRef(false);

  useEffect(() => { setMounted(true); }, []);

  // ── Dropdown position ────────────────────────────────────────────────────
  const updateDropPos = useCallback(() => {
    if (!inputRef.current) return;
    const r = inputRef.current.getBoundingClientRect();
    setDropPos({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onMove = () => updateDropPos();
    window.addEventListener("scroll", onMove, { passive: true, capture: true });
    window.addEventListener("resize", onMove, { passive: true });
    return () => {
      window.removeEventListener("scroll", onMove, { capture: true });
      window.removeEventListener("resize", onMove);
    };
  }, [isOpen, updateDropPos]);

  useEffect(() => {
    if (!isOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (inputRef.current?.contains(e.target as Node)) return;
      const portal = document.getElementById("places-portal");
      if (portal?.contains(e.target as Node)) return;
      setIsOpen(false);
      setActiveIndex(-1);
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [isOpen]);

  // ── Fetch predictions via server route ───────────────────────────────────
  const fetchPredictions = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setPredictions([]); setIsOpen(false); return; }
    setIsLoading(true);
    try {
      const res  = await fetch(
        `/api/places-autocomplete?q=${encodeURIComponent(q)}&type=${searchType}`,
      );
      const data = await res.json() as { suggestions?: { placeId: string; mainText: string; secondaryText: string }[] };
      const preds = (data.suggestions ?? []).slice(0, 5).map((s) => ({
        placeId:       s.placeId,
        mainText:      s.mainText,
        secondaryText: s.secondaryText,
      }));
      setPredictions(preds);
      if (preds.length > 0) { updateDropPos(); setIsOpen(true); }
      else setIsOpen(false);
      setActiveIndex(-1);
    } catch {
      setPredictions([]);
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, [searchType, updateDropPos]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    onChange(val);
    if (justSelectedRef.current) { justSelectedRef.current = false; return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPredictions(val), 300);
  }

  // ── Select prediction → resolve details via server route ─────────────────
  async function selectPrediction(pred: Prediction) {
    justSelectedRef.current = true;
    setPredictions([]);
    setIsOpen(false);
    setActiveIndex(-1);

    try {
      const res  = await fetch(`/api/place-details?placeId=${encodeURIComponent(pred.placeId)}`);
      const data = await res.json() as { name?: string; address?: string };
      const name    = data.name    || pred.mainText;
      const address = data.address || pred.secondaryText;
      onChange(searchType === "establishment" ? name : address);
      onPlaceSelected({ name, address });
    } catch {
      // Fallback to prediction text if details call fails
      const name    = pred.mainText;
      const address = pred.secondaryText;
      onChange(searchType === "establishment" ? name : address);
      onPlaceSelected({ name, address });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || predictions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, predictions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0) void selectPrediction(predictions[activeIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  const dropdown =
    mounted && isOpen && predictions.length > 0 && dropPos
      ? createPortal(
          <div
            id="places-portal"
            style={{
              position: "fixed",
              top:    dropPos.top,
              left:   dropPos.left,
              width:  dropPos.width,
              zIndex: 99999,
            }}
          >
            <div
              className="rounded-[10px] bg-white overflow-hidden"
              style={{
                boxShadow: "0 8px 32px rgba(30,14,11,0.18), 0 2px 8px rgba(30,14,11,0.08)",
                border: "1px solid rgba(180,100,90,0.15)",
              }}
            >
              {predictions.map((pred, i) => (
                <button
                  key={pred.placeId}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); void selectPrediction(pred); }}
                  onMouseEnter={() => setActiveIndex(i)}
                  className="w-full text-left px-3 py-2.5 flex items-start gap-2.5 transition-colors"
                  style={{
                    background:   i === activeIndex ? "rgba(217,64,64,0.06)" : "transparent",
                    borderBottom: i < predictions.length - 1 ? "1px solid rgba(180,100,90,0.07)" : "none",
                  }}
                >
                  <span className="mt-0.5 shrink-0" style={{ color: i === activeIndex ? "#D94040" : "#9A7A78" }}>
                    <DropPinIcon />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1E0E0B] truncate leading-snug">{pred.mainText}</p>
                    <p className="text-xs text-[#9A7A78] truncate leading-snug mt-0.5">{pred.secondaryText}</p>
                  </div>
                </button>
              ))}
              <div className="px-3 py-1.5 flex justify-end" style={{ borderTop: "1px solid rgba(180,100,90,0.07)" }}>
                <span className="text-[9px] text-[#9A7A78]/60">Powered by Google</span>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div className="relative">
        <input
          ref={inputRef}
          className="w-full rounded-[8px] border px-3 pr-8 h-9 text-sm text-[#1E0E0B] bg-white placeholder:text-[#9A7A78]/60 focus:outline-none focus:ring-2 focus:ring-[#D94040] focus:border-transparent"
          style={{ borderColor: "rgba(180,100,90,0.2)" }}
          placeholder={placeholder ?? "Start typing…"}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (predictions.length > 0) { updateDropPos(); setIsOpen(true); }
          }}
          required={required}
          autoComplete="off"
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9A7A78] pointer-events-none">
          {isLoading
            ? <span className="block w-3.5 h-3.5 rounded-full border-2 border-[#D94040] border-t-transparent animate-spin" />
            : <PinIcon />
          }
        </span>
      </div>
      {dropdown}
    </>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function PinIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function DropPinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}
