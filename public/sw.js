// Service worker do APP PET.
// Serve para duas coisas: o celular reconhecer o app como instalável e mostrar uma tela
// amigável quando abre sem internet. De propósito, NÃO guarda telas nem dados do app:
// tudo continua vindo da internet, sempre atualizado depois de cada nova versão.
const CACHE = "app-pet-offline-v2";
const OFFLINE = "/offline.html";

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([OFFLINE, "/icon-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (evento) => {
  const { request } = evento;
  // Só a abertura de páginas (e o ícone da tela sem internet); arquivos, fotos e chamadas ao
  // banco seguem direto para a internet.
  if (request.mode === "navigate") {
    evento.respondWith(fetch(request).catch(() => caches.match(OFFLINE)));
  } else if (request.method === "GET" && new URL(request.url).pathname === "/icon-192.png") {
    evento.respondWith(fetch(request).catch(() => caches.match("/icon-192.png")));
  }
});
