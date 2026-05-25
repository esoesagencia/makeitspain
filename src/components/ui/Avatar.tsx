"use client";

import { useId } from "react";

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

interface AvatarProps {
  uid: string;
  displayName?: string;
  size?: number;
  className?: string;
}

export function Avatar({ uid, displayName, size = 36, className = "" }: AvatarProps) {
  const reactId  = useId();
  const dotsFill = `dots${reactId.replace(/[^a-zA-Z0-9]/g, "")}`;

  const initials = getInitials(displayName);
  const fontSize = initials.length === 1 ? 54 : 36;
  // Baseline y so caps are visually centred — caps ≈ 72 % of em
  const textY    = initials.length === 1 ? 68  : 63;

  // Suppress unused-variable warning — hashUid kept for future per-user variation
  void hashUid(uid);

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full shrink-0 select-none overflow-hidden ${className}`}
      style={{
        width: size,
        height: size,
        background: "#4A0808",
        boxShadow: "0 1px 8px rgba(0,0,0,0.45)",
        border: "1.5px solid rgba(255,255,255,0.07)",
      }}
      aria-hidden="true"
    >
      <span style={{ width: size, height: size, display: "flex" }}>
        <svg
          viewBox="0 0 100 100"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: "100%", height: "100%" }}
        >
          <defs>
            {/* Coral-red base, black dots — tile 16 × 16, dot r 4.5 */}
            <pattern
              id={dotsFill}
              x="0" y="0"
              width="16" height="16"
              patternUnits="userSpaceOnUse"
            >
              <rect width="16" height="16" fill="#D94040"/>
              <circle cx="8" cy="8" r="4.5" fill="#0A0000"/>
            </pattern>
          </defs>

          {/* Dark red background */}
          <rect width="100" height="100" fill="#4A0808"/>

          {/* Subtle inner shadow ring for depth */}
          <circle
            cx="50" cy="50" r="49"
            fill="none"
            stroke="rgba(0,0,0,0.25)"
            strokeWidth="6"
          />

          {/* Drop shadow — offset dark copy of the letters */}
          <text
            x="51.5" y={textY + 2}
            textAnchor="middle"
            fontFamily="'Playfair Display', Georgia, 'Times New Roman', serif"
            fontWeight="700"
            fontSize={fontSize}
            fill="rgba(0,0,0,0.45)"
          >{initials}</text>

          {/* Polka-dot initials */}
          <text
            x="50" y={textY}
            textAnchor="middle"
            fontFamily="'Playfair Display', Georgia, 'Times New Roman', serif"
            fontWeight="700"
            fontSize={fontSize}
            fill={`url(#${dotsFill})`}
          >{initials}</text>
        </svg>
      </span>
    </span>
  );
}
