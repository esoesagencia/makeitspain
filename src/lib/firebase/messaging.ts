import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { app } from "./config";

// Messaging is browser-only — guard against SSR
export const getMessagingInstance = () => {
  if (typeof window === "undefined") return null;
  return app ? getMessaging(app) : null;
};

export const requestNotificationPermission = async (): Promise<string | null> => {
  const messaging = getMessagingInstance();
  if (!messaging) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const token = await getToken(messaging, {
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
  });

  return token;
};

export { onMessage };
