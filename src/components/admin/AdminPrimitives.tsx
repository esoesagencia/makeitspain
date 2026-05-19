import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

const inputBase =
  "w-full rounded-[8px] border px-3 text-sm text-[#1E0E0B] " +
  "bg-white placeholder:text-[#9A7A78]/60 transition-colors " +
  "focus:outline-none focus:ring-2 focus:ring-[#D94040] focus:border-transparent " +
  "disabled:opacity-40";

const borderColor = "border-[rgba(180,100,90,0.2)]";

export function AField({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label className="text-[10px] font-semibold uppercase tracking-widest text-[#9A7A78]">{label}</label>
      {children}
    </div>
  );
}

export function AInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputBase, borderColor, "h-9", className)} {...props} />;
}

export function ATextarea({ className, rows = 3, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={rows}
      className={cn(inputBase, borderColor, "py-2 resize-none leading-relaxed", className)}
      {...props}
    />
  );
}

export function ASelect({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(inputBase, borderColor, "h-9 cursor-pointer", className)} {...props}>
      {children}
    </select>
  );
}

export function AToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200",
        checked ? "bg-[#D94040]" : "bg-[rgba(180,100,90,0.2)]",
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200",
          checked ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}

export function ADivider() {
  return <div className="border-t border-[rgba(180,100,90,0.1)] my-1" />;
}
