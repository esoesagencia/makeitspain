"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { joinTripByCode } from "@/lib/firebase/trips";

interface JoinTripModalProps {
  uid: string;
  onClose: () => void;
}

export function JoinTripModal({ uid, onClose }: JoinTripModalProps) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (code.trim().length !== 6) { setError("Invite codes are 6 characters."); return; }
    setLoading(true);
    try {
      const tripId = await joinTripByCode(uid, code);
      if (!tripId) { setError("That code didn't match any trip. Check with your coordinator."); return; }
      setSuccess("Trip joined! Taking you there…");
      setTimeout(() => { onClose(); router.push(`/trip/${tripId}`); }, 800);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      role="dialog" aria-modal="true" aria-labelledby="join-modal-title">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#1E0E0B]/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl animate-fade-up"
        style={{ border: "1px solid rgba(217,64,64,0.15)", boxShadow: "0 20px 60px rgba(120,60,50,0.2)" }}>

        {/* Top coral stripe */}
        <div className="absolute top-0 inset-x-0 h-[3px] rounded-t-3xl bg-[#D94040]" />

        {/* Close */}
        <button onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[#9A7A78] hover:text-[#D94040] hover:bg-[#D94040]/08 transition-colors"
          aria-label="Close">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        <div className="mb-5 pr-6">
          <h2 id="join-modal-title" className="font-display text-xl font-semibold text-[#1E0E0B]">Join a Trip</h2>
          <p className="mt-1 text-sm text-[#9A7A78]">Enter the 6-character invite code from your coordinator.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold tracking-wider uppercase text-[#9A7A78]">Invite code</label>
            <input
              ref={inputRef}
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase().slice(0, 6)); setError(""); }}
              placeholder="ABC123"
              maxLength={6}
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-2xl px-4 py-3 text-xl font-bold font-mono tracking-[0.4em] text-center text-[#D94040] outline-none transition-all duration-200 placeholder:text-[#D4B8B5] placeholder:text-base placeholder:font-normal placeholder:tracking-normal"
              style={{
                background: "rgba(217,64,64,0.04)",
                border: error ? "1.5px solid #D94040" : "1.5px solid rgba(217,64,64,0.2)",
                boxShadow: error ? "0 0 0 3px rgba(217,64,64,0.1)" : "none",
              }}
              onFocus={(e) => { e.currentTarget.style.border = "1.5px solid #D94040"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(217,64,64,0.08)"; }}
              onBlur={(e) => { if (!error) { e.currentTarget.style.border = "1.5px solid rgba(217,64,64,0.2)"; e.currentTarget.style.boxShadow = "none"; } }}
            />
            {error && <p className="text-xs text-[#D94040]">{error}</p>}
          </div>

          {success && (
            <p className="text-sm text-[#1A9E72] text-center font-medium">{success}</p>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={onClose} disabled={loading}
              className="flex-1 py-3 rounded-2xl text-sm font-medium text-[#9A7A78] hover:bg-[#D94040]/06 transition-colors"
              style={{ border: "1.5px solid rgba(180,100,90,0.18)" }}>
              Cancel
            </button>
            <button type="submit" disabled={loading || !!success}
              className="flex-1 py-3 rounded-2xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-60"
              style={{ background: "#D94040", boxShadow: "0 4px 16px rgba(217,64,64,0.3)" }}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Joining…
                </span>
              ) : "Join Trip"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
