"use client";

function hashUid(uid: string): number {
  let h = 5381;
  for (let i = 0; i < uid.length; i++) {
    h = ((h << 5) + h) ^ uid.charCodeAt(i);
    h = h >>> 0;
  }
  return h;
}

// ─── Abstract geometric patterns ──────────────────────────────────────────────
// All viewBox="0 0 100 100". Clipped to a circle by the container.

function PatternDiamonds() {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#FDE0D8"/>
      <polygon points="50,2 98,50 50,98 2,50" fill="#D94040"/>
      <polygon points="50,26 74,50 50,74 26,50" fill="#E87030"/>
      <polygon points="50,40 60,50 50,60 40,50" fill="#FDE0D8"/>
    </svg>
  );
}

function PatternStripes() {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#D94040"/>
      <polygon points="-5,35 35,-5 55,-5 -5,55" fill="white" opacity="0.85"/>
      <polygon points="-5,75 75,-5 95,-5 -5,95" fill="white" opacity="0.85"/>
      <polygon points="45,105 105,45 105,65 65,105" fill="white" opacity="0.85"/>
      <polygon points="5,105 105,5 105,25 25,105" fill="#B83228" opacity="0.45"/>
      <polygon points="65,105 105,65 105,85 85,105" fill="#E87030" opacity="0.6"/>
    </svg>
  );
}

function PatternScales() {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#FDE8D8"/>
      <path d="M-2,38 Q24,4 50,38 L50,105 L-2,105Z" fill="#D94040"/>
      <path d="M50,38 Q76,4 102,38 L102,105 L50,105Z" fill="#B83228"/>
      <path d="M-26,72 Q0,38 26,72 L26,105 L-26,105Z" fill="#E87030"/>
      <path d="M26,72 Q52,38 78,72 L78,105 L26,105Z" fill="#D94040"/>
      <path d="M74,72 Q100,38 126,72 L126,105 L74,105Z" fill="#B83228"/>
    </svg>
  );
}

function PatternChevron() {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#FDE0D8"/>
      <polygon points="0,0 50,28 100,0 100,20 50,48 0,20" fill="#D94040"/>
      <polygon points="0,18 50,46 100,18 100,38 50,66 0,38" fill="#B83228"/>
      <polygon points="0,36 50,64 100,36 100,56 50,84 0,56" fill="#D94040"/>
      <polygon points="0,54 50,82 100,54 100,74 50,102 0,74" fill="#E87030"/>
    </svg>
  );
}

function PatternPinwheel() {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#FDE8D8"/>
      <path d="M50,50 L50,0 Q100,0 100,50Z" fill="#D94040"/>
      <path d="M50,50 L100,50 Q100,100 50,100Z" fill="#E87030"/>
      <path d="M50,50 L50,100 Q0,100 0,50Z" fill="#D94040"/>
      <path d="M50,50 L0,50 Q0,0 50,0Z" fill="#B83228"/>
      <circle cx="50" cy="50" r="15" fill="white"/>
      <circle cx="50" cy="50" r="7" fill="#D94040"/>
    </svg>
  );
}

function PatternMosaic() {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="34" height="34" fill="#D94040"/>
      <rect x="33" width="34" height="34" fill="#E87030"/>
      <rect x="66" width="34" height="34" fill="#B83228"/>
      <rect y="33" width="34" height="34" fill="#E05848"/>
      <rect x="33" y="33" width="34" height="34" fill="#FDE0D8"/>
      <rect x="66" y="33" width="34" height="34" fill="#D94040"/>
      <rect y="66" width="34" height="34" fill="#B83228"/>
      <rect x="33" y="66" width="34" height="34" fill="#D94040"/>
      <rect x="66" y="66" width="34" height="34" fill="#E87030"/>
    </svg>
  );
}

function PatternConcentric() {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="50" fill="#D94040"/>
      <circle cx="50" cy="50" r="40" fill="#FDE0D8"/>
      <circle cx="50" cy="50" r="30" fill="#B83228"/>
      <circle cx="50" cy="50" r="20" fill="#FDE0D8"/>
      <circle cx="50" cy="50" r="10" fill="#E87030"/>
    </svg>
  );
}

function PatternCross() {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#E87030"/>
      <rect width="38" height="38" fill="#B83228"/>
      <rect x="62" width="38" height="38" fill="#B83228"/>
      <rect y="62" width="38" height="38" fill="#B83228"/>
      <rect x="62" y="62" width="38" height="38" fill="#B83228"/>
      <rect x="30" width="40" height="100" fill="#FDE8D8"/>
      <rect y="30" width="100" height="40" fill="#FDE8D8"/>
      <circle cx="50" cy="50" r="13" fill="#D94040"/>
    </svg>
  );
}

function PatternWaves() {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#D94040"/>
      <path d="M-5,18 Q20,5 45,18 Q70,31 95,18 Q120,5 125,18 L125,38 Q100,51 75,38 Q50,25 25,38 Q0,51 -25,38Z" fill="#B83228"/>
      <path d="M-5,52 Q20,39 45,52 Q70,65 95,52 Q120,39 125,52 L125,72 Q100,85 75,72 Q50,59 25,72 Q0,85 -25,72Z" fill="#E87030"/>
      <path d="M-5,86 Q20,73 45,86 Q70,99 95,86 Q120,73 125,86 L125,106 Q100,119 75,106 Q50,93 25,106 Q0,119 -25,106Z" fill="#B83228"/>
    </svg>
  );
}

function PatternTriangles() {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#FDE8D8"/>
      <polygon points="0,50 25,0 50,50" fill="#D94040"/>
      <polygon points="50,50 75,0 100,50" fill="#B83228"/>
      <polygon points="25,0 50,50 75,0" fill="#E87030"/>
      <polygon points="0,100 25,50 50,100" fill="#E87030"/>
      <polygon points="50,100 75,50 100,100" fill="#D94040"/>
      <polygon points="25,50 50,100 75,50" fill="#B83228"/>
    </svg>
  );
}

// ─── Pattern registry ─────────────────────────────────────────────────────────

const PATTERNS: { component: () => React.ReactElement; bg: string }[] = [
  { component: PatternDiamonds,   bg: "#FDE0D8" },
  { component: PatternStripes,    bg: "#D94040" },
  { component: PatternScales,     bg: "#FDE8D8" },
  { component: PatternChevron,    bg: "#FDE0D8" },
  { component: PatternPinwheel,   bg: "#FDE8D8" },
  { component: PatternMosaic,     bg: "#E87030" },
  { component: PatternConcentric, bg: "#D94040" },
  { component: PatternCross,      bg: "#E87030" },
  { component: PatternWaves,      bg: "#D94040" },
  { component: PatternTriangles,  bg: "#FDE8D8" },
];

// ─── Avatar component ─────────────────────────────────────────────────────────

interface AvatarProps {
  uid: string;
  displayName?: string;
  size?: number;
  className?: string;
}

export function Avatar({ uid, size = 36, className = "" }: AvatarProps) {
  const { component: PatternSVG, bg } = PATTERNS[hashUid(uid) % PATTERNS.length];

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full shrink-0 select-none overflow-hidden ${className}`}
      style={{
        width: size,
        height: size,
        background: bg,
        boxShadow: "0 1px 6px rgba(180,50,40,0.15)",
        border: "1.5px solid rgba(217,64,64,0.15)",
      }}
      aria-hidden="true"
    >
      <span style={{ width: size, height: size, display: "flex" }}>
        <PatternSVG />
      </span>
    </span>
  );
}
