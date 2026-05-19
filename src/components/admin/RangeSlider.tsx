"use client";

interface RangeSliderProps {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}

export function RangeSlider({ min, max, step, value, onChange, format }: RangeSliderProps) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="flex flex-col gap-3">
      {/* Value label */}
      <div className="flex justify-between items-center">
        <span className="text-xs text-[#9A7A78]">{format(min)}</span>
        <span className="text-sm font-semibold text-[#D94040]">{format(value)}</span>
        <span className="text-xs text-[#9A7A78]">{format(max)}</span>
      </div>

      {/* Track + thumb */}
      <div className="relative h-6 flex items-center">
        {/* Track background */}
        <div className="absolute inset-x-0 h-1.5 rounded-full" style={{ background: "rgba(180,100,90,0.15)" }} />
        {/* Filled portion */}
        <div
          className="absolute left-0 h-1.5 rounded-full bg-[#D94040]"
          style={{ width: `${pct}%` }}
        />
        {/* Native range input (invisible but functional) */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
        />
        {/* Custom thumb */}
        <div
          className="absolute w-5 h-5 rounded-full bg-white shadow-lg pointer-events-none transition-transform"
          style={{ left: `calc(${pct}% - 10px)`, border: "2px solid #D94040" }}
        />
      </div>
    </div>
  );
}

// ─── Formatters ───────────────────────────────────────────────────────────────

export function formatDurationMins(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

export function formatReminderMins(mins: number): string {
  if (mins < 60) return `${mins} min before`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h before` : `${h}h ${m}min before`;
}
