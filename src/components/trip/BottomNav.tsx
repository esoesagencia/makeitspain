"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";

export type TripTab = "plan" | "group" | "info";

interface BottomNavProps {
  tripId: string;
  currentTab: TripTab;
  onTabChange: (tab: "plan" | "info") => void;
}

interface TabDef {
  id: TripTab;
  label: string;
  icon: (active: boolean) => React.ReactNode;
}

const tabs: TabDef[] = [
  {
    id: "plan",
    label: "Trip Plan",
    icon: (active) => (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none"
        stroke={active ? "#D94040" : "#9A7A78"} strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
        <line x1="8" y1="14" x2="10" y2="14"/><line x1="8" y1="18" x2="14" y2="18"/>
      </svg>
    ),
  },
  {
    id: "group",
    label: "My Group",
    icon: (active) => (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none"
        stroke={active ? "#D94040" : "#9A7A78"} strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    id: "info",
    label: "Trip Info",
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 512 512" fill="none"
        stroke={active ? "#D94040" : "#9A7A78"}
        strokeWidth="26.624" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M204.055 213.905q-18.12-5.28-34.61-9a145.92 145.92 0 0 1-6.78-44.33c0-65.61 42.17-118.8 94.19-118.8 52.02 0 94.15 53.14 94.15 118.76a146.3 146.3 0 0 1-6.16 42.32q-20.52 4.3-43.72 11.05c-22 6.42-39.79 12.78-48.56 16.05-8.72-3.27-26.51-9.63-48.51-16.05zm-127.95 84.94a55.16 55.16 0 1 0 55.16 55.15 55.16 55.16 0 0 0-55.16-55.15zm359.79 0a55.16 55.16 0 1 0 55.16 55.15 55.16 55.16 0 0 0-55.15-55.15zm-71.15 55.15a71.24 71.24 0 0 1 42.26-65v-77.55c-64.49 0-154.44 35.64-154.44 35.64s-89.95-35.64-154.44-35.64v74.92a71.14 71.14 0 0 1 0 135.28v7c64.49 0 154.44 41.58 154.44 41.58s89.99-41.55 154.44-41.55v-9.68a71.24 71.24 0 0 1-42.26-65z"/>
      </svg>
    ),
  },
];

export function BottomNav({ tripId, currentTab, onTabChange }: BottomNavProps) {
  const router = useRouter();

  function handleTab(tab: TripTab) {
    if (tab === "plan") onTabChange("plan");
    else if (tab === "info") onTabChange("info");
    else if (tab === "group") router.push(`/trip/${tripId}/group`);
  }

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t"
      style={{
        borderColor: "rgba(180,100,90,0.12)",
        boxShadow: "0 -4px 20px rgba(120,60,50,0.06)",
        paddingBottom: "max(16px, env(safe-area-inset-bottom))",
      }}
      aria-label="Trip navigation"
    >
      <div className="flex items-stretch">
        {tabs.map((tab, idx) => {
          const active = currentTab === tab.id;
          const delay = `${0.05 + idx * 0.1}s`;
          return (
            <button
              key={tab.id}
              onClick={() => handleTab(tab.id)}
              aria-label={tab.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 pt-3 pb-1 min-h-[56px]",
                "transition-opacity duration-150 active:opacity-60 focus-visible:outline-none",
              )}
            >
              <span style={{ animation: `iconPop 0.55s ease both ${delay}`, display: "flex" }}>
                {tab.icon(active)}
              </span>
              <span
                className={cn("text-[10px] font-semibold tracking-wide",
                  active ? "text-[#D94040]" : "text-[#C4AAA8]")}
                style={{ animation: `iconPop 0.55s ease both ${delay}` }}
              >
                {tab.label}
              </span>
              <span className={cn("h-[2px] w-5 rounded-full transition-all duration-200",
                active ? "bg-[#D94040] opacity-100" : "opacity-0")} />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
