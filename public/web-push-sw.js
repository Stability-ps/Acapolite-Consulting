self.addEventListener("push", (event) => {
  const fallbackNotification = {
    title: "Acapolite Notification",
    body: "You have a new update waiting in your portal.",
    url: "/dashboard",
    tag: "acapolite-update",
  };

  let payload = fallbackNotification;

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = {
        ...fallbackNotification,
        ...parsed,
      };
    } catch (_error) {
      const text = event.data.text();
      payload = {
        ...fallbackNotification,
        body: text || fallbackNotification.body,
      };
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: payload.tag,
      data: {
        url: payload.url,
      },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = new URL(event.notification.data?.url || "/dashboard", self.location.origin).toString();

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === targetUrl && "focus" in client) {
          return client.focus();
        }
      }

      return self.clients.openWindow(targetUrl);
    }),
  );
});
