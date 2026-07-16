/* Firebase Cloud Messaging service worker (background push).
   Loaded separately from the next-pwa Workbox SW. */
/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAA9mycSKDJ_2uUIz5pODnaozeBFKRvR0o",
  authDomain: "midland-25cd2.firebaseapp.com",
  projectId: "midland-25cd2",
  storageBucket: "midland-25cd2.firebasestorage.app",
  messagingSenderId: "969913622454",
  appId: "1:969913622454:web:2bb72bd6730ab70a1e2b17",
  measurementId: "G-JK7L0R8F1G",
});

try {
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || "Midland Meetups";
    const options = {
      body: payload.notification?.body || "",
      icon: "/icons/icon-192.png",
      data: payload.data,
    };
    self.registration.showNotification(title, options);
  });
} catch (e) {
  console.warn("FCM SW not fully configured", e);
}
