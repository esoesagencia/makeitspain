"use client";

import { useEffect, useRef, useCallback } from "react";

const ITEM_H = 44; // px per item
const VISIBLE = 5; // items visible at once

interface DrumRollItem {
  value: number;
  label: string;
}

interface DrumRollColumnProps {
  items: DrumRollItem[];
  value: number;
  onChange: (v: number) => void;
}

function DrumRollColumn({ items, value, onChange }: DrumRollColumnProps) {
  const ref = useRef<HTMLDivElement>(null);
  const scrollingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Scroll to the selected value on mount or when value changes externally
  useEffect(() => {
    const idx = items.findIndex((i) => i.value === value);
    if (idx < 0 || !ref.current) return;
    const target = idx * ITEM_H;
    if (Math.abs(ref.current.scrollTop - target) > 2) {
      ref.current.scrollTo({ top: target, behavior: "smooth" });
    }
  }, [value, items]);

  const snap = useCallback(() => {
    if (!ref.current) return;
    const idx = Math.round(ref.current.scrollTop / ITEM_H);
    const clamped = Math.max(0, Math.min(idx, items.length - 1));
    ref.current.scrollTo({ top: clamped * ITEM_H, behavior: "smooth" });
    onChange(items[clamped].value);
  }, [items, onChange]);

  function handleScroll() {
    scrollingRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      scrollingRef.current = false;
      snap();
    }, 120);
  }

  const padding = ITEM_H * 2; // centers first/last items

  return (
    <div className="relative" style={{ height: ITEM_H * VISIBLE }}>
      {/* Selection highlight */}
      <div
        className="absolute inset-x-0 pointer-events-none rounded-[6px]"
        style={{ top: ITEM_H * 2, height: ITEM_H, background: "rgba(217,64,64,0.08)", borderTop: "1px solid rgba(217,64,64,0.2)", borderBottom: "1px solid rgba(217,64,64,0.2)" }}
      />

      {/* Fade top */}
      <div className="absolute inset-x-0 top-0 pointer-events-none z-10"
        style={{ height: ITEM_H * 2, background: "linear-gradient(to bottom, white 0%, transparent 100%)" }}
      />
      {/* Fade bottom */}
      <div className="absolute inset-x-0 bottom-0 pointer-events-none z-10"
        style={{ height: ITEM_H * 2, background: "linear-gradient(to top, white 0%, transparent 100%)" }}
      />

      <div
        ref={ref}
        onScroll={handleScroll}
        className="h-full overflow-y-scroll scrollbar-none"
        style={{
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
          paddingTop: padding,
          paddingBottom: padding,
        }}
      >
        {items.map((item) => {
          const isSelected = item.value === value;
          return (
            <div
              key={item.value}
              onClick={() => {
                ref.current?.scrollTo({ top: items.findIndex((i) => i.value === item.value) * ITEM_H, behavior: "smooth" });
                onChange(item.value);
              }}
              style={{ height: ITEM_H, scrollSnapAlign: "center" }}
              className={[
                "flex items-center justify-center text-lg font-medium cursor-pointer transition-all select-none",
                isSelected ? "text-[#D94040] scale-110" : "text-[#C4AAA8] scale-90",
              ].join(" ")}
            >
              {item.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Time picker: two columns side by side ────────────────────────────────────

interface TimeDrumPickerProps {
  hour: number;   // 0–23
  minute: number; // 0, 5, 10 ... 55
  onChange: (hour: number, minute: number) => void;
  label?: string;
}

const HOURS: DrumRollItem[] = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: String(i).padStart(2, "0"),
}));

const MINUTES: DrumRollItem[] = Array.from({ length: 12 }, (_, i) => ({
  value: i * 5,
  label: String(i * 5).padStart(2, "0"),
}));

export function TimeDrumPicker({ hour, minute, onChange, label }: TimeDrumPickerProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      {label && (
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[#9A7A78]">{label}</span>
      )}
      <div className="flex items-center gap-1 rounded-[10px] overflow-hidden px-2 bg-white" style={{ border: "1px solid rgba(180,100,90,0.2)" }}>
        <DrumRollColumn
          items={HOURS}
          value={hour}
          onChange={(h) => onChange(h, minute)}
        />
        <span className="text-2xl font-bold text-[#D94040] pb-0.5 select-none">:</span>
        <DrumRollColumn
          items={MINUTES}
          value={minute}
          onChange={(m) => onChange(hour, m)}
        />
      </div>
    </div>
  );
}
