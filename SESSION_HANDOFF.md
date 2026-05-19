# MakeItSpain Admin — Session Handoff

## Project

**Path:** `/Users/yuliadirsha/Desktop/makeitspain-app`  
**Stack:** Next.js 15 App Router, Firebase Firestore, TypeScript, Tailwind CSS  
**Key colour:** coral-red `#D94040`, background `#F5EDED`  
**Timezone:** always `"Europe/Madrid"` (constant `SPAIN`)

---

## What was built in this session

### 1. Google Places Autocomplete (DONE ✅)

**New file:** `src/components/admin/PlacesInput.tsx`

A reusable autocomplete input that:
- Uses `@react-google-maps/api` (`useLoadScript` + `AutocompleteService` + `PlacesService`)
- Spain-only suggestions: `componentRestrictions: { country: "es" }`
- `searchType: "establishment"` → venue/restaurant search, `types: ["establishment"]`
- `searchType: "address"` → address search, `types: ["geocode"]`  
  ⚠️ Google only allows ONE collection type at a time — never use `["address", "establishment"]` together
- Dropdown rendered via `createPortal(…, document.body)` with `position: fixed` so it escapes `overflow:hidden` parent cards
- Repositions on scroll/resize; closes on outside click
- 300 ms debounce, session tokens for billing, keyboard navigation (↑↓ Enter Esc)
- Props: `value`, `onChange`, `onPlaceSelected(details: { name, address })`, `searchType`, `placeholder`, `required`

**Used in two places:**

**A. `src/components/admin/ActivityForm.tsx`** (the add/edit modal)
- Place field: `searchType="establishment"` → when a venue is picked, `setForm` updates BOTH `place` (venue name) AND `address` (formatted address) at once
- Address field: `searchType="address"` → only updates `address`

**B. `src/app/admin/trip/[tripId]/page.tsx`** (inline card editing via `InlinePlacesField`)
- `InlinePlacesField` is a click-to-edit component inside `SortableActivityRow`
- Place field: `onPlacePicked(name, address)` calls `updateDoc` with `{ place: name, address }` in one write
- Address field: `onSave` calls `updateDoc` with `{ address: value }`

---

### 2. Badge label changes (DONE ✅)

In `src/app/admin/trip/[tripId]/page.tsx`:
- `"Accom. Night"` → `"Hotel/Accom. Night"`
- `"Hotel Morning"` → `"Hotel/Accom. Morning"`

---

### 3. Day Progress Bar (PARTIALLY DONE — HAS A BUG)

**What it is:** Each day header in the activities list has a horizontal bar with a coral fill and a sun/moon/sunrise icon that travels left→right as the user scrolls through that day's activity cards.

**Current state of the code (as of end of session):**

Located at the bottom of `src/app/admin/trip/[tripId]/page.tsx` (~line 1800 onwards):

```
// Constants still present (should be removed):
const BAR_START = 240
const BAR_END   = 1560
const BAR_SPAN  = 1320
const ICON_PX   = 22
const TIME_MARKS = [ ... ] // 12 hour-mark entries — REMOVE THESE

// Function signature (correct):
function DayProgressBar({ dayKey, dayFirstMins }: { ... })

// Inside — BUGGY:
const [progressMins, setProgressMins] = useState<number>(dayFirstMins); // ← starts at non-zero position
requestAnimationFrame(handleScroll); // ← causes jump for Day 2+
// TIME_MARKS rendered in JSX (should be removed)
// Icon position mapped to fixed 04:00-02:00 absolute range (wrong)
```

**The three bugs the user reported:**
1. **Subsequent days continue from where previous day left off** — because `progressMins` starts at `dayFirstMins` (e.g. 08:00 = 18% along the bar) instead of 0%
2. **Jumps at start** — `requestAnimationFrame(handleScroll)` fires immediately and counts Day 2 cards already in viewport
3. **Time numbers visible** — `TIME_MARKS` renders hour labels below the bar (user wants them removed)

**Supporting data in the IIFE (correct, keep these):**

Around line 1606 in the activities render loop:
```tsx
const toMins = (ts) => { /* Madrid hours×60 + mins */ };
const adjMins = (ts) => { const raw = toMins(ts); return raw < 240 ? raw + 1440 : raw; };
// adjMins maps past-midnight activities (00:00–04:00) → 1440–1560 range

const dayFirstMinsMap = new Map<string, number>();
// stores earliest adjMins per day-key
```

Activity card wrappers (correct, keep these):
```tsx
<div
  data-day-key={dateKey}
  data-start-mins={String(startMins)}   // startMins = adjMins(activity.startTime)
  data-activity-id={activity.id}
>
```

Day header JSX (correct, keep this):
```tsx
<DayProgressBar
  dayKey={captureDateKey}
  dayFirstMins={dayFirstMinsMap.get(captureDateKey) ?? 8 * 60}
/>
```

The sticky day header div does NOT yet have a `data-day-header-key` attribute (needed for the fix below).

---

## 🚨 PENDING TASK — Fix DayProgressBar

This is the task left unfinished. The user wants:
- ✅ Remove time numbers and tick marks from the bar
- ✅ Each day's bar starts at 0% (left edge) — not at the first activity's clock position
- ✅ Bar only starts filling when that day's header is at the top (sticky) and you scroll into it
- ✅ Smooth animation without jumps between days

### The correct implementation approach

**Core idea:** Use document-scroll-position maths rather than "which cards are above a viewport reference line." This gives a fill that is truly 0 when you first arrive at a day, and 100% when you've scrolled past all its cards — with no jumps.

**Step 1** — Add `data-day-header-key` to the sticky day header div:

```tsx
<div
  key={`day-${dateKey}`}
  data-day-header-key={captureDateKey}           // ← ADD THIS
  className="sticky z-10 flex items-center gap-3 -mx-5 px-5 bg-white"
  style={{ top: 64, paddingTop: 28, paddingBottom: 28, ... }}
>
```

**Step 2** — Replace the entire `DayProgressBar` function (and remove `BAR_START`, `BAR_END`, `BAR_SPAN`, `TIME_MARKS` constants) with:

```tsx
const ICON_PX = 22;

function DayProgressBar({ dayKey, dayFirstMins }: {
  dayKey: string;
  dayFirstMins: number; // adj-mins of earliest activity — used only for initial icon type
}) {
  const [fillPct, setFillPct]         = useState(0);
  const [currentMins, setCurrentMins] = useState(dayFirstMins);

  useEffect(() => {
    function getEls() {
      return Array.from(
        document.querySelectorAll(`[data-day-key="${dayKey}"]`)
      ) as HTMLElement[];
    }

    function handleScroll() {
      const els = getEls();
      if (els.length === 0) return;

      const firstEl = els[0];
      const lastEl  = els[els.length - 1];

      // Document-absolute positions (constant regardless of scrollY)
      const firstDocTop    = firstEl.getBoundingClientRect().top + window.scrollY;
      const lastDocBottom  = lastEl.getBoundingClientRect().bottom + window.scrollY;

      // Height of the sticky day header (dynamic, typically ~80px)
      const headerEl = document.querySelector(
        `[data-day-header-key="${dayKey}"]`
      ) as HTMLElement | null;
      const headerH = headerEl?.offsetHeight ?? 80;

      // scrollY at which this day's header first sticks to top
      const STICKY_TOP   = 64; // matches `top: 64` on sticky div
      const dayStartScrollY = firstDocTop - STICKY_TOP - headerH;

      // scrollY at which the last card's midpoint reaches viewport mid
      const viewportMid    = window.innerHeight * 0.5;
      const dayEndScrollY  = lastDocBottom - viewportMid;

      const range = Math.max(1, dayEndScrollY - dayStartScrollY);
      const frac  = Math.min(1, Math.max(0, (window.scrollY - dayStartScrollY) / range));
      setFillPct(frac * 100);

      // Icon type: time of the most recent card whose top is above viewport mid
      let maxMins = dayFirstMins;
      for (const el of els) {
        if (el.getBoundingClientRect().top <= viewportMid) {
          const m = Number(el.getAttribute("data-start-mins") ?? "0");
          if (m > maxMins) maxMins = m;
        }
      }
      setCurrentMins(maxMins);
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // safe to call immediately — formula gives 0% for days not yet reached
    return () => window.removeEventListener("scroll", handleScroll);
  }, [dayKey, dayFirstMins]);

  // Icon type (sunrise before 07:00, sun 07:00-21:00, moon after 21:00)
  const showSunrise = currentMins <  420;
  const showSun     = currentMins >= 420 && currentMins < 1260;
  const showMoon    = currentMins >= 1260;

  const iconLeft = `clamp(0px, calc(${fillPct}% - ${ICON_PX / 2}px), calc(100% - ${ICON_PX}px))`;

  return (
    <div className="flex-1 relative" style={{ height: 34, minWidth: 40 }}>
      {/* Track */}
      <div className="absolute rounded-full"
        style={{ left: 0, right: 0, bottom: 3, height: 3, background: "rgba(180,100,90,0.12)" }}
      />
      {/* Fill */}
      <div className="absolute rounded-full"
        style={{
          left: 0, bottom: 3, height: 3,
          width: `${fillPct}%`,
          background: "#D94040",
          transition: "width 0.7s cubic-bezier(0.4,0,0.2,1)",
        }}
      />
      {/* Floating icon */}
      <div style={{
        position: "absolute",
        left: iconLeft,
        bottom: 10,
        width: ICON_PX, height: ICON_PX,
        transition: "left 0.7s cubic-bezier(0.4,0,0.2,1)",
        color: "#D94040",
      }}>
        <span style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center",
          opacity: showSunrise ? 1 : 0, transform: showSunrise ? "scale(1)" : "scale(0.5)",
          transition: "opacity 0.55s ease, transform 0.55s ease" }}>
          <SunriseProgressIcon size={ICON_PX} />
        </span>
        <span style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center",
          opacity: showSun ? 1 : 0, transform: showSun ? "scale(1)" : "scale(0.5)",
          transition: "opacity 0.55s ease, transform 0.55s ease" }}>
          <SunProgressIcon size={ICON_PX} />
        </span>
        <span style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center",
          opacity: showMoon ? 1 : 0, transform: showMoon ? "scale(1)" : "scale(0.5)",
          transition: "opacity 0.55s ease, transform 0.55s ease" }}>
          <MoonProgressIcon size={ICON_PX} />
        </span>
      </div>
    </div>
  );
}
```

**Why this works (no jumps):**

`dayStartScrollY = firstCardDocTop - STICKY_TOP - headerH`  
At page top (scrollY=0), this formula gives `(0 - dayStartScrollY) / range < 0` → clamped to 0% for all days except Day 1 when scrollY=0 gives exactly 0% for Day 1.  
When you scroll to Day N, scrollY reaches `dayStartScrollY` → frac = 0 (bar starts at 0%).  
As you continue scrolling, frac increases linearly → smooth fill with no card-crossing jumps.

**What to keep (don't touch):**
- `SunriseProgressIcon`, `SunProgressIcon`, `MoonProgressIcon` functions — correct SVG icons
- `data-day-key`, `data-start-mins`, `data-activity-id` attributes on card wrappers
- `adjMins`, `toMins`, `dayFirstMinsMap` in the IIFE render loop
- `InlinePlacesField` component
- `PlacesInput` import and usage everywhere

---

## File map (key files only)

| File | Purpose |
|------|---------|
| `src/app/admin/trip/[tripId]/page.tsx` | Main admin trip page — 2087 lines. Contains `DayProgressBar`, `InlinePlacesField`, `SortableActivityRow`, `TransferCard`, the big IIFE render loop |
| `src/app/admin/page.tsx` | Admin trips list page (trip table, create/duplicate/delete) |
| `src/components/admin/PlacesInput.tsx` | Google Places autocomplete (portal-based dropdown) |
| `src/components/admin/ActivityForm.tsx` | Add/edit activity modal — uses `PlacesInput` for Place + Address fields |
| `src/components/admin/AccommodationSection.tsx` | Accommodation management section |
| `src/components/admin/TripForm.tsx` | Create/edit trip modal |
| `src/lib/firebase/firestore.ts` | `db`, `COLLECTIONS`, `SUBCOLLECTIONS` exports |
| `src/lib/utils/adminDatetime.ts` | `parseMadridDate`, `tsToDateInput`, `tsToHHMM` helpers |
| `firestore.rules` | Security rules — admins can write everything; members can read their trips |

---

## Environment / dependencies

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in `.env.local` — needed for PlacesInput
- `@react-google-maps/api` v2.20.8 — `useLoadScript`
- `@types/google.maps` — installed, provides `google.maps.*` types
- `@dnd-kit/core`, `@dnd-kit/sortable` — drag-and-drop for activity cards
- TypeScript compiles clean: `node /Users/yuliadirsha/Desktop/makeitspain-app/node_modules/typescript/bin/tsc --noEmit --project /Users/yuliadirsha/Desktop/makeitspain-app/tsconfig.json`

---

## Quick reference — common patterns

**Save a single field on an activity card:**
```ts
await updateDoc(
  doc(collection(db, COLLECTIONS.TRIPS, tripId, SUBCOLLECTIONS.ACTIVITIES), activity.id),
  { fieldName: value }
);
```

**adjMins helper (inside the IIFE render loop):**
```ts
const adjMins = (ts: { toDate(): Date }) => {
  const raw = toMins(ts);
  return raw < 4 * 60 ? raw + 1440 : raw;
};
// raw < 240 → past midnight → maps to 1440–1680 on the 04:00–02:00 ruler
```

**Activity categories:** `activity | transfer | meal | free_time | surprise | hotel | sleep_in_hotel`

**Hotel logic:**
- `hotel` category + `estimatedDuration === 0` = "Hotel/Accom. Morning" placeholder (timeless)
- `sleep_in_hotel` = night entry
- `isHotelMorning(a)` helper function exists in the file
