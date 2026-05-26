import { Timestamp, GeoPoint } from "firebase/firestore";

// ─── users collection ────────────────────────────────────────────────────────

export type UserRole = "client" | "admin";

export interface UserDocument {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  photoUrl: string | null;
  phone?: string | null;
  tripIds: string[];
  fcmToken: string | null;
  createdAt: Timestamp;
}

// ─── trips collection ────────────────────────────────────────────────────────

export type TripStatus = "draft" | "active" | "completed";

export type TripType =
  | "bachelor_hen"
  | "bachelorette_stag"
  | "romantic"
  | "honeymoon"
  | "birthday"
  | "business"
  | "special_event"
  | "party_trip"
  | "other";

export type BudgetMode = "per_trip" | "per_person";

export interface TripDocument {
  /** Auto-incremented sequential plan number, e.g. 1 → shown as #001 */
  tripNumber?: number;
  tripName: string;
  clientName: string;
  destination: string;
  startDate: Timestamp;
  endDate: Timestamp;
  numberOfPeople: number;
  memberIds: string[];
  inviteCode: string;
  status: TripStatus;
  createdBy: string;
  createdAt: Timestamp;
  /** UID of the first client member to join — shown "Trip Organizer" badge */
  organizerUserId?: string;
  tripType?: TripType;
  budgetFrom?: number;   // in EUR, 100–100000 (100000 means 100000+)
  budgetTo?: number;
  budgetMode?: BudgetMode; // per_trip or per_person
  specialRequirements?: string[]; // "pet" | "toddler" | "kids" | "special_needs" | "elderly" | "lgbtq"
  personalMessage?: string;
  additionalInfoClimate?: string;
  additionalInfoDressCode?: string;
  additionalInfoUsefulTips?: string;
  authorId?: string;
  petSitting?: PetSittingEntry[];
  babysitter?: BabysitterEntry[];
  specialCare?: SpecialCareEntry[];
  isPaid?: boolean;
}

export interface PetSittingEntry {
  id: string;
  type: "hotel" | "pet_sitter";
  name: string;
  phone: string;
  address: string;
  dayTime: string;
  link: string;
  cost: string;
}

export interface BabysitterEntry {
  id: string;
  name: string;
  phone: string;
  address: string;
  dayTime: string;
  cost: string;
  link: string;
}

export interface SpecialCareEntry {
  id: string;
  name: string;
  phone: string;
  address: string;
  dayTime: string;
  cost: string;
  link: string;
}

// Convenience type that includes the Firestore document ID
export interface Trip extends TripDocument {
  id: string;
}

// ─── trips/{tripId}/activities subcollection ─────────────────────────────────

export type ActivityCategory =
  | "activity"
  | "transfer"
  | "meal"
  | "free_time"
  | "surprise"
  | "hotel"
  | "sleep_in_hotel"
  | "wellness_grooming";

export type BreakfastType = "hotel_breakfast" | "special_breakfast" | "no_breakfast";

export type TransferMode = "taxi" | "walking" | "transit";

export interface ActivityDocument {
  title: string;
  description: string;
  date: Timestamp;
  startTime: Timestamp;
  endTime: Timestamp;
  estimatedDuration: number;
  category: ActivityCategory;
  location?: GeoPoint;
  place: string;           // venue / establishment name, e.g. "Sagrada Família"
  address: string;         // street address
  recommendations: string | null;
  contactPhone: string | null;
  contactLink: string | null;
  coordinatorNote: string | null;
  isVisited: boolean;
  visitedBy: string[];
  sortOrder: number;
  isSurprise: boolean;
  surpriseVisibleAt: Timestamp | null;
  // Surprise extra fields
  surpriseDescription?: string;
  surpriseContactName?: string;
  surpriseContactPhone?: string;
  surpriseLink?: string;
  /** When true, the activity is only visible to the trip organizer (default true) */
  surpriseOrganizerOnly?: boolean;
  imageUrl: string | null;
  // Booking & transfer
  isBooked: boolean;
  transferMode: TransferMode;
  transferDuration: number | null; // minutes from previous activity, null if first
  // Reminder / push notification
  reminderEnabled: boolean;
  reminderMinutesBefore: number;
  reminderMessage: string;
  reminderFireAt: Timestamp | null;   // computed: startTime - reminderMinutesBefore
  reminderSent: boolean;
  // Hotel morning card breakfast choice (only on category === "hotel" timeless cards)
  breakfastType?: BreakfastType;
  /** Extra details shown when breakfastType === "special_breakfast" */
  specialBreakfastInfo?: string;
  specialBreakfastContact?: string;
  /** ID of the linked Accommodation document (sleep_in_hotel cards) */
  linkedAccommodationId?: string;
}

export interface Activity extends ActivityDocument {
  id: string;
  tripId: string;
}

// ─── notifications collection ─────────────────────────────────────────────────

export type NotificationType =
  | "upcoming_activity"
  | "surprise"
  | "schedule_change"
  | "general";

export interface NotificationDocument {
  tripId: string;
  activityId: string | null;
  title: string;
  body: string;
  type: NotificationType;
  scheduledFor: Timestamp;
  sent: boolean;
  targetUserIds: string[];
  createdAt: Timestamp;
}

export interface TripNotification extends NotificationDocument {
  id: string;
}

// ─── Accommodation ────────────────────────────────────────────────────────────

export type AccommodationType = "hotel" | "apartment_villa";

export interface AccommodationDocument {
  type: AccommodationType;
  name: string;        // hotel/property name
  address: string;
  contactPhone: string;
  sortOrder: number;
  /** ISO date strings of check-in nights, e.g. ["2024-05-15","2024-05-16"] */
  nights: string[];
}

export interface Accommodation extends AccommodationDocument {
  id: string;
}

// ─── authors collection ───────────────────────────────────────────────────────

export interface AuthorDocument {
  name: string;
  avatarUrl: string | null;
  createdAt: Timestamp;
}

export interface Author extends AuthorDocument {
  id: string;
}

// ─── UI / derived types ───────────────────────────────────────────────────────

/** Status of an activity relative to current time */
export type ActivityStatus = "upcoming" | "active" | "visited" | "missed";

/** Grouped activities for the schedule tab */
export interface ActivitiesByDate {
  date: string; // ISO date string "YYYY-MM-DD"
  activities: Activity[];
}
