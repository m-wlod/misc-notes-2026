/* Web push (Phase 15): show the notification, open its page on click. Nothing else. */
self.addEventListener("push", (event) => {
  let data = { title: "", body: "", url: "/" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    /* not JSON: show nothing special */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      data: { url: data.url },
      icon: "/favicon.ico",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(self.clients.openWindow(url));
});
