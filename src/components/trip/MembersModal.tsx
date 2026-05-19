"use client";

import { useEffect, useRef, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db, COLLECTIONS } from "@/lib/firebase/firestore";
import { Avatar } from "@/components/ui/Avatar";
import type { UserDocument } from "@/types";

interface MembersModalProps {
  memberIds: string[];
  organizerUserId: string;
  /** Bounding rect of the trigger button, used to position the popover */
  anchorRect?: DOMRect;
  onClose: () => void;
}

interface MemberInfo {
  uid: string;
  displayName: string;
}

export function MembersModal({ memberIds, organizerUserId, anchorRect, onClose }: MembersModalProps) {
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  /* ── Keyboard close ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /* ── Click outside close ── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    // Delay so the opening click doesn't immediately close it
    const t = setTimeout(() => document.addEventListener("mousedown", handler), 50);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", handler); };
  }, [onClose]);

  /* ── Fetch members ── */
  useEffect(() => {
    async function fetchMembers() {
      setLoading(true);
      try {
        const results = await Promise.all(
          memberIds.map(async (uid) => {
            try {
              const snap = await getDoc(doc(db, COLLECTIONS.USERS, uid));
              const name = snap.exists()
                ? ((snap.data() as UserDocument).displayName ?? "Member")
                : "Member";
              return { uid, displayName: name };
            } catch {
              return { uid, displayName: "Member" };
            }
          }),
        );
        results.sort((a, b) => {
          if (a.uid === organizerUserId) return -1;
          if (b.uid === organizerUserId) return 1;
          return a.displayName.localeCompare(b.displayName);
        });
        setMembers(results);
      } finally {
        setLoading(false);
      }
    }
    fetchMembers();
  }, [memberIds, organizerUserId]);

  /* ── Compute popover position near anchor ── */
  const popoverStyle: React.CSSProperties = { position: "fixed", zIndex: 60 };
  if (anchorRect) {
    const PANEL_WIDTH = 220;
    const MARGIN = 8;
    // Horizontal: align right edge to anchor's right edge, but don't go off screen
    const right = Math.max(MARGIN, window.innerWidth - anchorRect.right);
    // Vertical: open below the anchor; if too close to bottom, open above
    const spaceBelow = window.innerHeight - anchorRect.bottom - MARGIN;
    if (spaceBelow > 120) {
      popoverStyle.top = anchorRect.bottom + MARGIN;
    } else {
      popoverStyle.bottom = window.innerHeight - anchorRect.top + MARGIN;
    }
    popoverStyle.right = right;
    popoverStyle.width = PANEL_WIDTH;
  } else {
    // Fallback: center on screen
    popoverStyle.top = "50%";
    popoverStyle.left = "50%";
    popoverStyle.transform = "translate(-50%, -50%)";
    popoverStyle.width = 240;
  }

  return (
    <>
      {/* Invisible click-outside catcher — no dark dim */}
      <div className="fixed inset-0 z-50" aria-hidden="true" onClick={onClose} />

      {/* Popover panel */}
      <div
        ref={panelRef}
        className="animate-fade-in rounded-2xl bg-white p-4 shadow-xl"
        style={{
          ...popoverStyle,
          zIndex: 60,
          border: "1px solid rgba(217,64,64,0.15)",
          boxShadow: "0 8px 32px rgba(120,60,50,0.18), 0 2px 8px rgba(0,0,0,0.06)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Group members"
      >
        {/* Coral top stripe */}
        <div className="absolute top-0 inset-x-0 h-[3px] rounded-t-2xl bg-[#D94040]" />

        {/* Header */}
        <div className="flex items-center justify-between mb-3 mt-0.5">
          <p className="text-xs font-semibold text-[#1E0E0B]">
            Your Group
            <span className="ml-1.5 text-[#9A7A78] font-normal">
              · {memberIds.length} {memberIds.length === 1 ? "traveller" : "travellers"}
            </span>
          </p>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#9A7A78] hover:text-[#D94040] transition-colors"
            aria-label="Close"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Loading skeletons */}
        {loading && (
          <div className="flex flex-col gap-2.5">
            {memberIds.map((uid) => (
              <div key={uid} className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#F5EDED] animate-pulse shrink-0" />
                <div className="h-3 w-24 bg-[#F5EDED] rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {/* Member list */}
        {!loading && (
          <ul className="flex flex-col gap-2.5">
            {members.map((m) => {
              const isOrganizer = m.uid === organizerUserId;
              return (
                <li key={m.uid} className="flex items-center gap-2.5">
                  <Avatar uid={m.uid} displayName={m.displayName} size={32} />
                  <span className="flex-1 text-sm font-medium text-[#1E0E0B] truncate leading-none">
                    {m.displayName}
                  </span>
                  {isOrganizer && (
                    <span className="text-base leading-none" title="Organizer">👑</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
