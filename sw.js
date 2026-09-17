const CACHE_NAME = "simple-notebook-shell-v3";
const SHELL = ["./", "./index.html", "./styles.css", "./manifest.webmanifest", "./icons/notebook.svg", "./src/app.js", "./src/db.js", "./src/editor.js", "./src/note-model.js", "./src/persistence.js"];

self.addEventListener("install", (event) => { event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL))); });
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)))));
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request, { ignoreSearch: event.request.mode === "navigate" }).then((cached) => {
    if (cached) return cached;
    return fetch(event.request).then((response) => {
      if (!response.ok || response.type !== "basic") return response;
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      return response;
    });
  }));
});
