"use client";

import { useEffect, useRef, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db, COLLECTIONS } from "@/lib/firebase/firestore";
import { uploadMemberAvatar } from "@/lib/firebase/storage";
import { Avatar } from "@/components/ui/Avatar";
import type { UserDocument } from "@/types";

interface MemberWithId extends UserDocument {
  uid: string;
}

interface TripMembersSectionProps {
  memberIds: string[];
}

export function TripMembersSection({ memberIds }: TripMembersSectionProps) {
  const [members, setMembers] = useState<MemberWithId[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (memberIds.length === 0) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        memberIds.map(async (uid) => {
          const snap = await getDoc(doc(db!, COLLECTIONS.USERS, uid));
          if (!snap.exists()) return null;
          return { uid, ...(snap.data() as Omit<UserDocument, "uid">) } as MemberWithId;
        })
      );
      if (!cancelled) {
        setMembers(results.filter((m): m is MemberWithId => m !== null));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [memberIds]);

  function handleMemberUpdate(uid: string, patch: Partial<UserDocument>) {
    setMembers((prev) => prev.map((m) => m.uid === uid ? { ...m, ...patch } : m));
  }

  return (
    <section className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(217,64,64,0.15)" }}>
      {/* Header */}
      <div className="px-5 py-3 flex items-center gap-2"
        style={{ background: "linear-gradient(135deg, rgba(217,64,64,0.08) 0%, rgba(232,112,48,0.05) 100%)", borderBottom: "1px solid rgba(217,64,64,0.1)" }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D94040" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        <span className="text-sm font-semibold" style={{ color: "#D94040" }}>Trip Members</span>
        <span className="ml-auto text-xs text-[#9A7A78]">{memberIds.length} {memberIds.length === 1 ? "member" : "members"}</span>
      </div>

      {/* Body */}
      <div className="bg-white">
        {loading ? (
          <div className="px-5 py-8 text-center text-sm text-[#9A7A78]">Loading members…</div>
        ) : members.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-[#9A7A78]">No members yet.</div>
        ) : (
          <ul className="divide-y" style={{ borderColor: "rgba(217,64,64,0.07)" }}>
            {members.map((member) => (
              <MemberRow key={member.uid} member={member} onUpdate={handleMemberUpdate} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// ─── Individual member row ────────────────────────────────────────────────────

function MemberRow({
  member,
  onUpdate,
}: {
  member: MemberWithId;
  onUpdate: (uid: string, patch: Partial<UserDocument>) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneValue, setPhoneValue] = useState(member.phone ?? "");
  const [savingPhone, setSavingPhone] = useState(false);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadMemberAvatar(member.uid, file);
      await updateDoc(doc(db!, COLLECTIONS.USERS, member.uid), { photoUrl: url });
      onUpdate(member.uid, { photoUrl: url });
    } catch (err) {
      console.error("Avatar upload failed", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handlePhoneSave() {
    setSavingPhone(true);
    try {
      await updateDoc(doc(db!, COLLECTIONS.USERS, member.uid), { phone: phoneValue.trim() || null });
      onUpdate(member.uid, { phone: phoneValue.trim() || null });
      setEditingPhone(false);
    } catch (err) {
      console.error("Phone save failed", err);
    } finally {
      setSavingPhone(false);
    }
  }

  return (
    <li className="flex items-center gap-4 px-5 py-4">
      {/* Avatar + upload button */}
      <div className="relative shrink-0">
        <Avatar
          uid={member.uid}
          displayName={member.displayName}
          photoUrl={member.photoUrl}
          size={52}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center transition-opacity hover:opacity-80 active:opacity-60"
          style={{ background: "#D94040", border: "2px solid white", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }}
          title="Change avatar"
        >
          {uploading ? (
            <svg className="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          )}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#1E0E0B] truncate">{member.displayName || "—"}</p>
        <p className="text-xs text-[#9A7A78] truncate mt-0.5">{member.email}</p>

        {/* Phone */}
        {editingPhone ? (
          <div className="flex items-center gap-1.5 mt-1.5">
            <input
              autoFocus
              type="tel"
              value={phoneValue}
              onChange={(e) => setPhoneValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handlePhoneSave(); if (e.key === "Escape") setEditingPhone(false); }}
              placeholder="+34 000 000 000"
              className="text-xs px-2 py-1 rounded-lg outline-none flex-1 min-w-0"
              style={{ border: "1px solid rgba(217,64,64,0.35)", color: "#1E0E0B" }}
            />
            <button
              onClick={handlePhoneSave}
              disabled={savingPhone}
              className="text-xs px-2 py-1 rounded-lg font-semibold text-white transition-opacity hover:opacity-80"
              style={{ background: "#D94040" }}
            >
              {savingPhone ? "…" : "Save"}
            </button>
            <button
              onClick={() => { setPhoneValue(member.phone ?? ""); setEditingPhone(false); }}
              className="text-xs px-2 py-1 rounded-lg font-semibold transition-opacity hover:opacity-70"
              style={{ color: "#9A7A78" }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditingPhone(true)}
            className="flex items-center gap-1 mt-1 group"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={member.phone ? "#6B4845" : "#C4AAA8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.23 19.79 19.79 0 0 1 1.61 4.6 2 2 0 0 1 3.6 2.43h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.81a16 16 0 0 0 6.29 6.29l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
            <span className="text-xs group-hover:underline" style={{ color: member.phone ? "#6B4845" : "#C4AAA8" }}>
              {member.phone || "Add phone"}
            </span>
          </button>
        )}
      </div>

      {/* Role badge */}
      <span
        className="shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
        style={member.role === "admin"
          ? { background: "rgba(217,64,64,0.1)", color: "#D94040" }
          : { background: "rgba(155,119,110,0.1)", color: "#9A7A78" }}
      >
        {member.role}
      </span>
    </li>
  );
}
