"use client";

import { useEffect } from "react";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { doc, updateDoc } from "firebase/firestore";
import { app } from "@/lib/firebase/config";
import { db, COLLECTIONS } from "@/lib/firebase/firestore";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? "";
const SOUND_URL  = "/notification-sound.wav";

function playNotificationSound() {
  try {
    const audio = new Audio(SOUND_URL);
    audio.volume = 0.8;
    audio.play().catch(() => {
      // Autoplay blocked (no prior interaction) — silently ignore
    });
  } catch {
    // Audio not supported
  }
}

/**
 * Requests notification permission, saves the FCM token to Firestore,
 * and handles foreground messages (plays custom sound + shows a native notification).
 */
export function useFCMToken(uid: string | null) {
  useEffect(() => {
    if (!uid || !app || typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;

    let unsubscribe: (() => void) | null = null;

    async function register() {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        const sw = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
        const messaging = getMessaging(app!);
        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: sw,
        });

        if (token && uid) {
          await updateDoc(doc(db, COLLECTIONS.USERS, uid), { fcmToken: token });
        }

        // Foreground: FCM delivers the message to JS instead of showing a notification.
        // We play the sound and show a native notification manually.
        unsubscribe = onMessage(messaging, (payload) => {
          const title = payload.notification?.title ?? "MakeItSpain";
          const body  = payload.notification?.body  ?? "";
          playNotificationSound();
          new Notification(title, {
            body,
            icon:  "/icons/icon-192.png",
            badge: "/icons/icon-192.png",
          });
        });

        // Also handle messages relayed from the service worker (background tab that became active)
        const swMessageHandler = (event: MessageEvent) => {
          if (event.data?.type !== "FCM_BACKGROUND") return;
          playNotificationSound();
        };
        navigator.serviceWorker.addEventListener("message", swMessageHandler);

        const origUnsub = unsubscribe;
        unsubscribe = () => {
          origUnsub();
          navigator.serviceWorker.removeEventListener("message", swMessageHandler);
        };
      } catch (err) {
        console.warn("FCM token registration failed:", err);
      }
    }

    register();
    return () => { unsubscribe?.(); };
  }, [uid]);
}
