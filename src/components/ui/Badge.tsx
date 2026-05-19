import { cn } from "@/lib/utils/cn";
import type { TripStatus } from "@/types";

interface BadgeProps {
  status: TripStatus;
  className?: string;
  forceWhiteBg?: boolean;
}

const config: Record<TripStatus, { label: string; bg: string; text: string; dot: string }> = {
  active:    { label: "Active",    bg: "rgba(26,158,114,0.12)",  text: "#1A9E72", dot: "#1A9E72" },
  draft:     { label: "Upcoming",  bg: "rgba(217,64,64,0.1)",    text: "#D94040", dot: "#D94040" },
  completed: { label: "Completed", bg: "rgba(154,122,120,0.1)",  text: "#9A7A78", dot: "#9A7A78" },
};

export function Badge({ status, className, forceWhiteBg }: BadgeProps) {
  const c = config[status];
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", className)}
      style={{
        background: forceWhiteBg ? "white" : c.bg,
        color: c.text,
        border: `1px solid ${c.dot}${forceWhiteBg ? "60" : "30"}`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.dot }} />
      {c.label}
    </span>
  );
}
