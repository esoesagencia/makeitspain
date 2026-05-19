"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, googleProvider } from "@/lib/firebase/auth";
import { db, COLLECTIONS } from "@/lib/firebase/firestore";
import { lookupInviteCode, joinTripByCode } from "@/lib/firebase/trips";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import type { UserDocument, UserRole } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function ensureUserDoc(uid: string, email: string, displayName: string, photoUrl: string | null = null): Promise<UserDocument> {
  const ref = doc(db, COLLECTIONS.USERS, uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data() as UserDocument;
  const newUser: UserDocument = {
    uid, email, displayName, role: "client", photoUrl, tripIds: [], fcmToken: null,
    createdAt: serverTimestamp() as ReturnType<typeof serverTimestamp> as never,
  };
  await setDoc(ref, newUser);
  return newUser;
}

function friendlyError(err: unknown): string {
  if (typeof err !== "object" || err === null) return "Something went wrong.";
  const code = (err as { code?: string }).code ?? "";
  const map: Record<string, string> = {
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment.",
    "auth/network-request-failed": "Network error. Check your connection.",
    "auth/popup-closed-by-user": "Sign-in popup was closed. Please try again.",
  };
  return map[code] ?? "Something went wrong. Please try again.";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Step = "code" | "auth";
type AuthMode = "signup" | "signin";

export default function LoginPage() {
  const router = useRouter();
  const onboardingInProgress = useRef(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return onAuthStateChanged(auth, async (user) => {
      if (!user || onboardingInProgress.current) return;
      const snap = await getDoc(doc(db, COLLECTIONS.USERS, user.uid));
      const role: UserRole = snap.exists() ? (snap.data() as UserDocument).role : "client";
      router.replace(role === "admin" ? "/admin" : "/trips");
    });
  }, [router]);

  const [step, setStep] = useState<Step>("code");
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [tripInfo, setTripInfo] = useState<{ tripId: string; tripName: string } | null>(null);

  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  async function finishOnboarding(uid: string, userEmail: string, displayName: string, photoUrl: string | null = null) {
    if (!tripInfo) return;
    await ensureUserDoc(uid, userEmail, displayName, photoUrl);
    await joinTripByCode(uid, codeInput);
    router.replace("/trips");
  }

  async function handleCodeSubmit(e: FormEvent) {
    e.preventDefault();
    setCodeError("");
    if (codeInput.trim().length !== 6) { setCodeError("Reference codes are 6 characters."); return; }
    setCodeLoading(true);
    try {
      const result = await lookupInviteCode(codeInput);
      if (!result) { setCodeError("That code didn't match any trip. Check with your coordinator."); return; }
      setTripInfo(result);
      setStep("auth");
    } catch { setCodeError("Something went wrong. Please try again."); }
    finally { setCodeLoading(false); }
  }

  async function handleAuthSubmit(e: FormEvent) {
    e.preventDefault();
    setAuthError("");
    if (!tripInfo) return;
    if (authMode === "signup" && !name.trim()) { setAuthError("Please enter your name."); return; }
    setAuthLoading(true);
    onboardingInProgress.current = true;
    try {
      let uid: string, displayName: string;
      if (authMode === "signup") {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        uid = cred.user.uid; displayName = name.trim();
      } else {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        uid = cred.user.uid; displayName = cred.user.displayName ?? email.split("@")[0];
      }
      await finishOnboarding(uid, email, displayName);
    } catch (err) { onboardingInProgress.current = false; setAuthError(friendlyError(err)); }
    finally { setAuthLoading(false); }
  }

  async function handleGoogle() {
    setAuthError("");
    if (!tripInfo) return;
    setAuthLoading(true);
    onboardingInProgress.current = true;
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const { uid, email: gEmail, displayName: gName, photoURL } = cred.user;
      await finishOnboarding(uid, gEmail ?? "", gName ?? gEmail ?? "Guest", photoURL);
    } catch (err) { onboardingInProgress.current = false; setAuthError(friendlyError(err)); }
    finally { setAuthLoading(false); }
  }

  if (!mounted) return null;

  return (
    <main className="min-h-screen flex bg-[#F5EDED]">

      {/* ── Left decorative panel — desktop only ── */}
      <div className="hidden lg:flex lg:w-[48%] xl:w-[52%] relative flex-col justify-between p-14 overflow-hidden bg-[#D94040]">

        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 30%, rgba(255,255,255,0.4) 0%, transparent 50%),
                              radial-gradient(circle at 80% 70%, rgba(255,255,255,0.2) 0%, transparent 40%)`,
          }}
        />
        {/* Decorative circles */}
        <div className="absolute -right-20 -top-20 w-96 h-96 rounded-full opacity-10 border-2 border-white" />
        <div className="absolute -right-8 -top-8 w-64 h-64 rounded-full opacity-10 border border-white" />
        <div className="absolute -left-12 -bottom-12 w-72 h-72 rounded-full opacity-10 border border-white" />

        {/* Logo mark */}
        <div className="relative z-10 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="MakeItSpain" className="h-8 w-auto" style={{ filter: "brightness(0) invert(1)" }} />
        </div>

        {/* Main copy */}
        <div className="relative z-10">
          <p className="text-white/60 text-xs tracking-[0.3em] uppercase font-medium mb-6">
            Your Personal Experience Planner
          </p>
          <h1 className="font-display text-6xl xl:text-8xl font-light leading-[1.0] mb-8" style={{ color: "#ffed9f" }}>
            Spain done<br />
            <em className="not-italic font-semibold" style={{ color: "#1E0E0B" }}>properly.</em>
          </h1>
          <p className="text-sm leading-relaxed max-w-[420px]" style={{ color: "#1E0E0B" }}>
            Every detail of your Spain experience, meticulously planned by our experts and beautifully organised in one place.
          </p>

          <div className="mt-10 flex flex-col gap-4">
            {[
              "Personalized handcrafted itinerary",
              "Unique & fun experiences crafted for your trip demands",
              "Specialists in bachelor/ettes, romantic trips, honeymoons & special occasion trips",
              "Personalized celebration styling, surprises, decorations, gifts & personal touches",
            ].map((f) => (
              <div key={f} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                    stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <span className="text-white/80 text-sm leading-snug">{f}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-white/30 text-xs tracking-widest uppercase">makeitspain.com</p>
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10 sm:px-8">

        {/* Mobile logo */}
        <div className="lg:hidden mb-16">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="MakeItSpain" className="h-16 w-auto" />
        </div>

        {/* Dev warning */}
        {!isFirebaseConfigured && (
          <div className="w-full max-w-sm mb-5 rounded-2xl border border-[#D94040]/30 bg-[#D94040]/08 px-4 py-3 text-sm text-[#D94040]">
            <strong>Dev mode:</strong> Firebase not configured in <code className="text-xs font-mono">.env.local</code>
          </div>
        )}

        {/* Card */}
        <div className="w-full max-w-sm">
          {/* Step dots */}
          <div className="flex items-center gap-2 mb-8">
            <StepDot active={step === "code"} done={step === "auth"} number={1} />
            <div className="flex-1 h-px bg-[#D94040]/15 rounded-full" />
            <StepDot active={step === "auth"} done={false} number={2} />
          </div>

          {/* ── Step 1 ── */}
          {step === "code" && (
            <>
              <h2 className="font-display text-3xl font-semibold text-[#1E0E0B] mb-1 leading-tight">
                Enter your code
              </h2>
              <p className="text-sm text-[#9A7A78] mb-7 leading-relaxed">
                Your coordinator sent you a 6-character reference code.
              </p>
              <form onSubmit={handleCodeSubmit} className="flex flex-col gap-4">
                <LuxInput
                  label="Reference code"
                  placeholder="ABC123"
                  value={codeInput}
                  onChange={(v) => { setCodeInput(v.toUpperCase().slice(0, 6)); setCodeError(""); }}
                  inputClassName="uppercase tracking-[0.5em] font-mono text-center text-xl font-bold text-[#D94040]"
                  maxLength={6}
                  autoComplete="off"
                  spellCheck={false}
                  error={codeError}
                />
                <CoralButton loading={codeLoading} type="submit">Continue →</CoralButton>
              </form>
            </>
          )}

          {/* ── Step 2 ── */}
          {step === "auth" && tripInfo && (
            <>
              <div className="flex items-start gap-3 mb-6">
                <button
                  onClick={() => { setStep("code"); setAuthError(""); onboardingInProgress.current = false; }}
                  className="mt-1.5 p-1.5 rounded-lg hover:bg-[#D94040]/08 text-[#9A7A78] hover:text-[#D94040] transition-colors shrink-0"
                  aria-label="Back"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                </button>
                <div>
                  <h2 className="font-display text-3xl font-semibold text-[#1E0E0B] leading-tight">
                    {authMode === "signup" ? "Create account" : "Welcome back"}
                  </h2>
                  <p className="text-sm text-[#9A7A78] mt-1">
                    Joining <span className="text-[#D94040] font-medium">{tripInfo.tripName}</span>
                  </p>
                </div>
              </div>

              {/* Google */}
              <button
                type="button"
                onClick={handleGoogle}
                disabled={authLoading}
                className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl text-sm font-medium transition-all duration-200 mb-5 border"
                style={{
                  background: "white",
                  borderColor: "rgba(180,100,90,0.18)",
                  color: "#1E0E0B",
                  boxShadow: "0 1px 4px rgba(120,60,50,0.07)",
                }}
              >
                <GoogleIcon />
                Continue with Google
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-[#D94040]/12 rounded-full" />
                <span className="text-xs text-[#C4AAA8] tracking-widest uppercase">or</span>
                <div className="flex-1 h-px bg-[#D94040]/12 rounded-full" />
              </div>

              {/* Toggle */}
              <div className="flex rounded-2xl p-1 mb-5" style={{ background: "rgba(217,64,64,0.07)" }}>
                {(["signup", "signin"] as AuthMode[]).map((m) => (
                  <button key={m} type="button"
                    onClick={() => { setAuthMode(m); setAuthError(""); }}
                    className="flex-1 rounded-xl py-2 text-sm font-medium transition-all duration-200"
                    style={
                      authMode === m
                        ? { background: "white", color: "#D94040", boxShadow: "0 1px 4px rgba(120,60,50,0.1)" }
                        : { color: "#9A7A78" }
                    }
                  >
                    {m === "signup" ? "New account" : "Sign in"}
                  </button>
                ))}
              </div>

              {/* Form */}
              <form onSubmit={handleAuthSubmit} className="flex flex-col gap-4">
                {authMode === "signup" && (
                  <LuxInput label="Your name" type="text" placeholder="Alexandra"
                    value={name} onChange={(v) => { setName(v); setAuthError(""); }} autoComplete="name" />
                )}
                <LuxInput label="Email" type="email" placeholder="you@example.com"
                  value={email} onChange={(v) => { setEmail(v); setAuthError(""); }} autoComplete="email" />
                <LuxInput label="Password" type="password" placeholder="••••••••"
                  value={password} onChange={(v) => { setPassword(v); setAuthError(""); }}
                  autoComplete={authMode === "signin" ? "current-password" : "new-password"}
                  error={authError} />
                <CoralButton loading={authLoading} type="submit" className="mt-1">
                  {authMode === "signup" ? "Create account & join →" : "Sign in & join →"}
                </CoralButton>
              </form>
            </>
          )}
        </div>

        <p className="mt-8 text-xs text-[#C4AAA8] text-center">
          Powered by MakeItSpain · Personal Trip Planner
        </p>
      </div>
    </main>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepDot({ active, done, number }: { active: boolean; done: boolean; number: number }) {
  if (done) return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0"
      style={{ background: "#D94040", color: "white" }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    </div>
  );
  return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-all"
      style={{
        border: `2px solid ${active ? "#D94040" : "rgba(217,64,64,0.2)"}`,
        color: active ? "#D94040" : "#C4AAA8",
        background: active ? "rgba(217,64,64,0.06)" : "transparent",
      }}>
      {number}
    </div>
  );
}

interface LuxInputProps {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; autoComplete?: string;
  spellCheck?: boolean; maxLength?: number; error?: string; inputClassName?: string;
}
function LuxInput({ label, value, onChange, type = "text", placeholder, autoComplete, spellCheck, maxLength, error, inputClassName }: LuxInputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold tracking-wider uppercase text-[#9A7A78]">{label}</label>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} autoComplete={autoComplete}
        spellCheck={spellCheck} maxLength={maxLength}
        className={["w-full rounded-2xl px-4 py-3 text-sm outline-none transition-all duration-200 placeholder:text-[#D4B8B5]", inputClassName ?? ""].join(" ")}
        style={{
          background: "white",
          border: error ? "1.5px solid #D94040" : "1.5px solid rgba(180,100,90,0.15)",
          color: "#1E0E0B",
          boxShadow: "0 1px 3px rgba(120,60,50,0.05)",
        }}
        onFocus={(e) => { if (!error) { e.currentTarget.style.border = "1.5px solid #D94040"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(217,64,64,0.08)"; } }}
        onBlur={(e) => { if (!error) { e.currentTarget.style.border = "1.5px solid rgba(180,100,90,0.15)"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(120,60,50,0.05)"; } }}
      />
      {error && <p className="text-xs text-[#D94040]">{error}</p>}
    </div>
  );
}

function CoralButton({ children, loading, type = "button", onClick, disabled, className }: {
  children: React.ReactNode; loading?: boolean; type?: "submit" | "button";
  onClick?: () => void; disabled?: boolean; className?: string;
}) {
  return (
    <button type={type} onClick={onClick} disabled={loading || disabled}
      className={["w-full py-3.5 px-6 rounded-2xl text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed", className ?? ""].join(" ")}
      style={{ background: "#D94040", color: "white", boxShadow: "0 4px 16px rgba(217,64,64,0.3)" }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "#C03030"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(217,64,64,0.4)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "#D94040"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(217,64,64,0.3)"; }}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          Loading…
        </span>
      ) : children}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}
