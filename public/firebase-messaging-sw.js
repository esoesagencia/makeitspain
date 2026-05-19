importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey:            "AIzaSyCBfSoMbU21hAJD-F5SMzrXdXprZxW98qA",
  authDomain:        "make-it-spain-app.firebaseapp.com",
  projectId:         "make-it-spain-app",
  storageBucket:     "make-it-spain-app.firebasestorage.app",
  messagingSenderId: "182776893011",
  appId:             "1:182776893011:web:22fd4f876537e9484f00a6",
});

const messaging = firebase.messaging();

// Handle background notifications (app closed or backgrounded)
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {};
  if (!title) return;

  self.registration.showNotification(title, {
    body: body ?? "",
    icon:  "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    sound: "/notification-sound.wav", // honoured on Android Chrome
  });

  // For open clients (app visible in another tab): relay the payload so the
  // foreground handler can play the sound via Web Audio API.
  self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    clients.forEach((client) => client.postMessage({ type: "FCM_BACKGROUND", payload }));
  });
});
