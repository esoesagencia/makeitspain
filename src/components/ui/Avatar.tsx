"use client";

/** Deterministic avatar — cartoon animal SVGs in coral/orange palette */

function hashUid(uid: string): number {
  let h = 5381;
  for (let i = 0; i < uid.length; i++) {
    h = ((h << 5) + h) ^ uid.charCodeAt(i);
    h = h >>> 0;
  }
  return h;
}

// ─── Coral/orange palette ─────────────────────────────────────────────────────
// deep:    #B83228   coral dark
// mid:     #D94040   coral
// warm:    #E05848   coral mid
// orange:  #E87030   orange coral
// light:   #F0A060   light orange
// pale:    #F5C090   pale orange
// peach:   #FAD8C0   peach
// cream:   #FDE8D8   cream
// white:   #FFFFFF
// pupil:   #2A0808   dark brown-red

// ─── Animals ──────────────────────────────────────────────────────────────────

function Fox() {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      {/* Ears */}
      <polygon points="18,52 30,18 48,47" fill="#B83228"/>
      <polygon points="23,50 31,26 43,47" fill="#FAD8C0"/>
      <polygon points="82,52 70,18 52,47" fill="#B83228"/>
      <polygon points="77,50 69,26 57,47" fill="#FAD8C0"/>
      {/* Head */}
      <circle cx="50" cy="59" r="33" fill="#D94040"/>
      {/* Muzzle */}
      <ellipse cx="50" cy="71" rx="20" ry="15" fill="#FDE8D8"/>
      {/* Eyes */}
      <circle cx="37" cy="52" r="7" fill="white"/>
      <circle cx="63" cy="52" r="7" fill="white"/>
      <circle cx="38" cy="53" r="4" fill="#2A0808"/>
      <circle cx="64" cy="53" r="4" fill="#2A0808"/>
      <circle cx="40" cy="51" r="1.5" fill="white"/>
      <circle cx="66" cy="51" r="1.5" fill="white"/>
      {/* Nose */}
      <ellipse cx="50" cy="65" rx="4.5" ry="3.5" fill="#2A0808"/>
      <path d="M46,68 Q50,73 54,68" fill="none" stroke="#2A0808" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function Bear() {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      {/* Ears */}
      <circle cx="25" cy="30" r="17" fill="#B83228"/>
      <circle cx="75" cy="30" r="17" fill="#B83228"/>
      <circle cx="25" cy="30" r="10" fill="#E05848"/>
      <circle cx="75" cy="30" r="10" fill="#E05848"/>
      {/* Head */}
      <circle cx="50" cy="58" r="35" fill="#D94040"/>
      {/* Muzzle */}
      <ellipse cx="50" cy="71" rx="18" ry="13" fill="#F5C090"/>
      {/* Eyes */}
      <circle cx="37" cy="50" r="7" fill="white"/>
      <circle cx="63" cy="50" r="7" fill="white"/>
      <circle cx="37" cy="51" r="4.5" fill="#2A0808"/>
      <circle cx="63" cy="51" r="4.5" fill="#2A0808"/>
      <circle cx="39" cy="49" r="1.5" fill="white"/>
      <circle cx="65" cy="49" r="1.5" fill="white"/>
      {/* Nose */}
      <ellipse cx="50" cy="65" rx="5" ry="4" fill="#2A0808"/>
      <path d="M46,69 Q50,74 54,69" fill="none" stroke="#2A0808" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function Bunny() {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      {/* Ears */}
      <ellipse cx="34" cy="27" rx="11" ry="23" fill="#E05848"/>
      <ellipse cx="66" cy="27" rx="11" ry="23" fill="#E05848"/>
      <ellipse cx="34" cy="27" rx="6" ry="17" fill="#FAD8C0"/>
      <ellipse cx="66" cy="27" rx="6" ry="17" fill="#FAD8C0"/>
      {/* Head */}
      <circle cx="50" cy="62" r="32" fill="#F0A060"/>
      {/* Cheek blush */}
      <ellipse cx="33" cy="70" rx="9" ry="6" fill="#D94040" opacity="0.35"/>
      <ellipse cx="67" cy="70" rx="9" ry="6" fill="#D94040" opacity="0.35"/>
      {/* Eyes */}
      <circle cx="37" cy="55" r="7" fill="white"/>
      <circle cx="63" cy="55" r="7" fill="white"/>
      <circle cx="37" cy="56" r="4.5" fill="#2A0808"/>
      <circle cx="63" cy="56" r="4.5" fill="#2A0808"/>
      <circle cx="39" cy="54" r="1.5" fill="white"/>
      <circle cx="65" cy="54" r="1.5" fill="white"/>
      {/* Nose */}
      <ellipse cx="50" cy="67" rx="3.5" ry="2.5" fill="#B83228"/>
      <path d="M47,70 Q50,74 53,70" fill="none" stroke="#B83228" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

function Cat() {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      {/* Ears */}
      <polygon points="20,54 30,22 45,50" fill="#B83228"/>
      <polygon points="25,52 32,28 42,50" fill="#FAD8C0"/>
      <polygon points="80,54 70,22 55,50" fill="#B83228"/>
      <polygon points="75,52 68,28 58,50" fill="#FAD8C0"/>
      {/* Head */}
      <circle cx="50" cy="61" r="33" fill="#E05848"/>
      {/* Muzzle */}
      <ellipse cx="50" cy="72" rx="17" ry="12" fill="#FDE8D8"/>
      {/* Cheek blush */}
      <ellipse cx="33" cy="69" rx="8" ry="5" fill="#B83228" opacity="0.3"/>
      <ellipse cx="67" cy="69" rx="8" ry="5" fill="#B83228" opacity="0.3"/>
      {/* Eyes — amber to pop against red */}
      <ellipse cx="37" cy="55" rx="7" ry="7" fill="#F5C090"/>
      <ellipse cx="63" cy="55" rx="7" ry="7" fill="#F5C090"/>
      <ellipse cx="37" cy="55" rx="3" ry="6" fill="#2A0808"/>
      <ellipse cx="63" cy="55" rx="3" ry="6" fill="#2A0808"/>
      <circle cx="39" cy="53" r="1.3" fill="white"/>
      <circle cx="65" cy="53" r="1.3" fill="white"/>
      {/* Nose */}
      <polygon points="50,65 47,68 53,68" fill="#B83228"/>
      {/* Whiskers */}
      <line x1="18" y1="68" x2="40" y2="70" stroke="#FDE8D8" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="18" y1="72" x2="40" y2="72" stroke="#FDE8D8" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="82" y1="68" x2="60" y2="70" stroke="#FDE8D8" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="82" y1="72" x2="60" y2="72" stroke="#FDE8D8" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

function Dog() {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      {/* Floppy ears */}
      <ellipse cx="20" cy="62" rx="14" ry="22" fill="#B83228" transform="rotate(-15 20 62)"/>
      <ellipse cx="80" cy="62" rx="14" ry="22" fill="#B83228" transform="rotate(15 80 62)"/>
      {/* Head */}
      <circle cx="50" cy="56" r="34" fill="#E87030"/>
      {/* Muzzle */}
      <ellipse cx="50" cy="70" rx="18" ry="13" fill="#F5C090"/>
      {/* Eyes */}
      <circle cx="37" cy="49" r="7.5" fill="white"/>
      <circle cx="63" cy="49" r="7.5" fill="white"/>
      <circle cx="37" cy="50" r="5" fill="#2A0808"/>
      <circle cx="63" cy="50" r="5" fill="#2A0808"/>
      <circle cx="39" cy="48" r="1.8" fill="white"/>
      <circle cx="65" cy="48" r="1.8" fill="white"/>
      {/* Nose */}
      <ellipse cx="50" cy="64" rx="6.5" ry="5" fill="#2A0808"/>
      <ellipse cx="49" cy="63" rx="2" ry="1.5" fill="#6A2010" opacity="0.5"/>
      <path d="M45,69 Q50,75 55,69" fill="none" stroke="#2A0808" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="50" y1="69" x2="50" y2="75" stroke="#2A0808" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function Penguin() {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      {/* Body */}
      <ellipse cx="50" cy="58" rx="34" ry="38" fill="#B83228"/>
      {/* Belly */}
      <ellipse cx="50" cy="62" rx="22" ry="28" fill="#FDE8D8"/>
      {/* Eyes */}
      <circle cx="37" cy="46" r="8.5" fill="white"/>
      <circle cx="63" cy="46" r="8.5" fill="white"/>
      <circle cx="38" cy="47" r="5.5" fill="#2A0808"/>
      <circle cx="64" cy="47" r="5.5" fill="#2A0808"/>
      <circle cx="40" cy="45" r="2" fill="white"/>
      <circle cx="66" cy="45" r="2" fill="white"/>
      {/* Beak */}
      <polygon points="50,58 44,64 56,64" fill="#E87030"/>
      {/* Cheek blush */}
      <ellipse cx="31" cy="58" rx="7" ry="5" fill="#E05848" opacity="0.4"/>
      <ellipse cx="69" cy="58" rx="7" ry="5" fill="#E05848" opacity="0.4"/>
    </svg>
  );
}

function Lion() {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      {/* Mane */}
      <circle cx="50" cy="54" r="42" fill="#B83228"/>
      {/* Ears */}
      <circle cx="23" cy="30" r="10" fill="#D94040"/>
      <circle cx="77" cy="30" r="10" fill="#D94040"/>
      <circle cx="23" cy="30" r="6" fill="#F0A060"/>
      <circle cx="77" cy="30" r="6" fill="#F0A060"/>
      {/* Face */}
      <circle cx="50" cy="56" r="29" fill="#E87030"/>
      {/* Muzzle */}
      <ellipse cx="50" cy="68" rx="16" ry="11" fill="#F5C090"/>
      {/* Eyes */}
      <circle cx="39" cy="51" r="7" fill="#FDE8D8"/>
      <circle cx="61" cy="51" r="7" fill="#FDE8D8"/>
      <circle cx="39" cy="51" r="4.5" fill="#2A0808"/>
      <circle cx="61" cy="51" r="4.5" fill="#2A0808"/>
      <circle cx="41" cy="49" r="1.7" fill="white"/>
      <circle cx="63" cy="49" r="1.7" fill="white"/>
      {/* Nose */}
      <ellipse cx="50" cy="63" rx="4.5" ry="3.5" fill="#2A0808"/>
      <path d="M46,67 Q50,71 54,67" fill="none" stroke="#2A0808" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Whisker dots */}
      <circle cx="33" cy="66" r="1.3" fill="#D94040"/>
      <circle cx="38" cy="68" r="1.3" fill="#D94040"/>
      <circle cx="67" cy="66" r="1.3" fill="#D94040"/>
      <circle cx="62" cy="68" r="1.3" fill="#D94040"/>
    </svg>
  );
}

function Panda() {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      {/* Ears */}
      <circle cx="24" cy="27" r="17" fill="#B83228"/>
      <circle cx="76" cy="27" r="17" fill="#B83228"/>
      {/* Head */}
      <circle cx="50" cy="58" r="36" fill="#FDE8D8"/>
      {/* Eye patches */}
      <ellipse cx="36" cy="52" rx="13" ry="12" fill="#D94040" transform="rotate(-15 36 52)"/>
      <ellipse cx="64" cy="52" rx="13" ry="12" fill="#D94040" transform="rotate(15 64 52)"/>
      {/* Eyes */}
      <circle cx="36" cy="52" r="6.5" fill="white"/>
      <circle cx="64" cy="52" r="6.5" fill="white"/>
      <circle cx="36" cy="53" r="4.5" fill="#2A0808"/>
      <circle cx="64" cy="53" r="4.5" fill="#2A0808"/>
      <circle cx="38" cy="51" r="1.7" fill="white"/>
      <circle cx="66" cy="51" r="1.7" fill="white"/>
      {/* Muzzle */}
      <ellipse cx="50" cy="70" rx="14" ry="10" fill="#FAD8C0"/>
      {/* Nose */}
      <ellipse cx="50" cy="65" rx="4.5" ry="3.5" fill="#B83228"/>
      <path d="M46,69 Q50,74 54,69" fill="none" stroke="#B83228" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function Owl() {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      {/* Ear tufts */}
      <polygon points="30,38 23,14 40,34" fill="#B83228"/>
      <polygon points="70,38 77,14 60,34" fill="#B83228"/>
      {/* Body */}
      <ellipse cx="50" cy="60" rx="35" ry="37" fill="#D94040"/>
      {/* Face disc */}
      <ellipse cx="50" cy="60" rx="27" ry="29" fill="#E87030"/>
      {/* Big eyes */}
      <circle cx="37" cy="53" r="13" fill="#FDE8D8"/>
      <circle cx="63" cy="53" r="13" fill="#FDE8D8"/>
      <circle cx="37" cy="53" r="10" fill="#F5C090"/>
      <circle cx="63" cy="53" r="10" fill="#F5C090"/>
      <circle cx="37" cy="53" r="6.5" fill="#2A0808"/>
      <circle cx="63" cy="53" r="6.5" fill="#2A0808"/>
      <circle cx="40" cy="50" r="2.5" fill="white"/>
      <circle cx="66" cy="50" r="2.5" fill="white"/>
      {/* Beak */}
      <polygon points="50,59 45,66 55,66" fill="#E87030"/>
    </svg>
  );
}

function Deer() {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      {/* Antlers */}
      <path d="M34,38 Q24,22 18,10 M24,22 Q32,18 30,28 M18,10 Q26,16 28,10" fill="none" stroke="#B83228" strokeWidth="3.5" strokeLinecap="round"/>
      <path d="M66,38 Q76,22 82,10 M76,22 Q68,18 70,28 M82,10 Q74,16 72,10" fill="none" stroke="#B83228" strokeWidth="3.5" strokeLinecap="round"/>
      {/* Ears */}
      <ellipse cx="23" cy="47" rx="12" ry="9" fill="#D94040" transform="rotate(-25 23 47)"/>
      <ellipse cx="77" cy="47" rx="12" ry="9" fill="#D94040" transform="rotate(25 77 47)"/>
      <ellipse cx="23" cy="47" rx="7" ry="5" fill="#FAD8C0" transform="rotate(-25 23 47)"/>
      <ellipse cx="77" cy="47" rx="7" ry="5" fill="#FAD8C0" transform="rotate(25 77 47)"/>
      {/* Head */}
      <ellipse cx="50" cy="62" rx="28" ry="31" fill="#E87030"/>
      {/* Muzzle */}
      <ellipse cx="50" cy="74" rx="15" ry="11" fill="#F5C090"/>
      {/* Eyes */}
      <circle cx="38" cy="56" r="7.5" fill="white"/>
      <circle cx="62" cy="56" r="7.5" fill="white"/>
      <circle cx="38" cy="57" r="5" fill="#2A0808"/>
      <circle cx="62" cy="57" r="5" fill="#2A0808"/>
      <circle cx="40" cy="55" r="1.8" fill="white"/>
      <circle cx="64" cy="55" r="1.8" fill="white"/>
      {/* Nose */}
      <ellipse cx="50" cy="70" rx="4" ry="3" fill="#B83228"/>
      <path d="M47,73 Q50,77 53,73" fill="none" stroke="#B83228" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}

// ─── Animal registry ──────────────────────────────────────────────────────────

const ANIMALS: { component: () => React.ReactElement; bg: string }[] = [
  { component: Fox,     bg: "#FDE0D8" },
  { component: Bear,    bg: "#FDDAD5" },
  { component: Bunny,   bg: "#FDE8E0" },
  { component: Cat,     bg: "#FDD8D0" },
  { component: Dog,     bg: "#FDE4D8" },
  { component: Penguin, bg: "#FDDAD5" },
  { component: Lion,    bg: "#FDE0D5" },
  { component: Panda,   bg: "#FDE8E4" },
  { component: Owl,     bg: "#FDD8CC" },
  { component: Deer,    bg: "#FDE4DC" },
];

// ─── Avatar component ─────────────────────────────────────────────────────────

interface AvatarProps {
  uid: string;
  displayName?: string;
  size?: number;
  className?: string;
}

export function Avatar({ uid, size = 36, className = "" }: AvatarProps) {
  const { component: AnimalSVG, bg } = ANIMALS[hashUid(uid) % ANIMALS.length];

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
      <span style={{ width: size * 0.88, height: size * 0.88, display: "flex" }}>
        <AnimalSVG />
      </span>
    </span>
  );
}
