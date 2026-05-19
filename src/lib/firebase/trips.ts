import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  arrayUnion,
  where,
} from "firebase/firestore";
import type { TripDocument } from "@/types";
import { db, COLLECTIONS } from "./firestore";

/**
 * Checks if an invite code is valid without joining the trip.
 * Returns { tripId, tripName } on success, null if code is invalid.
 */
export async function lookupInviteCode(
  rawCode: string
): Promise<{ tripId: string; tripName: string } | null> {
  const code = rawCode.trim().toUpperCase();
  const q = query(collection(db, COLLECTIONS.TRIPS), where("inviteCode", "==", code));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { tripId: d.id, tripName: (d.data() as { tripName: string }).tripName };
}

/**
 * Joins a trip by invite code.
 * Looks up the trip, then atomically adds the user to both
 * trip.memberIds and user.tripIds.
 *
 * Returns the tripId on success, null if code is invalid.
 */
export async function joinTripByCode(
  uid: string,
  rawCode: string
): Promise<string | null> {
  const code = rawCode.trim().toUpperCase();

  const q = query(
    collection(db, COLLECTIONS.TRIPS),
    where("inviteCode", "==", code)
  );
  const snap = await getDocs(q);

  if (snap.empty) return null;

  const tripDoc = snap.docs[0];
  const tripId = tripDoc.id;
  const tripData = tripDoc.data() as TripDocument;

  // First client to join becomes the trip organizer
  const isFirstMember = !tripData.organizerUserId && (tripData.memberIds ?? []).length === 0;

  const tripUpdate: Record<string, unknown> = { memberIds: arrayUnion(uid) };
  if (isFirstMember) tripUpdate.organizerUserId = uid;

  await Promise.all([
    updateDoc(doc(db, COLLECTIONS.TRIPS, tripId), tripUpdate),
    updateDoc(doc(db, COLLECTIONS.USERS, uid), {
      tripIds: arrayUnion(tripId),
    }),
  ]);

  return tripId;
}
