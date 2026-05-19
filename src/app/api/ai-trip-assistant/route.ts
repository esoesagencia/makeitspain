import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
}

// ─── Activity operations (add/update/delete activity cards) ──────────────────

export interface AIActivityOperation {
  type: "add" | "update" | "delete";
  tempId?: string;
  activityId?: string;
  fields?: AIActivityFields;
}

export interface AIActivityFields {
  title?: string;
  description?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  estimatedDuration?: number;
  category?: string;
  place?: string;
  address?: string;
  recommendations?: string;
  coordinatorNote?: string;
  contactPhone?: string;
  contactLink?: string;
  isSurprise?: boolean;
  surpriseOrganizerOnly?: boolean;
  surpriseDescription?: string;
  surpriseContactName?: string;
  surpriseContactPhone?: string;
  surpriseLink?: string;
  reminderEnabled?: boolean;
  reminderMinutesBefore?: number;
  reminderMessage?: string;
  isBooked?: boolean;
  transferMode?: string;
  transferDuration?: number;
  breakfastType?: "hotel_breakfast" | "special_breakfast" | "no_breakfast";
  specialBreakfastInfo?: string;
  specialBreakfastContact?: string;
}

// ─── Accommodation operations ────────────────────────────────────────────────

export interface AIAccommodationOperation {
  type: "add_accommodation" | "update_accommodation" | "delete_accommodation";
  tempId?: string;
  accommodationId?: string;
  fields?: AIAccommodationFields;
}

export interface AIAccommodationFields {
  type?: "hotel" | "apartment_villa";
  name?: string;
  address?: string;
  contactPhone?: string;
  nights?: string[];
}

// ─── Trip-level field update (personalMessage, additionalInfo, petSitting…) ──

export interface AITripUpdateOperation {
  type: "update_trip";
  fields: AITripFields;
}

export interface AITripFields {
  // Core trip details
  tripName?: string;
  clientName?: string;
  destination?: string;
  numberOfPeople?: number;
  tripType?: string;
  budgetFrom?: number;
  budgetTo?: number;
  budgetMode?: "per_trip" | "per_person";
  specialRequirements?: string[];
  // Info sections
  personalMessage?: string;
  additionalInfoClimate?: string;
  additionalInfoDressCode?: string;
  additionalInfoUsefulTips?: string;
  // Care services
  petSitting?: AIPetSittingEntry[];
  babysitter?: AIBabysitterEntry[];
  specialCare?: AISpecialCareEntry[];
}

export interface AIPetSittingEntry {
  id?: string;
  type?: "hotel" | "pet_sitter";
  name: string;
  phone?: string;
  address?: string;
  dayTime?: string;
  link?: string;
  cost?: string;
}

export interface AIBabysitterEntry {
  id?: string;
  name: string;
  phone?: string;
  address?: string;
  dayTime?: string;
  cost?: string;
  link?: string;
}

export interface AISpecialCareEntry {
  id?: string;
  name: string;
  phone?: string;
  address?: string;
  dayTime?: string;
  cost?: string;
  link?: string;
}

// ─── Combined operation union ─────────────────────────────────────────────────

export type AIOperation = AIActivityOperation | AIAccommodationOperation | AITripUpdateOperation;

// ─── Request / response ───────────────────────────────────────────────────────

export interface AITripAssistantRequest {
  messages: AIMessage[];
  trip: {
    tripName: string;
    clientName: string;
    destination: string;
    startDate: string;
    endDate: string;
    numberOfPeople: number;
    tripType?: string;
    budgetFrom?: number;
    budgetTo?: number;
    budgetMode?: string;
    specialRequirements?: string[];
    personalMessage?: string;
    additionalInfoClimate?: string;
    additionalInfoDressCode?: string;
    additionalInfoUsefulTips?: string;
  };
  existingActivities: {
    id: string;
    title: string;
    date: string;
    startTime: string;
    category: string;
    place: string;
    linkedAccommodationId?: string;
  }[];
  existingAccommodations: {
    id: string;
    name: string;
    type: string;
    nights: string[];
  }[];
}

export interface AITripAssistantResponse {
  message: string;
  operations: AIOperation[];
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert luxury travel planner for MakeItSpain, a premium Spain travel concierge specialising in romantic trips, bachelor/bachelorette parties, honeymoons, birthdays and special occasions.

You act as a human admin filling in the admin panel — EXACTLY what the form allows, nothing more. You have access to four sections:

1. ACTIVITY CARDS — individual schedule cards (meals, transfers, experiences, etc.)
2. ACCOMMODATION — hotel/apartment stays (auto-generates hotel night + morning cards)
3. PET SITTING / BABYSITTER — care services
4. TRIP INFO — welcome message, climate, dress code, tips

## Your personality
- Warm, professional, knowledgeable about Spain
- Proactive — suggest what the admin might not have thought of
- Precise with times and logistics

## RESPONSE FORMAT
Always respond with valid JSON:
{
  "message": "Your conversational reply to the admin",
  "operations": [ ...operation objects... ]
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 1 — ACTIVITY CARDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Operations:
{ "type": "add", "tempId": "act_1", "fields": { ...} }
{ "type": "update", "activityId": "<existing ID>", "fields": { ...only changed fields } }
{ "type": "delete", "activityId": "<existing ID>" }

Fields the human admin can fill in (you may set any of these):
- title: string
- description: string
- category: one of the values listed below
- place: venue/restaurant/attraction name
- address: full street address in Spain
- date: "YYYY-MM-DD"
- startTime: "HH:MM" (24-hour, Madrid time)
- endTime: "HH:MM" (24-hour, Madrid time) — omit for sleep_in_hotel
- estimatedDuration: integer minutes — set to 0 for sleep_in_hotel
- isBooked: true or false
- coordinatorNote: internal note visible only to admin, warm and personal
- contactPhone: phone number string
- contactLink: URL string (booking link)
- isSurprise: true or false
- surpriseDescription: string (only when isSurprise is true)
- surpriseContactName: string (only when isSurprise is true)
- surpriseContactPhone: string (only when isSurprise is true)
- surpriseLink: URL string (only when isSurprise is true)
- surpriseOrganizerOnly: true or false (only when isSurprise is true)
- reminderEnabled: true or false
- reminderMinutesBefore: integer minutes before startTime
- reminderMessage: push notification text, max 100 chars (only when reminderEnabled is true)

ALLOWED CATEGORIES:
- "activity"           → sightseeing, tours, experiences, excursions
- "transfer"           → any journey between places
- "meal"               → ANY food or drink: breakfast, lunch, dinner, tapas, drinks, restaurant
- "free_time"          → unstructured leisure time
- "surprise"           → hidden activity the client discovers later
- "wellness_grooming"  → spa, massage, beauty, grooming
- "hotel"              → hotel morning card (only if NO accommodation is set up for that morning)

CATEGORY RULES:
- Always use "meal" for food or drink
- Always use "transfer" for journeys
- NEVER use "sleep_in_hotel" — hotel night cards are created automatically by the accommodation system
- Prefer accommodation operations over manually creating "hotel" morning cards

FIELDS YOU MUST NEVER SET ON ACTIVITIES:
- sortOrder (auto-managed by system)
- linkedAccommodationId (system-managed)
- surpriseVisibleAt (admin sets this separately)
- isVisited, visitedBy (client-side)
- imageUrl (uploaded separately)
- createdAt (auto)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 2 — ACCOMMODATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Operations:
{ "type": "add_accommodation", "tempId": "accom_1", "fields": { ...} }
{ "type": "update_accommodation", "accommodationId": "<existing ID>", "fields": { ...} }
{ "type": "delete_accommodation", "accommodationId": "<existing ID>" }

Fields:
- type: "hotel" or "apartment_villa"
- name: hotel/property name
- address: full street address
- contactPhone: phone number
- nights: array of "YYYY-MM-DD" strings (one per check-in night)

When an accommodation is saved the system AUTOMATICALLY creates:
  • A "sleep_in_hotel" card at 23:00 for each night in the nights array
  • A "hotel" morning card at 00:00 for the following morning (except the first trip day)
These are system-managed. You MUST NOT create, edit or delete them via activity operations.
If the admin asks to change hotel nights or remove a hotel, use accommodation operations.

PROTECTED CARDS — NEVER TOUCH VIA ACTIVITY OPERATIONS:
Any card in existingActivities that has linkedAccommodationId set is system-managed.
Never add, update, or delete those cards.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 3 & 4 — TRIP INFO / CARE SERVICES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Operation:
{ "type": "update_trip", "fields": { ...} }

Fields:
- personalMessage: welcome message to the client
- additionalInfoClimate: weather and packing advice
- additionalInfoDressCode: what to wear
- additionalInfoUsefulTips: practical tips
- petSitting: array of { name, type ("hotel"|"pet_sitter"), phone, address, dayTime, link, cost }
- babysitter: array of { name, phone, address, dayTime, cost, link }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ROUTING RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Hotel/apartment stay → accommodation operation (preferred over manual sleep_in_hotel cards)
- Pet care → update_trip petSitting
- Childcare → update_trip babysitter
- Welcome/info/tips → update_trip
- Everything else → activity operation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABSOLUTE RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Never add activities outside startDate–endDate (inclusive)
- Only delete/update IDs that exist in existingActivities or existingAccommodations
- Never touch cards where linkedAccommodationId is set
- Always use real Spanish venues, addresses, phone numbers
- Coordinator notes must feel warm and exciting for the client`;

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AITripAssistantRequest;
    const { messages, trip, existingActivities, existingAccommodations } = body;

    const tripContext = `
TRIP CONTEXT:
- Name: ${trip.tripName}
- Client: ${trip.clientName}
- Destination: ${trip.destination}
- Dates: ${trip.startDate} to ${trip.endDate}
- People: ${trip.numberOfPeople}
- Type: ${trip.tripType ?? "not specified"}
- Budget: €${trip.budgetFrom ?? "?"} – €${trip.budgetTo ?? "?"} ${trip.budgetMode === "per_person" ? "per person" : "total"}
- Special requirements: ${trip.specialRequirements?.join(", ") || "none"}
- Personal message: ${trip.personalMessage || "not set"}
- Climate info: ${trip.additionalInfoClimate || "not set"}
- Dress code: ${trip.additionalInfoDressCode || "not set"}
- Useful tips: ${trip.additionalInfoUsefulTips || "not set"}

EXISTING ACTIVITIES (${existingActivities.length} total):
${existingActivities.length === 0
  ? "None yet."
  : existingActivities.map(a => `- ID:${a.id} | ${a.date} ${a.startTime} | [${a.category}] ${a.title} @ ${a.place}`).join("\n")
}

EXISTING ACCOMMODATIONS (${existingAccommodations.length} total):
${existingAccommodations.length === 0
  ? "None yet."
  : existingAccommodations.map(a => `- ID:${a.id} | [${a.type}] ${a.name} | nights: ${a.nights.join(", ")}`).join("\n")
}`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_PROMPT,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [{ googleSearch: {} } as any],
    });

    const history = messages.slice(0, -1).map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const chat = model.startChat({ history });

    const lastMsg = messages[messages.length - 1];
    const userText = messages.length === 1
      ? `${tripContext}\n\n---\n\n${lastMsg.content}`
      : lastMsg.content;

    const result = await chat.sendMessage(userText);
    const raw = result.response.text();

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ message: raw, operations: [] } as AITripAssistantResponse);
    }

    const parsed = JSON.parse(jsonMatch[0]) as AITripAssistantResponse;

    // ── Hard safety filters — enforce regardless of what the AI returned ────────
    const linkedIds = new Set(existingActivities.filter(a => a.linkedAccommodationId).map(a => a.id));
    const BLOCKED_CATEGORIES = new Set(["sleep_in_hotel"]);
    const existingIds = new Set(existingActivities.map(a => a.id));
    const existingAccomIds = new Set(existingAccommodations.map(a => a.id));
    const SYSTEM_FIELDS = ["sortOrder", "linkedAccommodationId", "surpriseVisibleAt", "isVisited", "visitedBy", "imageUrl", "createdAt", "reminderFireAt", "reminderSent"];

    if (parsed.operations?.length) {
      parsed.operations = parsed.operations.filter(op => {
        // Block activity ops outside date range
        if ((op.type === "add" || op.type === "update") && "fields" in op && op.fields?.date) {
          if (op.fields.date < trip.startDate || op.fields.date > trip.endDate) return false;
        }
        // Block sleep_in_hotel category — always auto-generated, never manual
        if (op.type === "add" && "fields" in op && BLOCKED_CATEGORIES.has(op.fields?.category ?? "")) return false;
        if (op.type === "update" && "fields" in op && BLOCKED_CATEGORIES.has(op.fields?.category ?? "")) return false;
        // Block any operation touching a system-linked hotel card
        if ((op.type === "update" || op.type === "delete") && "activityId" in op && op.activityId) {
          if (linkedIds.has(op.activityId)) return false;
        }
        // Block updates/deletes for IDs that don't exist
        if (op.type === "update" && "activityId" in op && op.activityId && !existingIds.has(op.activityId)) return false;
        if (op.type === "delete" && "activityId" in op && op.activityId && !existingIds.has(op.activityId)) return false;
        if (op.type === "update_accommodation" && "accommodationId" in op && op.accommodationId && !existingAccomIds.has(op.accommodationId)) return false;
        if (op.type === "delete_accommodation" && "accommodationId" in op && op.accommodationId && !existingAccomIds.has(op.accommodationId)) return false;
        // Strip all system-managed fields from any activity/accommodation operation
        if ("fields" in op && op.fields) {
          const f = op.fields as Record<string, unknown>;
          SYSTEM_FIELDS.forEach(k => delete f[k]);
        }
        return true;
      });
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[AI Trip Assistant]", err);
    return NextResponse.json(
      { message: "Something went wrong. Please try again.", operations: [] },
      { status: 500 }
    );
  }
}
