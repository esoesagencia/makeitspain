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
        background: "#D94040",
        boxShadow: "0 1px 8px rgba(0,0,0,0.35)",
        border: "1.5px solid rgba(0,0,0,0.15)",
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
            {/*
              Non-square tile (48 × 44) with 6 dots of varying sizes at
              irregular positions — breaks up the grid feel and reads as
              organic / hand-scattered polka dots.
            */}
            <pattern
              id={dotsFill}
              x="0" y="0"
              width="48" height="44"
              patternUnits="userSpaceOnUse"
            >
              <rect width="48" height="44" fill="#D94040"/>
              <circle cx="9"  cy="10" r="8.5" fill="#0A0000"/>
              <circle cx="33" cy="7"  r="7"   fill="#0A0000"/>
              <circle cx="21" cy="27" r="10"  fill="#0A0000"/>
              <circle cx="44" cy="29" r="6"   fill="#0A0000"/>
              <circle cx="7"  cy="38" r="7.5" fill="#0A0000"/>
              <circle cx="37" cy="39" r="8"   fill="#0A0000"/>
            </pattern>
          </defs>

          {/* Polka-dot background */}
          <rect width="100" height="100" fill={`url(#${dotsFill})`}/>

          {/* Subtle inner shadow ring for depth */}
          <circle
            cx="50" cy="50" r="49"
            fill="none"
            stroke="rgba(0,0,0,0.2)"
            strokeWidth="6"
          />

          {/* Drop shadow — offset dark copy of the letters */}
          <text
            x="51.5" y={textY + 2}
            textAnchor="middle"
            fontFamily="'Playfair Display', Georgia, 'Times New Roman', serif"
            fontWeight="700"
            fontSize={fontSize}
            fill="rgba(0,0,0,0.35)"
          >{initials}</text>

          {/* Yellow-orange initials */}
          <text
            x="50" y={textY}
            textAnchor="middle"
            fontFamily="'Playfair Display', Georgia, 'Times New Roman', serif"
            fontWeight="700"
            fontSize={fontSize}
            fill="#F5A623"
          >{initials}</text>
        </svg>
      </span>
    </span>
  );
}
