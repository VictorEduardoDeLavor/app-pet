"use client";

// Mapa do leva e traz: OpenStreetMap + Leaflet (abertos, gratuitos e sem chave de API).
// O carro desliza de um ponto ao outro, como nos apps de entrega.

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Circle, Map as LMap, Marker } from "leaflet";

const CARRO_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>';

export function MapaCarro({ lat, lng, precisao, className }: { lat: number; lng: number; precisao?: number; className?: string }) {
  const div = useRef<HTMLDivElement>(null);
  const mapa = useRef<LMap | null>(null);
  const carro = useRef<Marker | null>(null);
  const area = useRef<Circle | null>(null);
  const alvo = useRef({ lat, lng, precisao });
  alvo.current = { lat, lng, precisao };

  // Cria o mapa uma vez (o Leaflet só existe no navegador).
  useEffect(() => {
    let vivo = true;
    (async () => {
      const L = (await import("leaflet")).default;
      if (!vivo || !div.current || mapa.current) return;
      const { lat: la, lng: ln, precisao: pr } = alvo.current;
      const m = L.map(div.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: false }).setView([la, ln], 16);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
      }).addTo(m);
      L.control.zoom({ position: "bottomright" }).addTo(m);
      area.current = L.circle([la, ln], { radius: Math.min(pr ?? 30, 200), color: "#6a4fe3", weight: 1, fillColor: "#6a4fe3", fillOpacity: 0.08 }).addTo(m);
      carro.current = L.marker([la, ln], {
        icon: L.divIcon({ className: "", html: `<div class="pin-carro">${CARRO_SVG}</div>`, iconSize: [44, 44], iconAnchor: [22, 22] }),
        keyboard: false,
      }).addTo(m);
      mapa.current = m;
    })();
    return () => {
      vivo = false;
      mapa.current?.remove();
      mapa.current = null;
      carro.current = null;
      area.current = null;
    };
  }, []);

  // A cada posição nova, o carro desliza até lá em ~1,2 s e o mapa acompanha.
  useEffect(() => {
    const m = mapa.current;
    const c = carro.current;
    if (!m || !c) return;
    const de = c.getLatLng();
    const inicio = performance.now();
    let quadro = 0;
    const passo = (t: number) => {
      const k = Math.min(1, (t - inicio) / 1200);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      const p: [number, number] = [de.lat + (lat - de.lat) * e, de.lng + (lng - de.lng) * e];
      c.setLatLng(p);
      area.current?.setLatLng(p);
      if (k < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    if (precisao) area.current?.setRadius(Math.min(precisao, 200));
    m.panTo([lat, lng], { animate: true, duration: 1.2 });
    return () => cancelAnimationFrame(quadro);
  }, [lat, lng, precisao]);

  return <div ref={div} className={className} role="img" aria-label="Mapa com a posição do carro" />;
}
