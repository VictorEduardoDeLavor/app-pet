// Fica fora de instalar.ts (que é "use client") para o layout do servidor poder ler o texto.

/** Script do layout: guarda o pedido de instalação e registra o service worker. */
export const SCRIPT_INSTALACAO = `
window.addEventListener("beforeinstallprompt", function (e) {
  e.preventDefault();
  window.__pedidoInstalacao = e;
  window.dispatchEvent(new Event("pedido-instalacao"));
});
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () { navigator.serviceWorker.register("/sw.js").catch(function () {}); });
}
`;
