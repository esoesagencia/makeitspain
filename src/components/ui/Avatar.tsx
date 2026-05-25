"use client";

function hashUid(uid: string): number {
  let h = 5381;
  for (let i = 0; i < uid.length; i++) {
    h = ((h << 5) + h) ^ uid.charCodeAt(i);
    h = h >>> 0;
  }
  return h;
}

function getInitials(name?: string): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
}

// ─── Spanish decorative elements ──────────────────────────────────────────────
// Each returns SVG <g> children — rendered inside the main <svg viewBox="0 0 100 100">
// Elements are positioned as subtle background accents so initials stay dominant.

type Decor = (props: { a: string }) => React.ReactElement; // a = accent colour

// 1. Abanico (fan) — spreads across lower half
const Fan: Decor = ({ a }) => (
  <g opacity="0.38">
    <line x1="50" y1="88" x2="18" y2="42" stroke={a} strokeWidth="2.2" strokeLinecap="round"/>
    <line x1="50" y1="88" x2="28" y2="30" stroke={a} strokeWidth="2.2" strokeLinecap="round"/>
    <line x1="50" y1="88" x2="42" y2="24" stroke={a} strokeWidth="2.2" strokeLinecap="round"/>
    <line x1="50" y1="88" x2="58" y2="24" stroke={a} strokeWidth="2.2" strokeLinecap="round"/>
    <line x1="50" y1="88" x2="72" y2="30" stroke={a} strokeWidth="2.2" strokeLinecap="round"/>
    <line x1="50" y1="88" x2="82" y2="42" stroke={a} strokeWidth="2.2" strokeLinecap="round"/>
    <path d="M18,43 Q50,18 82,43" fill="none" stroke={a} strokeWidth="3" strokeLinecap="round"/>
    <path d="M24,56 Q50,36 76,56" fill="none" stroke={a} strokeWidth="2" strokeLinecap="round"/>
    <circle cx="50" cy="88" r="4" fill={a}/>
  </g>
);

// 2. Guitarra (guitar) — centred, text floats over it
const Guitar: Decor = ({ a }) => (
  <g opacity="0.32">
    {/* neck */}
    <rect x="46.5" y="12" width="7" height="32" rx="3" fill={a}/>
    {/* headstock */}
    <rect x="43" y="8" width="14" height="8" rx="3" fill={a}/>
    {/* upper bout */}
    <ellipse cx="50" cy="53" rx="13" ry="11" fill={a}/>
    {/* waist */}
    <rect x="44" y="60" width="12" height="6" fill={a}/>
    {/* lower bout */}
    <ellipse cx="50" cy="73" rx="16" ry="14" fill={a}/>
    {/* sound hole */}
    <circle cx="50" cy="71" r="5" fill="rgba(0,0,0,0.18)"/>
    {/* strings */}
    <line x1="50" y1="40" x2="50" y2="88" stroke="rgba(255,255,255,0.25)" strokeWidth="1"/>
  </g>
);

// 3. Rosa (rose) — blooms at bottom, stem up
const Rose: Decor = ({ a }) => (
  <g opacity="0.38">
    {/* stem */}
    <path d="M50,92 Q48,78 50,65" fill="none" stroke={a} strokeWidth="2.5" strokeLinecap="round"/>
    {/* leaf */}
    <path d="M50,78 Q38,68 36,58" fill={a}/>
    <path d="M50,82 Q62,72 64,62" fill={a} opacity="0.6"/>
    {/* outer petals */}
    <circle cx="50" cy="55" r="16" fill={a} opacity="0.45"/>
    <circle cx="38" cy="49" r="10" fill={a} opacity="0.5"/>
    <circle cx="62" cy="49" r="10" fill={a} opacity="0.5"/>
    <circle cx="34" cy="60" r="9"  fill={a} opacity="0.45"/>
    <circle cx="66" cy="60" r="9"  fill={a} opacity="0.45"/>
    {/* inner */}
    <circle cx="50" cy="52" r="9" fill={a} opacity="0.7"/>
    {/* centre */}
    <circle cx="50" cy="50" r="5" fill="rgba(0,0,0,0.15)"/>
  </g>
);

// 4. Sombrero cordobés — wide brim at bottom
const Sombrero: Decor = ({ a }) => (
  <g opacity="0.38">
    {/* brim */}
    <ellipse cx="50" cy="76" rx="38" ry="9" fill={a}/>
    {/* crown */}
    <path d="M18,76 Q20,46 50,44 Q80,46 82,76Z" fill={a} opacity="0.85"/>
    {/* band */}
    <path d="M22,74 Q50,66 78,74" fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="3"/>
    {/* brim edge highlight */}
    <ellipse cx="50" cy="84" rx="38" ry="4" fill={a} opacity="0.45"/>
  </g>
);

// 5. Mantilla (lace shawl draped over shoulders)
const Mantilla: Decor = ({ a }) => (
  <g opacity="0.35">
    {/* main drape */}
    <path d="M5,28 Q50,0 95,28 Q85,78 50,92 Q15,78 5,28Z" fill={a} opacity="0.28"/>
    {/* lace edge */}
    <path d="M5,28 Q50,0 95,28" fill="none" stroke={a} strokeWidth="2.5" strokeDasharray="4 3"/>
    <path d="M8,42 Q50,16 92,42" fill="none" stroke={a} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6"/>
    {/* fringe dots */}
    {([12,22,33,44,56,67,78,88] as number[]).map((x, i) => (
      <circle key={i} cx={x} cy={26 + Math.abs(x - 50) * 0.18} r="1.8" fill={a} opacity="0.6"/>
    ))}
  </g>
);

// 6. Palmera (palm tree) — off to the side
const Palm: Decor = ({ a }) => (
  <g opacity="0.38">
    {/* trunk — curves slightly */}
    <path d="M54,96 Q52,75 55,55 Q57,42 54,30" fill="none" stroke={a} strokeWidth="5" strokeLinecap="round"/>
    {/* fronds */}
    <path d="M54,30 Q36,18 20,26" fill="none" stroke={a} strokeWidth="3" strokeLinecap="round"/>
    <path d="M54,30 Q42,10 46,0"  fill="none" stroke={a} strokeWidth="3" strokeLinecap="round"/>
    <path d="M54,30 Q64,10 68,2"  fill="none" stroke={a} strokeWidth="3" strokeLinecap="round"/>
    <path d="M54,30 Q72,18 86,22" fill="none" stroke={a} strokeWidth="3" strokeLinecap="round"/>
    <path d="M54,30 Q74,28 88,36" fill="none" stroke={a} strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M54,30 Q28,32 14,40" fill="none" stroke={a} strokeWidth="2.5" strokeLinecap="round"/>
    {/* coconuts */}
    <circle cx="56" cy="34" r="3.5" fill={a} opacity="0.7"/>
    <circle cx="50" cy="32" r="3" fill={a} opacity="0.6"/>
  </g>
);

// 7. Castañuelas (castanets) — two shells below text
const Castanets: Decor = ({ a }) => (
  <g opacity="0.38">
    {/* cord/string */}
    <path d="M32,38 Q50,22 68,38" fill="none" stroke={a} strokeWidth="2" strokeLinecap="round"/>
    {/* left castanet — top shell */}
    <path d="M18,60 Q32,48 46,60" fill={a}/>
    <path d="M18,62 Q32,72 46,62" fill={a} opacity="0.7"/>
    <path d="M18,60 Q18,62 18,62 Q32,74 46,62 Q46,60 46,60 Q32,48 18,60Z" fill={a} opacity="0.5"/>
    {/* right castanet */}
    <path d="M54,60 Q68,48 82,60" fill={a}/>
    <path d="M54,62 Q68,72 82,62" fill={a} opacity="0.7"/>
    <path d="M54,60 Q54,62 54,62 Q68,74 82,62 Q82,60 82,60 Q68,48 54,60Z" fill={a} opacity="0.5"/>
    {/* knobs */}
    <circle cx="22" cy="58" r="3" fill={a} opacity="0.8"/>
    <circle cx="78" cy="58" r="3" fill={a} opacity="0.8"/>
  </g>
);

// 8. Toro (bull head & horns) — peering from below
const Bull: Decor = ({ a }) => (
  <g opacity="0.35">
    {/* horns */}
    <path d="M28,55 Q12,30 20,14" fill="none" stroke={a} strokeWidth="5" strokeLinecap="round"/>
    <path d="M72,55 Q88,30 80,14" fill="none" stroke={a} strokeWidth="5" strokeLinecap="round"/>
    {/* head */}
    <ellipse cx="50" cy="66" rx="26" ry="22" fill={a}/>
    {/* muzzle */}
    <ellipse cx="50" cy="78" rx="14" ry="9" fill={a} opacity="0.7"/>
    {/* nostrils */}
    <circle cx="44" cy="79" r="3" fill="rgba(0,0,0,0.2)"/>
    <circle cx="56" cy="79" r="3" fill="rgba(0,0,0,0.2)"/>
    {/* eyes */}
    <circle cx="38" cy="62" r="4" fill="rgba(0,0,0,0.25)"/>
    <circle cx="62" cy="62" r="4" fill="rgba(0,0,0,0.25)"/>
  </g>
);

// 9. Vestido flamenco (flamenco dress with ruffles)
const Flamenco: Decor = ({ a }) => (
  <g opacity="0.35">
    {/* skirt body */}
    <path d="M50,20 Q42,40 36,58 Q28,74 22,95 L78,95 Q72,74 64,58 Q58,40 50,20Z" fill={a} opacity="0.5"/>
    {/* ruffles */}
    <path d="M28,72 Q50,80 72,72" fill="none" stroke={a} strokeWidth="3.5" strokeLinecap="round"/>
    <path d="M24,82 Q50,92 76,82" fill="none" stroke={a} strokeWidth="3.5" strokeLinecap="round"/>
    <path d="M34,60 Q50,67 66,60" fill="none" stroke={a} strokeWidth="3" strokeLinecap="round"/>
    {/* waist */}
    <ellipse cx="50" cy="24" rx="8" ry="6" fill={a} opacity="0.7"/>
    {/* polka dots on skirt */}
    <circle cx="40" cy="50" r="2" fill="rgba(255,255,255,0.3)"/>
    <circle cx="60" cy="46" r="2" fill="rgba(255,255,255,0.3)"/>
    <circle cx="45" cy="65" r="2" fill="rgba(255,255,255,0.3)"/>
    <circle cx="58" cy="62" r="2" fill="rgba(255,255,255,0.3)"/>
  </g>
);

// 10. Azulejo (Moorish tile) — geometric backdrop
const Azulejo: Decor = ({ a }) => (
  <g opacity="0.30">
    {/* outer ring of petals */}
    <circle cx="50" cy="50" r="42" fill="none" stroke={a} strokeWidth="2"/>
    <circle cx="50" cy="50" r="30" fill="none" stroke={a} strokeWidth="1.5"/>
    <circle cx="50" cy="50" r="16" fill="none" stroke={a} strokeWidth="1.5"/>
    {/* diagonal cross */}
    <line x1="20" y1="20" x2="80" y2="80" stroke={a} strokeWidth="1.5"/>
    <line x1="80" y1="20" x2="20" y2="80" stroke={a} strokeWidth="1.5"/>
    {/* cardinal cross */}
    <line x1="50" y1="8"  x2="50" y2="92" stroke={a} strokeWidth="1.5"/>
    <line x1="8"  y1="50" x2="92" y2="50" stroke={a} strokeWidth="1.5"/>
    {/* corner medallions */}
    <circle cx="50" cy="8"  r="3.5" fill={a}/>
    <circle cx="50" cy="92" r="3.5" fill={a}/>
    <circle cx="8"  cy="50" r="3.5" fill={a}/>
    <circle cx="92" cy="50" r="3.5" fill={a}/>
    <circle cx="50" cy="50" r="5" fill={a} opacity="0.6"/>
  </g>
);

// ─── Registry ─────────────────────────────────────────────────────────────────

interface Entry {
  element: Decor;
  bg: string;      // circle background
  accent: string;  // decorative element colour
  textY: number;   // baseline y for initials (adjust per element layout)
}

const ELEMENTS: Entry[] = [
  { element: Fan,       bg: "#C83030", accent: "#F5C090", textY: 44 }, // text upper half, fan below
  { element: Guitar,    bg: "#B83228", accent: "#FAD8C0", textY: 52 }, // text over guitar
  { element: Rose,      bg: "#C04030", accent: "#FAD8C0", textY: 42 }, // text upper, rose blooms below
  { element: Sombrero,  bg: "#A82820", accent: "#F5C090", textY: 40 }, // text upper, hat at bottom
  { element: Mantilla,  bg: "#C83838", accent: "#FDE8D8", textY: 54 }, // text centred over drape
  { element: Palm,      bg: "#B83228", accent: "#D4AF37", textY: 60 }, // text lower, palm upper-right
  { element: Castanets, bg: "#D04040", accent: "#FAD8C0", textY: 42 }, // text upper, castanets below
  { element: Bull,      bg: "#902020", accent: "#F0A060", textY: 40 }, // text upper, bull peeks below
  { element: Flamenco,  bg: "#C04038", accent: "#FDE8D8", textY: 36 }, // text at top, dress fills lower
  { element: Azulejo,   bg: "#B03028", accent: "#F5C090", textY: 58 }, // text centred over tile
];

// ─── Avatar component ─────────────────────────────────────────────────────────

interface AvatarProps {
  uid: string;
  displayName?: string;
  size?: number;
  className?: string;
}

export function Avatar({ uid, displayName, size = 36, className = "" }: AvatarProps) {
  const { element: Element, bg, accent, textY } = ELEMENTS[hashUid(uid) % ELEMENTS.length];
  const initials  = getInitials(displayName);
  const fontSize  = initials.length === 1 ? 46 : 32;

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full shrink-0 select-none overflow-hidden ${className}`}
      style={{
        width: size,
        height: size,
        background: bg,
        boxShadow: "0 1px 6px rgba(120,20,20,0.22)",
        border: "1.5px solid rgba(255,255,255,0.15)",
      }}
      aria-hidden="true"
    >
      <span style={{ width: size, height: size, display: "flex" }}>
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
          {/* Background */}
          <rect width="100" height="100" fill={bg}/>

          {/* Spanish decorative element */}
          <Element a={accent}/>

          {/* Initials — shadow layer */}
          <text
            x="50" y={textY}
            textAnchor="middle"
            fontFamily="'Playfair Display', Georgia, 'Times New Roman', serif"
            fontWeight="700"
            fontSize={fontSize}
            fill="rgba(0,0,0,0.22)"
            dx="1" dy="1"
          >{initials}</text>

          {/* Initials — main */}
          <text
            x="50" y={textY}
            textAnchor="middle"
            fontFamily="'Playfair Display', Georgia, 'Times New Roman', serif"
            fontWeight="700"
            fontSize={fontSize}
            fill="white"
          >{initials}</text>
        </svg>
      </span>
    </span>
  );
}
