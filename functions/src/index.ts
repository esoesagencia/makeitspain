import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

/**
 * Runs every minute. Finds activities with a reminder due
 * that haven't been sent yet, fires FCM push notifications, marks as sent.
 */
export const sendActivityReminders = onSchedule(
  { schedule: "every 1 minutes", timeoutSeconds: 60, memory: "256MiB" },
  async () => {
    const now = admin.firestore.Timestamp.now();

    const snapshot = await db
      .collectionGroup("activities")
      .where("reminderEnabled", "==", true)
      .where("reminderSent",    "==", false)
      .where("reminderFireAt",  "<=", now)
      .get();

    if (snapshot.empty) return;

    const batch = db.batch();
    const sends: Promise<unknown>[] = [];

    for (const actDoc of snapshot.docs) {
      const activity = actDoc.data();
      const tripId: string = actDoc.ref.parent.parent!.id;

      const tripSnap = await db.collection("trips").doc(tripId).get();
      if (!tripSnap.exists) continue;

      const memberIds: string[] = tripSnap.data()?.memberIds ?? [];
      if (memberIds.length === 0) continue;

      const userSnaps = await Promise.all(
        memberIds.map((uid) => db.collection("users").doc(uid).get()),
      );
      const tokens = userSnaps
        .map((s) => (s.data()?.fcmToken as string | undefined))
        .filter((t): t is string => !!t);

      if (tokens.length === 0) {
        batch.update(actDoc.ref, { reminderSent: true });
        continue;
      }

      const title = (activity.title as string) ?? "Upcoming activity";
      const body  = ((activity.reminderMessage as string) ?? "").trim()
        || `${title} is starting soon!`;

      const message: admin.messaging.MulticastMessage = {
        tokens,
        notification: { title, body },
        webpush: {
          notification: {
            title, body,
            icon:  "/icons/icon-192.png",
            badge: "/icons/icon-192.png",
          },
        },
      };

      sends.push(
        admin.messaging()
          .sendEachForMulticast(message)
          .catch((err: unknown) => console.error(`FCM failed for ${actDoc.id}:`, err)),
      );

      batch.update(actDoc.ref, { reminderSent: true });
    }

    await Promise.all(sends);
    await batch.commit();

    console.log(`Sent ${snapshot.size} reminder(s).`);
  },
);
