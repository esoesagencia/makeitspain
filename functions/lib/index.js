"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendActivityReminders = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const db = admin.firestore();
/**
 * Runs every minute. Finds activities with a reminder due
 * that haven't been sent yet, fires FCM push notifications, marks as sent.
 */
exports.sendActivityReminders = (0, scheduler_1.onSchedule)({ schedule: "every 1 minutes", timeoutSeconds: 60, memory: "256MiB" }, async () => {
    const now = admin.firestore.Timestamp.now();
    const snapshot = await db
        .collectionGroup("activities")
        .where("reminderEnabled", "==", true)
        .where("reminderSent", "==", false)
        .where("reminderFireAt", "<=", now)
        .get();
    if (snapshot.empty)
        return;
    const batch = db.batch();
    const sends = [];
    for (const actDoc of snapshot.docs) {
        const activity = actDoc.data();
        const tripId = actDoc.ref.parent.parent.id;
        const tripSnap = await db.collection("trips").doc(tripId).get();
        if (!tripSnap.exists)
            continue;
        const memberIds = tripSnap.data()?.memberIds ?? [];
        if (memberIds.length === 0)
            continue;
        const userSnaps = await Promise.all(memberIds.map((uid) => db.collection("users").doc(uid).get()));
        const tokens = userSnaps
            .map((s) => s.data()?.fcmToken)
            .filter((t) => !!t);
        if (tokens.length === 0) {
            batch.update(actDoc.ref, { reminderSent: true });
            continue;
        }
        const title = activity.title ?? "Upcoming activity";
        const body = (activity.reminderMessage ?? "").trim()
            || `${title} is starting soon!`;
        const message = {
            tokens,
            notification: { title, body },
            webpush: {
                notification: {
                    title, body,
                    icon: "/icons/icon-192.png",
                    badge: "/icons/icon-192.png",
                },
            },
        };
        sends.push(admin.messaging()
            .sendEachForMulticast(message)
            .catch((err) => console.error(`FCM failed for ${actDoc.id}:`, err)));
        batch.update(actDoc.ref, { reminderSent: true });
    }
    await Promise.all(sends);
    await batch.commit();
    console.log(`Sent ${snapshot.size} reminder(s).`);
});
//# sourceMappingURL=index.js.map