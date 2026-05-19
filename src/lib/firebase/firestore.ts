import { getFirestore, Firestore } from "firebase/firestore";
import { app } from "./config";

export const db: Firestore = app ? getFirestore(app) : (null as unknown as Firestore);

export const COLLECTIONS = {
  USERS:         "users",
  TRIPS:         "trips",
  NOTIFICATIONS: "notifications",
  AUTHORS:       "authors",
  /** Internal metadata (counters, etc.) */
  META:          "_meta",
} as const;

export const SUBCOLLECTIONS = {
  ACTIVITIES:      "activities",
  ACCOMMODATIONS:  "accommodations",
} as const;
