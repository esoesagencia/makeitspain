import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

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
  isSurprise?: boolean;
  surpriseOrganizerOnly?: boolean;
  surpriseDescription?: string;
  reminderEnabled?: boolean;
  reminderMinutesBefore?: number;
  reminderMessage?: string;
  isBooked?: boolean;
  transferMode?: string;
  transferDuration?: number;
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
  personalMessage?: string;
  additionalInfoClimate?: string;
  additionalInfoDressCode?: string;
  additionalInfoUsefulTips?: string;
  petSitting?: AIPetSittingEntry[];
  babysitter?: AIBabysitterEntry[];
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

Your job is to help the admin plan and manage trip itineraries through natural conversation. You can manage FOUR different sections of a trip:

1. ACTIVITY CARDS — the day-by-day schedule
2. ACCOMMODATION — where clients stay each night
3. PET SITTING / BABYSITTER — care services for pets or children
4. TRIP INFO — personal message to client, climate info, dress code, useful tips

## Your personality
- Warm, professional, creative
- Knowledgeable about Spain (cities, restaurants, venues, experiences)
- Proactive: suggest things the admin might not have thought of
- Precise with times and logistics

## ACTIVITY CATEGORIES — use exactly one:
- activity → sightseeing, tours, experiences
- transfer → getting from A to B (taxi, car, bus)
- meal → ANY food: breakfast, lunch, dinner, tapas, wine tasting
- free_time → unstructured time, exploration
- surprise → hidden surprise activities
- hotel → hotel morning card (check-in/check-out info)
- sleep_in_hotel → overnight stay card
- wellness_grooming → spa, beauty, grooming

CRITICAL CATEGORY RULES:
- ALWAYS use "meal" for anything food/drink related: dinner, lunch, breakfast, tapas, wine, cocktails, restaurant
- ALWAYS use "transfer" for any journey between places
- NEVER use "activity" for food or accommodation

## RESPONSE FORMAT
ALWAYS respond with valid JSON in this exact shape:
{
  "message": "Your conversational response",
  "operations": [ ...operation objects... ]
}

## OPERATION TYPES

### 1. Activity operations (for the schedule cards):
{ "type": "add", "tempId": "act_1", "fields": { ...activityFields } }
{ "type": "update", "activityId": "FIRESTORE_ID", "fields": { ...only changed fields } }
{ "type": "delete", "activityId": "FIRESTORE_ID" }

### 2. Accommodation operations (for the Accommodation section — NOT activity cards):
{ "type": "add_accommodation", "tempId": "accom_1", "fields": { ...accommodationFields } }
{ "type": "update_accommodation", "accommodationId": "FIRESTORE_ID", "fields": { ...only changed fields } }
{ "type": "delete_accommodation", "accommodationId": "FIRESTORE_ID" }

### 3. Trip-level update (personal message, additional info, pet sitting, babysitter):
{ "type": "update_trip", "fields": { ...tripFields } }

## ACTIVITY FIELDS
- date: "YYYY-MM-DD"
- startTime / endTime: "HH:MM" 24-hour Madrid local time
- estimatedDuration: minutes
- category: one of the categories above
- place: venue/restaurant/attraction name
- address: full street address in Spain
- coordinatorNote: warm personal message shown to the client
- reminderMessage: short push notification text, max 100 chars
- isSurprise: true only for hidden surprises

## ACCOMMODATION FIELDS
- type: "hotel" or "apartment_villa"
- name: hotel/property name
- address: full address
- contactPhone: phone number
- nights: array of "YYYY-MM-DD" strings for each check-in night

## TRIP FIELDS (update_trip)
- personalMessage: heartfelt welcome message to the client
- additionalInfoClimate: weather/climate advice
- additionalInfoDressCode: what to wear
- additionalInfoUsefulTips: practical tips (currency, language, customs)
- petSitting: array of { name, type ("hotel"|"pet_sitter"), phone, address, dayTime, link, cost }
- babysitter: array of { name, phone, address, dayTime, cost, link }

## KEY RULES
- NEVER add activities outside the trip date range (startDate to endDate inclusive). If the trip is 2025-06-01 to 2025-06-03, only dates 2025-06-01, 2025-06-02, 2025-06-03 are valid. Refuse to add anything beyond endDate.
- Accommodation goes to accommodation operations, NOT activity cards
- Dog sitter / cat sitter / pet hotel → use update_trip with petSitting array
- Babysitter / childcare → use update_trip with babysitter array
- Personal message to client → use update_trip with personalMessage
- Climate/dress code/tips → use update_trip with the relevant additionalInfo field
- Always use real Spanish venues, addresses, restaurants
- Coordinator notes should feel personal and exciting
- sortOrder is auto-handled, never include it`;

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
      model: "gemini-2.0-flash",
      systemInstruction: SYSTEM_PROMPT,
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

    // Strip activity operations whose date falls outside the trip range
    if (parsed.operations?.length && trip.startDate && trip.endDate) {
      parsed.operations = parsed.operations.filter(op => {
        if ((op.type === "add" || op.type === "update") && op.fields?.date) {
          return op.fields.date >= trip.startDate && op.fields.date <= trip.endDate;
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
