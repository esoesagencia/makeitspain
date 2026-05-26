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
  careServices?: {
    petSitting: Array<{ name: string; type?: string; phone?: string; address?: string; dayTime?: string; link?: string; cost?: string }>;
    babysitter: Array<{ name: string; phone?: string; address?: string; dayTime?: string; cost?: string; link?: string }>;
    specialCare: Array<{ name: string; phone?: string; address?: string; dayTime?: string; cost?: string; link?: string }>;
  };
}

export interface AITripAssistantResponse {
  message: string;
  operations: AIOperation[];
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a luxury travel planner assistant for MakeItSpain, a premium Spain concierge specialising in romantic trips, bachelor/hen parties, honeymoons, birthdays and special events. You act as a human admin filling the admin panel — exactly what the forms allow, nothing more.

## RESPONSE FORMAT (required on every reply)
{"message":"conversational reply to admin","operations":[...]}

━━━ ACTIVITY CARDS ━━━
{"type":"add","tempId":"act_1","fields":{…}}
{"type":"update","activityId":"<ID>","fields":{…changed fields only}}
{"type":"delete","activityId":"<ID>"}

Settable fields:
title, description, category, place, address, recommendations, coordinatorNote,
date("YYYY-MM-DD"), startTime("HH:MM"), endTime("HH:MM"), estimatedDuration(mins),
isBooked(bool), contactPhone, contactLink,
isSurprise(bool), surpriseDescription, surpriseContactName, surpriseContactPhone, surpriseLink, surpriseOrganizerOnly(bool),
reminderEnabled(bool), reminderMinutesBefore(int), reminderMessage(max 100 chars),
transferMode("taxi"|"walking"|"transit"), transferDuration(mins),
breakfastType("hotel_breakfast"|"special_breakfast"|"no_breakfast"), specialBreakfastInfo, specialBreakfastContact

CATEGORIES (exact string values only):
"activity"          — sightseeing, tours, check-in/out, experiences, excursions
"transfer"          — any journey between places
"meal"              — any food/drink: breakfast, lunch, dinner, tapas, drinks, restaurant
"free_time"         — unstructured leisure time
"surprise"          — hidden activity revealed later
"wellness_grooming" — spa, massage, beauty, grooming
NEVER use "sleep_in_hotel" or "hotel" — auto-created by the system.
Any "hotel" item in a plan → convert to "meal" (food) or "activity" (check-in/experience).

NEVER SET: sortOrder, linkedAccommodationId, surpriseVisibleAt, isVisited, visitedBy, imageUrl, createdAt, reminderFireAt, reminderSent

━━━ ACCOMMODATION ━━━
{"type":"add_accommodation","fields":{type,name,address,contactPhone}}
{"type":"update_accommodation","accommodationId":"<ID>","fields":{name?,address?,contactPhone?,type?}}
{"type":"delete_accommodation","accommodationId":"<ID>"}

Rules:
- existingAccommodations non-empty → use update_accommodation ONLY, never add_accommodation
- NEVER set or suggest the nights array (system derives it from trip dates)
- NEVER touch activities where linkedAccommodationId is set (marked [SYSTEM] in state)

━━━ TRIP / INFO / CARE ━━━
{"type":"update_trip","fields":{…}}

tripName, clientName, destination, numberOfPeople(int),
tripType: "bachelor_hen"|"bachelorette_stag"|"romantic"|"honeymoon"|"birthday"|"business"|"special_event"|"party_trip"|"other"
budgetFrom(€int), budgetTo(€int), budgetMode("per_trip"|"per_person"),
specialRequirements — array using ONLY these exact values: "pet","toddler","kids","special_needs","elderly","lgbtq"
personalMessage, additionalInfoClimate, additionalInfoDressCode, additionalInfoUsefulTips
petSitting:[{name,type("hotel"|"pet_sitter"),phone,address,dayTime,link,cost}]
babysitter:[{name,phone,address,dayTime,cost,link}]
specialCare:[{name,phone,address,dayTime,cost,link}]
Care arrays: always send the complete merged array (existing entries + new ones, never wipe what is already there).

━━━ PROCESSING A TRIP PLAN DOCUMENT ━━━
Order: update_trip FIRST → accommodation → activities (all of them, never stop early)
DATE MAPPING: Day 1 = startDate, Day 2 = startDate+1, Day 3 = startDate+2 … Never use dates from the document itself.

━━━ ABSOLUTE RULES ━━━
- Never create activities outside startDate–endDate
- Only update/delete IDs present in the current state
- Never touch [SYSTEM] activities
- PRESERVE fields already marked SET in [CURRENT STATE] — only change what admin explicitly asks to modify
- Use real Spanish venues, addresses, phone numbers
- Coordinator notes: warm, personal, exciting tone`;

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AITripAssistantRequest;
    const { messages, trip, existingActivities, existingAccommodations, careServices } = body;
    const cs = careServices;

    // Full context — sent only on the first message (plan import / first instruction)
    const tripContext = `TRIP CONTEXT:
Name: ${trip.tripName} | Client: ${trip.clientName} | Destination: ${trip.destination}
Dates: ${trip.startDate} → ${trip.endDate} | People: ${trip.numberOfPeople}
Type: ${trip.tripType ?? "—"} | Budget: €${trip.budgetFrom ?? "?"}–€${trip.budgetTo ?? "?"} ${trip.budgetMode === "per_person" ? "per person" : "total"}
Requirements: ${trip.specialRequirements?.join(", ") || "none"}
personalMessage: ${trip.personalMessage || "—"}
climate: ${trip.additionalInfoClimate || "—"} | dresscode: ${trip.additionalInfoDressCode || "—"} | tips: ${trip.additionalInfoUsefulTips || "—"}
petSitting: ${cs?.petSitting?.length ? cs.petSitting.map(p => p.name).join(", ") : "none"}
babysitter: ${cs?.babysitter?.length ? cs.babysitter.map(b => b.name).join(", ") : "none"}
specialCare: ${cs?.specialCare?.length ? cs.specialCare.map(s => s.name).join(", ") : "none"}

EXISTING ACCOMMODATIONS (${existingAccommodations.length}):
${existingAccommodations.length === 0 ? "None." : existingAccommodations.map(a => `- ID:${a.id} | [${a.type}] ${a.name} | nights: ${a.nights.join(", ")}`).join("\n")}

EXISTING ACTIVITIES (${existingActivities.length}):
${existingActivities.length === 0 ? "None." : existingActivities.map(a => `- ${a.id}|${a.date} ${a.startTime}|[${a.category}]${a.title}@${a.place ?? ""}${a.linkedAccommodationId ? "|[SYSTEM]" : ""}`).join("\n")}`;

    // Compact state — injected on every subsequent message to keep context fresh at low token cost
    const compactState = `[CURRENT STATE — preserve SET values unless admin explicitly asks to change]
Accommodation: ${existingAccommodations.length > 0 ? existingAccommodations.map(a => a.name).join(", ") : "none"}
Info: personalMsg:${trip.personalMessage ? "SET" : "—"} climate:${trip.additionalInfoClimate ? "SET" : "—"} dresscode:${trip.additionalInfoDressCode ? "SET" : "—"} tips:${trip.additionalInfoUsefulTips ? "SET" : "—"}
Care: petSitting:${cs?.petSitting?.length || 0} babysitter:${cs?.babysitter?.length || 0} specialCare:${cs?.specialCare?.length || 0}
Activities(${existingActivities.length}):${existingActivities.length === 0 ? " none" : "\n" + existingActivities.map(a => `  ${a.id}|${a.date} ${a.startTime}|[${a.category}]${a.title}@${a.place ?? ""}${a.linkedAccommodationId ? "|SYSTEM" : ""}`).join("\n")}`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_PROMPT,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [{ googleSearch: {} } as any],
    });

    // Cap history to last 8 exchanges to control token cost on long sessions
    const isFirstMessage = messages.length === 1;
    const capped = messages.slice(-10);
    const history = capped.slice(0, -1).map(m => ({
      role: (m.role === "assistant" ? "model" : "user") as "model" | "user",
      parts: [{ text: m.content }],
    }));

    const chat = model.startChat({ history });

    const lastMsg = capped[capped.length - 1];
    const userText = isFirstMessage
      ? `${tripContext}\n\n---\n\n${lastMsg.content}`
      : `${compactState}\n\n---\n\nADMIN: ${lastMsg.content}`;

    const result = await chat.sendMessage(userText);
    const raw = result.response.text();

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ message: raw, operations: [] } as AITripAssistantResponse);
    }

    const parsed = JSON.parse(jsonMatch[0]) as AITripAssistantResponse;

    // ── Hard safety filters — enforce regardless of what the AI returned ────────
    const linkedIds = new Set(existingActivities.filter(a => a.linkedAccommodationId).map(a => a.id));
    const BLOCKED_CATEGORIES = new Set(["sleep_in_hotel", "hotel"]);
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
        // Strip system-managed fields from activity operations
        if ("fields" in op && op.fields) {
          const f = op.fields as Record<string, unknown>;
          SYSTEM_FIELDS.forEach(k => delete f[k]);
        }
        // Strip nights from ALL accommodation operations — dates are always calculated
        // from the admin-set trip dates on the client, never from AI output
        if ((op.type === "add_accommodation" || op.type === "update_accommodation") && "fields" in op && op.fields) {
          delete (op.fields as Record<string, unknown>).nights;
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
