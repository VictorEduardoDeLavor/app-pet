"use client";

// "Instalar o app": no Android e no computador o navegador oferece instalar (evento
// beforeinstallprompt, guardado logo na abertura por um script no layout); no iPhone só dá
// pelo Safari, em Compartilhar › Adicionar à Tela de Início, então mostramos o passo a passo.

import { useEffect, useState } from "react";

type PedidoInstalacao = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type Janela = Window & { __pedidoInstalacao?: PedidoInstalacao | null };

export type ModoInstalacao = "carregando" | "instalado" | "pronto" | "iphone" | "manual";

export function rodandoInstalado(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function ehIphone(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function useInstalacao(): { modo: ModoInstalacao; instalar: () => Promise<boolean> } {
  const [modo, setModo] = useState<ModoInstalacao>("carregando");
  useEffect(() => {
    const w = window as Janela;
    const atualizar = () => setModo(rodandoInstalado() ? "instalado" : w.__pedidoInstalacao ? "pronto" : ehIphone() ? "iphone" : "manual");
    atualizar();
    window.addEventListener("pedido-instalacao", atualizar);
    window.addEventListener("appinstalled", atualizar);
    return () => {
      window.removeEventListener("pedido-instalacao", atualizar);
      window.removeEventListener("appinstalled", atualizar);
    };
  }, []);

  const instalar = async () => {
    const w = window as Janela;
    const pedido = w.__pedidoInstalacao;
    if (!pedido) return false;
    await pedido.prompt();
    const { outcome } = await pedido.userChoice;
    w.__pedidoInstalacao = null;
    setModo(outcome === "accepted" ? "instalado" : ehIphone() ? "iphone" : "manual");
    return outcome === "accepted";
  };

  return { modo, instalar };
}
