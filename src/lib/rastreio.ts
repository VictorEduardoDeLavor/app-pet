"use client";

// Compartilhamento da localização do motorista (leva e traz).
// Usa o GPS do celular pelo navegador (Geolocation API, padrão da web, sem custo nem chave):
// o motorista toca em "Saí para buscar", autoriza a localização e o app manda a posição a cada
// poucos segundos enquanto o app estiver aberto. A mesma posição vale para todos os pets que ele
// está levando ou buscando naquela viagem. Para quando não há mais nenhum pet "na rua" com ele.

import { create } from "zustand";

export interface PontoGps {
  lat: number;
  lng: number;
  precisao: number; // metros
  em: string; // ISO
}

const INTERVALO_MS = 5000; // no máximo uma posição a cada 5 s…
const DISTANCIA_M = 10; // …e só quando o carro andou pelo menos 10 m (parado, manda a cada 30 s)
const PARADO_MS = 30000;

interface Rastreio {
  ativo: boolean;
  ultima: PontoGps | null;
  erro: string | null;
  enviadas: number;
  /** Liga o GPS; `enviar` recebe cada ponto e decide para quais atendimentos ele vale. */
  iniciar: (enviar: (p: PontoGps) => void) => void;
  parar: () => void;
}

let watchId: number | null = null;
let wakeLock: { release: () => Promise<void> } | null = null;
let ultimoEnvio = 0;
let ultimaPos: { lat: number; lng: number } | null = null;

/** Distância aproximada em metros entre dois pontos (fórmula de haversine). */
export function distanciaM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Decide se um ponto novo vale o envio (economiza bateria, dados e banco). */
export function deveEnviar(agora: number, ultimoEnvioEm: number, anterior: { lat: number; lng: number } | null, atual: { lat: number; lng: number }): boolean {
  if (!anterior || ultimoEnvioEm === 0) return true;
  const passou = agora - ultimoEnvioEm;
  if (passou >= PARADO_MS) return true;
  return passou >= INTERVALO_MS && distanciaM(anterior, atual) >= DISTANCIA_M;
}

function traduzirErroGps(e: GeolocationPositionError): string {
  if (e.code === e.PERMISSION_DENIED) return "A localização está bloqueada. Libere o acesso à localização para este site nas configurações do navegador.";
  if (e.code === e.POSITION_UNAVAILABLE) return "Sem sinal de GPS no momento. Continuamos tentando.";
  return "O GPS demorou para responder. Continuamos tentando.";
}

export const useRastreio = create<Rastreio>()((set, get) => ({
  ativo: false,
  ultima: null,
  erro: null,
  enviadas: 0,

  iniciar: (enviar) => {
    get().parar();
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      set({ erro: "Este aparelho não oferece GPS no navegador." });
      return;
    }
    set({ ativo: true, erro: null, ultima: null, enviadas: 0 });
    ultimoEnvio = 0;
    ultimaPos = null;

    // Mantém a tela ligada enquanto compartilha (quando o aparelho permite).
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request("screen").then((w) => (wakeLock = w)).catch(() => undefined);

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const agora = Date.now();
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!deveEnviar(agora, ultimoEnvio, ultimaPos, p)) return;
        ultimoEnvio = agora;
        ultimaPos = p;
        const ponto: PontoGps = { ...p, precisao: Math.round(pos.coords.accuracy), em: new Date(agora).toISOString() };
        set((s) => ({ ultima: ponto, erro: null, enviadas: s.enviadas + 1 }));
        enviar(ponto);
      },
      (e) => set({ erro: traduzirErroGps(e) }),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 },
    );
  },

  parar: () => {
    if (watchId !== null && typeof navigator !== "undefined") navigator.geolocation.clearWatch(watchId);
    watchId = null;
    wakeLock?.release().catch(() => undefined);
    wakeLock = null;
    set({ ativo: false, erro: null });
  },
}));
