"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { PlaceSuggestion } from "@/app/api/places-autocomplete/route";

const inputCls =
  "w-full rounded-[8px] border px-3 h-9 text-sm text-[#1E0E0B] bg-white " +
  "placeholder:text-[#9A7A78]/60 focus:outline-none focus:ring-2 " +
  "focus:ring-[#D94040] focus:border-transparent";

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

export function AddressAutocomplete({
  value, onChange, placeholder = "Start typing an address…", required,
}: AddressAutocompleteProps) {
  const [query, setQuery]             = useState(value);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen]               = useState(false);
  const [loading, setLoading]         = useState(false);
  const [activeIdx, setActiveIdx]     = useState(-1);
  const debounceRef                   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef                  = useRef<HTMLDivElement>(null);

  // Keep query in sync if parent changes value externally (e.g. accommodation picker auto-fill)
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSuggestions([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res  = await fetch(`/api/places-autocomplete?q=${encodeURIComponent(q)}`);
      const data = await res.json() as { suggestions?: PlaceSuggestion[] };
      setSuggestions(data.suggestions ?? []);
      setOpen((data.suggestions ?? []).length > 0);
      setActiveIdx(-1);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    onChange(v); // keep parent in sync while typing

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(v), 320);
  }

  function select(suggestion: PlaceSuggestion) {
    setQuery(suggestion.description);
    onChange(suggestion.description);
    setSuggestions([]);
    setOpen(false);
    setActiveIdx(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      select(suggestions[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          className={inputCls}
          style={{ borderColor: "rgba(180,100,90,0.2)", paddingRight: loading ? "2rem" : undefined }}
          placeholder={placeholder}
          value={query}
          required={required}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
          autoComplete="off"
        />
        {/* Spinner while fetching */}
        {loading && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
            <div className="w-3.5 h-3.5 rounded-full border-2 border-[#D94040] border-t-transparent animate-spin" />
          </div>
        )}
      </div>

      {/* Suggestions dropdown */}
      {open && suggestions.length > 0 && (
        <ul
          className="absolute z-50 left-0 right-0 mt-1 rounded-[10px] overflow-hidden"
          style={{
            background: "white",
            border: "1px solid rgba(180,100,90,0.18)",
            boxShadow: "0 8px 24px rgba(120,60,50,0.12)",
          }}
        >
          {suggestions.map((s, i) => (
            <li
              key={s.placeId}
              onMouseDown={(e) => { e.preventDefault(); select(s); }}
              className="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer transition-colors"
              style={{
                background: i === activeIdx ? "rgba(217,64,64,0.06)" : "white",
                borderBottom: i < suggestions.length - 1 ? "1px solid rgba(180,100,90,0.08)" : "none",
              }}
            >
              {/* Pin icon */}
              <svg
                className="shrink-0 mt-0.5"
                width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="#D94040" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                aria-hidden
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#1E0E0B] truncate">{s.mainText}</p>
                <p className="text-xs text-[#9A7A78] truncate">{s.secondaryText}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
