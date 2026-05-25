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
  photoUrl?: string | null;
  size?: number;
  className?: string;
}

export function Avatar({ uid, displayName, photoUrl, size = 36, className = "" }: AvatarProps) {
  const reactId  = useId();
  const dotsFill = `dots${reactId.replace(/[^a-zA-Z0-9]/g, "")}`;

  const initials = getInitials(displayName);
  const fontSize = initials.length === 1 ? 54 : 36;
  const textY    = initials.length === 1 ? 68  : 63;

  void hashUid(uid);

  // If admin uploaded a custom photo, show it
  if (photoUrl) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full shrink-0 select-none overflow-hidden ${className}`}
        style={{
          width: size,
          height: size,
          boxShadow: "0 1px 8px rgba(0,0,0,0.25)",
          border: "1.5px solid rgba(0,0,0,0.12)",
        }}
        aria-hidden="true"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrl} alt="" style={{ width: size, height: size, objectFit: "cover" }} />
      </span>
    );
  }

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
            <pattern
              id={dotsFill}
              x="0" y="0"
              width="24" height="24"
              patternUnits="userSpaceOnUse"
            >
              <rect width="24" height="24" fill="#D94040"/>
              <circle cx="12" cy="12" r="8" fill="#0A0000"/>
            </pattern>
          </defs>

          <rect width="100" height="100" fill={`url(#${dotsFill})`}/>

          <circle cx="50" cy="50" r="49" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="6"/>

          <text x="51.5" y={textY + 2} textAnchor="middle"
            fontFamily="'Playfair Display', Georgia, 'Times New Roman', serif"
            fontWeight="700" fontSize={fontSize} fill="rgba(0,0,0,0.35)"
          >{initials}</text>

          <text x="50" y={textY} textAnchor="middle"
            fontFamily="'Playfair Display', Georgia, 'Times New Roman', serif"
            fontWeight="700" fontSize={fontSize} fill="#F5A623"
          >{initials}</text>
        </svg>
      </span>
    </span>
  );
}
