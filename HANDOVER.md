# MakeItSpain App — Session Handover

## Live URL
**https://makeitspain-app.vercel.app**

Deploy command (run from `~/Desktop/makeitspain-app`):
```bash
vercel --prod --yes
```

---

## Project Overview
Next.js 15 App Router web app for MakeItSpain — a luxury Spain travel concierge. Admins build personalised trip itineraries; clients view their plan, get push notifications and see surprises revealed on time.

**Stack:** Next.js 15 · Firebase (Auth, Firestore, Storage, FCM) · Tailwind CSS v4 · TypeScript · Vercel (hosting) · Firebase Cloud Functions (push notifications)

**Root:** `/Users/yuliadirsha/Desktop/makeitspain-app`

---

## Key File Locations

| Purpose | Path |
|---|---|
| Login page | `src/app/login/page.tsx` |
| My Trips page | `src/app/trips/page.tsx` |
| Trip Plan page (user) | `src/app/trip/[tripId]/page.tsx` |
| Group page | `src/app/trip/[tripId]/group/page.tsx` |
| Admin list page | `src/app/admin/page.tsx` |
| Admin trip detail page | `src/app/admin/trip/[tripId]/page.tsx` |
| AI assistant API route | `src/app/api/ai-trip-assistant/route.ts` |
| AI assistant UI component | `src/components/admin/TripAIAssistant.tsx` |
| Push notification hook | `src/hooks/useFCMToken.ts` |
| Service worker (FCM background) | `public/firebase-messaging-sw.js` |
| Cloud Function (send reminders) | `functions/src/index.ts` |
| Global styles / animations | `src/app/globals.css` |
| Firestore collections config | `src/lib/firebase/firestore.ts` |
| All TypeScript types | `src/types/index.ts` |
| Tab icon | `public/tab-icon.svg` |
| Logo (original, on light bg) | `public/logo.png` |
| Notification sound | `public/notification-sound.wav` |
| Icons folder | `public/icons/` |
| Videos (intro) | `public/videos/intro-desktop.mp4`, `public/videos/intro-mobile.mp4` |

---

## Colour Palette

| Token | Value | Used for |
|---|---|---|
| Primary red | `#D94040` | Buttons, headers, accents |
| Background | `#F5EDED` | App background |
| Dark text | `#1E0E0B` | Body text |
| Muted text | `#9A7A78` | Labels, secondary |
| Pale yellow | `#FFE9A0` | Trip name on red headers, greeting |
| Mint green | `#c1f8cd` | Admin "Create Trip" button |
| Font display | `font-display` → Playfair Display | Headings |
| Font body | `font-sans` → Inter | Body |

---

## Architecture Notes

### Auth flow
- Firebase Auth (email/password + Google)
- Login page: user enters 6-char invite code → joins trip → lands on `/trips`
- Admin users (`role: "admin"` in Firestore) go to `/admin`
- `useFCMToken` hook runs on trip page load: requests notification permission, saves FCM token to user doc

### Push Notifications
Full pipeline is live:
1. Admin sets `reminderEnabled` + `reminderFireAt` on an activity card
2. Cloud Function (`sendActivityReminders`) runs every minute — finds due reminders, calls FCM API, marks `reminderSent: true`
3. Service worker handles background notifications with custom sound (`/notification-sound.wav`)
4. `useFCMToken` foreground handler plays custom sound + shows native notification when app is open

**Deploy Cloud Function:**
```bash
firebase deploy --only functions
```

### AI Trip Assistant
- Floating **"✦ AI Assistant"** button on every admin trip detail page (bottom-right)
- Chat panel with full conversation history
- Voice input via Web Speech API (Chrome/Edge, no extra service needed)
- Calls `POST /api/ai-trip-assistant` → Google Gemini 1.5 Flash
- AI responds with JSON `{ message, operations[] }` — operations are `add | update | delete` on activity cards
- Operations applied directly to Firestore in real time

**⚠️ GEMINI_API_KEY is currently a placeholder in Vercel — AI assistant won't work until set.**

To set the real key:
1. Get free key from https://aistudio.google.com → "Get API key"
2. Run:
```bash
cd ~/Desktop/makeitspain-app
vercel env rm GEMINI_API_KEY production --yes
echo "AIza...REAL_KEY" | vercel env add GEMINI_API_KEY production --yes
vercel --prod --yes
```

---

## Environment Variables

All set in Vercel production. Local copy in `.env.local` (not committed).

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_FIREBASE_*` | Firebase client config (7 vars) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Places autocomplete + travel time |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | FCM web push |
| `FIREBASE_ADMIN_*` | Server-side Firebase Admin SDK (3 vars) |
| `GEMINI_API_KEY` | Google Gemini — **needs real key** |

---

## Firebase Project
- **Project ID:** `make-it-spain-app`
- **Authorized domains for Auth:** `localhost`, `make-it-spain-app.firebaseapp.com`, `makeitspain-app.vercel.app`
- If adding a custom domain, add it to Firebase Console → Authentication → Settings → Authorized domains

### Firestore Collections
| Collection | Purpose |
|---|---|
| `users` | User profiles, FCM tokens, roles |
| `trips` | Trip documents |
| `trips/{id}/activities` | Activity subcollection |
| `trips/{id}/accommodations` | Accommodation subcollection |
| `authors` | Trip author profiles |
| `notifications` | Scheduled push notifications |
| `meta/tripCounter` | Auto-increment trip numbers |

---

## UI Changes Made This Session

### Login page (`src/app/login/page.tsx`)
- Logo: real `logo.png` (white filter on desktop panel, original on mobile, `h-16`)
- Tagline: "Your Personal Experience Planner"
- Headline: "Spain done properly." — "Spain done" in `#ffed9f`, "properly." in black `#1E0E0B`, `text-8xl` editorial size
- 4 updated bullet points
- Description capped at `max-w-[420px]` so it wraps to 2 lines matching heading width
- Footer: "Powered by MakeItSpain · Personal Trip Planner"
- After login → redirects to `/trips`

### My Trips page (`src/app/trips/page.tsx`)
- `TripJourneyLine` animation: suitcase opens lid → paper plane flies out along track → Spain map pin pops + confetti
- Fixed: `iconPop` animation was overriding `translateY(-50%)` — fixed by separating positioning wrapper (outer div) from animation wrapper (inner div)
- Track line now correctly centered on both icons

### Trip Plan page (`src/app/trip/[tripId]/page.tsx`)
- Logo added to header (links to makeitspain.com)
- Greeting: "Hola, {name}!" in `#FFE9A0`
- Fan SVG waving icon (with `wave-hand` animation, `filter: contrast(1.5) saturate(1.2)`)

### Admin pages
- `src/app/admin/page.tsx`: "Create Trip" button color `#c1f8cd`
- `src/app/admin/trip/[tripId]/page.tsx`: Trip name in white, Badge has `forceWhiteBg` prop
- `src/components/ui/Badge.tsx`: Added `forceWhiteBg` prop — when true, badge background is white

### Push Notifications
- `useFCMToken.ts`: Foreground handler added (plays custom sound + shows Notification)
- `firebase-messaging-sw.js`: `sound` field added + relays to open clients via `postMessage`
- `public/notification-sound.wav`: Custom notification sound
- Cloud Function deployed and live

### Deployment setup
- Vercel project: `esoesagencia-6087s-projects/makeitspain-app`
- `tsconfig.json`: `functions/` excluded to prevent Next.js build from type-checking Firebase functions
- Tab icon: `public/tab-icon.svg` set via `layout.tsx` metadata icons field
- `gcloud` installed at `/opt/homebrew/share/google-cloud-sdk/bin/gcloud`, authenticated as `esoesagencia@gmail.com`

---

## Pending / Known Issues

1. **GEMINI_API_KEY is a placeholder** — AI assistant returns "something went wrong" until real key is set (instructions above)
2. **iOS push notifications** only work if user adds app to Home Screen (PWA limitation of web push)
3. **Custom notification sound on desktop when app is closed** — not possible via web APIs; OS default sound plays instead
4. **Voice input** only works in Chrome/Edge (Web Speech API not supported in Firefox)

---

## How to Deploy

```bash
# App (Next.js) only
cd ~/Desktop/makeitspain-app
vercel --prod --yes

# Cloud Functions only
firebase deploy --only functions

# Both
vercel --prod --yes && firebase deploy --only functions
```
