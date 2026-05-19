# CLAUDE.md — MakeItSpain Trip Companion App

## Project Overview
A luxury travel concierge companion app for MakeItSpain (makeitspain.com).
Clients receive a link to access their personalized trip schedule during 
their stay in Spain. The app shows real-time activity cards, full schedule, 
Google Maps integration, group sharing, and surprise coordination.

## Tech Stack
- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS 4
- **Backend:** Firebase (Firestore, Auth, Cloud Messaging, Cloud Functions)
- **Maps:** Google Maps JavaScript API via @react-google-maps/api
- **PWA:** next-pwa for service worker and installability
- **Hosting:** Vercel (free tier)
- **Language:** TypeScript throughout

## Design System
- **Theme:** Dark luxury aesthetic
- **Background:** #0A0A0F (near black)
- **Surface/Cards:** #1A1A2E (dark navy)
- **Accent/Primary:** #D4AF37 (gold)
- **Success:** #2ECC71 (green, for visited items)
- **Danger:** #E74C3C (red, for missed/unvisited items)  
- **Text primary:** #FFFFFF
- **Text secondary:** #A0A0B0
- **Headings font:** Playfair Display (Google Fonts, serif)
- **Body font:** Inter (Google Fonts, sans-serif)
- **Border radius:** 12px on cards, 8px on buttons and inputs
- **Spacing base:** 16px grid

## Firestore Database Schema

### Collection: users
Copy
{ uid: string (Firebase Auth UID), email: string, displayName: string, role: "client" | "admin", photoUrl: string | null, tripIds: string[] (array of trip document IDs), fcmToken: string | null, createdAt: Timestamp }

Copy
### Collection: trips
{ tripName: string, clientName: string, destination: string, startDate: Timestamp, endDate: Timestamp, memberIds: string[] (array of user UIDs), inviteCode: string (6-character unique alphanumeric), status: "draft" | "active" | "completed", createdBy: string (admin UID), createdAt: Timestamp }

Copy
### Subcollection: trips/{tripId}/activities
{ title: string, description: string, date: Timestamp, startTime: Timestamp, endTime: Timestamp, estimatedDuration: number (minutes), category: "activity" | "transfer" | "meal" | "free_time" | "surprise", location: GeoPoint, address: string, recommendations: string | null, contactPhone: string | null, contactLink: string | null, coordinatorNote: string | null, isVisited: boolean (default false), visitedBy: string[] (UIDs of users who checked in), sortOrder: number, isSurprise: boolean, surpriseVisibleAt: Timestamp | null, imageUrl: string | null }

Copy
### Collection: notifications
{ tripId: string, activityId: string | null, title: string, body: string, type: "upcoming_activity" | "surprise" | "schedule_change" | "general", scheduledFor: Timestamp, sent: boolean (default false), targetUserIds: string[], createdAt: Timestamp }

Copy
## Pages and Routes

### /login
- Email + password authentication
- Google sign-in button
- "Join Trip" section with invite code input
- After login: redirect based on role (admin → /admin, client → /trips)

### /trips
- List of trips where current user's UID is in memberIds
- Each trip card: name, destination, date range, status badge
- Tap card → /trip/[tripId]
- FAB to join new trip via invite code

### /trip/[tripId] (two tabs)
**"Now" tab (default):**
- Large card showing current or next upcoming activity
- Auto-refreshes every 60 seconds
- Shows: title, category chip, time, duration, description, address, recommendations
- "Get Directions" button → opens Google Maps with coordinates
- "Mark as Visited" button → updates isVisited and visitedBy in Firestore
- Smaller "Up Next" preview card below
- Mini Google Map with current activity pin

**"Schedule" tab:**
- All activities grouped by date
- Vertical timeline layout with connecting line
- Each row: time, title, category icon, duration, status indicator
- Status: green checkmark (visited), red dot (missed — endTime passed and not visited), gray dot (upcoming)
- Hide activities where isSurprise == true AND surpriseVisibleAt > now
- Tap activity → expandable detail or slide-up modal

### /trip/[tripId]/activity/[activityId]
- Full activity detail page
- Google Map with pin
- Address with copy button
- "Get Directions" button
- Description and recommendations
- If category == "surprise": highlighted coordinator card with phone + link
- "Mark as Visited" / "Visited ✓" toggle button

### /trip/[tripId]/group
- List of group members (avatar + name)
- Trip organizer badge
- Invite code display + copy button
- Share button (Web Share API)

### /trip/[tripId]/updates
- Notification feed for this trip
- Cards styled by type (different icon + left border color)
- Tap notification → navigate to related activity

### /admin (admin only)
- Trip management: list all trips, create new, edit
- Activity management: add/edit/delete/reorder activities for a trip
- Surprise scheduling: set isSurprise + surpriseVisibleAt
- Notification composer: create notification → writes to notifications collection
- Simple, functional design (can be light theme for readability)

## Key Implementation Rules
1. Always use TypeScript with strict mode
2. Use Firebase client SDK v10+ (modular imports)
3. Use Firestore real-time listeners (onSnapshot) for the "Now" tab and notifications
4. All Firestore queries must have corresponding security rules
5. PWA must work offline for cached schedule data
6. Google Maps must lazy-load to avoid blocking initial render
7. All times displayed in the trip's local timezone (Spain = Europe/Madrid)
8. The invite code join flow: query trips where inviteCode matches → 
   add user UID to memberIds → add tripId to user's tripIds
9. Mobile-first responsive design. Desktop support for admin panel only.
10. Use next/image for optimized image loading
11. Implement loading skeletons for async data

## Cloud Function (deploy separately)
Write a Firebase Cloud Function triggered by Cloud Scheduler every 5 minutes.
It checks the notifications collection for unsent notifications whose 
scheduledFor time has passed, sends FCM push to target users, 
and marks them as sent.

## File Structure
/src /app (Next.js App Router pages) /login /trips /trip/[tripId] /admin layout.tsx /components (reusable React components) /ui (buttons, cards, badges, inputs) /trip (TripCard, ActivityCard, NowCard, ScheduleTimeline) /maps (MapView, ActivityPin) /admin (TripForm, ActivityForm, NotificationComposer) /lib /firebase (firebase config, auth, firestore, messaging helpers) /hooks (useCurrentActivity, useTrip, useTripActivities, useAuth) /utils (time formatting, timezone helpers, invite code generator) /types (TypeScript interfaces for all Firestore documents) /public /icons (PWA icons) manifest.json /functions (Firebase Cloud Functions) /src index.ts (scheduled notification sender)