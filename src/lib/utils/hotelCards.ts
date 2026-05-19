import {
  collection, addDoc, getDocs, deleteDoc, doc, query, where, serverTimestamp,
} from "firebase/firestore";
import { db, COLLECTIONS, SUBCOLLECTIONS } from "@/lib/firebase/firestore";
import { parseMadridDateTime, parseMadridDate } from "@/lib/utils/adminDatetime";

interface AccomInfo {
  id: string;
  name: string;
  nights: string[];
}

/**
 * Syncs hotel cards for an accommodation to match its current nights array.
 *
 * - Deletes cards whose night was removed from accom.nights
 * - Deletes duplicate (category, date) pairs left by previous bugs
 * - Creates cards for nights that have no card yet
 *
 * Card pattern per night N:
 *   sleep_in_hotel 23:00 on N         (every night)
 *   hotel morning  00:00 on N+1       (skipped for first trip day and beyond trip end)
 */
export async function syncHotelCardsForAccommodation(
  tripId: string,
  accom: AccomInfo,
  tripStartDate: string,
  tripEndDate: string,
): Promise<void> {
  const actColl = collection(db, COLLECTIONS.TRIPS, tripId, SUBCOLLECTIONS.ACTIVITIES);

  // Build set of (category__dateStr) keys that should exist
  const expected = new Set<string>();
  for (const night of accom.nights ?? []) {
    expected.add(`sleep_in_hotel__${night}`);
    const [y, m, d] = night.split("-").map(Number);
    const nextDay = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
    if (nextDay !== tripStartDate && nextDay <= tripEndDate) {
      expected.add(`hotel__${nextDay}`);
    }
  }

  // Query all existing cards linked to this accommodation
  const snap = await getDocs(query(actColl, where("linkedAccommodationId", "==", accom.id)));

  const toDelete: string[] = [];
  const existingKeys = new Set<string>();

  snap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const dateKey = (data.date as { toDate(): Date }).toDate()
      .toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
    const key = `${data.category as string}__${dateKey}`;

    if (!expected.has(key) || existingKeys.has(key)) {
      toDelete.push(docSnap.id);
    } else {
      existingKeys.add(key);
    }
  });

  if (toDelete.length > 0) {
    await Promise.all(toDelete.map((id) => deleteDoc(doc(actColl, id))));
  }

  // Build the set of morning dates this accommodation manages, then delete any
  // non-linked (orphaned) hotel morning cards for those same dates. These are
  // created by the "creatingHotelRef" effect for manually-added sleep activities
  // that predate the accommodation being set up.
  const managedMorningDates = new Set<string>();
  for (const night of accom.nights ?? []) {
    const [y, m, d] = night.split("-").map(Number);
    const nextDay = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
    if (nextDay !== tripStartDate && nextDay <= tripEndDate) {
      managedMorningDates.add(nextDay);
    }
  }
  if (managedMorningDates.size > 0) {
    const allMorningsSnap = await getDocs(
      query(actColl, where("category", "==", "hotel")),
    );
    const orphans = allMorningsSnap.docs.filter((d) => {
      const data = d.data();
      if (data.estimatedDuration !== 0) return false;
      if (data.linkedAccommodationId) return false;
      const dateKey = (data.date as { toDate(): Date }).toDate()
        .toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
      return managedMorningDates.has(dateKey);
    });
    if (orphans.length > 0) {
      await Promise.all(orphans.map((d) => deleteDoc(doc(actColl, d.id))));
    }
  }

  // Nothing new to create
  const missing = [...expected].filter((k) => !existingKeys.has(k));
  if (missing.length === 0) return;

  // Append new cards after whatever is already in the collection
  const allSnap = await getDocs(actColl);
  const maxSort = allSnap.docs.length > 0
    ? Math.max(...allSnap.docs.map((d) => (d.data().sortOrder as number) ?? 0))
    : 0;
  let sortOrder = maxSort;

  const sortedNights = [...(accom.nights ?? [])].sort();
  for (const night of sortedNights) {
    const nightKey = `sleep_in_hotel__${night}`;
    if (missing.includes(nightKey)) {
      sortOrder += 10;
      const nightTs = parseMadridDateTime(night, "23:00");
      await addDoc(actColl, {
        title:                 accom.name || "Hotel Night",
        description:           "",
        date:                  parseMadridDate(night),
        startTime:             nightTs,
        endTime:               nightTs,
        estimatedDuration:     0,
        category:              "sleep_in_hotel",
        place:                 accom.name,
        address:               "",
        recommendations:       null,
        contactPhone:          null,
        contactLink:           null,
        coordinatorNote:       null,
        isVisited:             false,
        visitedBy:             [],
        sortOrder,
        isSurprise:            false,
        surpriseVisibleAt:     null,
        surpriseDescription:   "",
        surpriseOrganizerOnly: true,
        imageUrl:              null,
        isBooked:              false,
        transferMode:          "taxi",
        transferDuration:      null,
        reminderEnabled:       false,
        reminderMinutesBefore: 30,
        reminderMessage:       "",
        reminderFireAt:        null,
        reminderSent:          false,
        linkedAccommodationId: accom.id,
        createdAt:             serverTimestamp(),
      });
    }

    const [y, m, d] = night.split("-").map(Number);
    const nextDay = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
    if (nextDay === tripStartDate || nextDay > tripEndDate) continue;

    const morningKey = `hotel__${nextDay}`;
    if (missing.includes(morningKey)) {
      sortOrder += 10;
      const midnightTs = parseMadridDateTime(nextDay, "00:00");
      await addDoc(actColl, {
        title:                 accom.name ? `${accom.name} – Morning` : "Hotel Morning",
        description:           "",
        date:                  parseMadridDate(nextDay),
        startTime:             midnightTs,
        endTime:               midnightTs,
        estimatedDuration:     0,
        category:              "hotel",
        place:                 accom.name,
        address:               "",
        breakfastType:         "hotel_breakfast",
        recommendations:       null,
        contactPhone:          null,
        contactLink:           null,
        coordinatorNote:       null,
        isVisited:             false,
        visitedBy:             [],
        sortOrder,
        isSurprise:            false,
        surpriseVisibleAt:     null,
        surpriseDescription:   "",
        surpriseOrganizerOnly: true,
        imageUrl:              null,
        isBooked:              false,
        transferMode:          "taxi",
        transferDuration:      null,
        reminderEnabled:       false,
        reminderMinutesBefore: 0,
        reminderMessage:       "",
        reminderFireAt:        null,
        reminderSent:          false,
        linkedAccommodationId: accom.id,
        createdAt:             serverTimestamp(),
      });
    }
  }
}
