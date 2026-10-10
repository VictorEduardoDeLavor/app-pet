"use client";

import { useEffect, useState } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { MARCA } from "@/lib/marca";
import { useInstalacao } from "@/lib/instalar";
import { Botao, cx } from "./ui";
import { useToast } from "./providers";

const CHAVE_DISPENSADO = "instalar-app-dispensado";

/** Cartão "Instalar o app": botão no Android/computador, passo a passo no iPhone. */
export function InstalarApp({ compacto = false, aoFechar, className }: { compacto?: boolean; aoFechar?: () => void; className?: string }) {
  const { modo, instalar } = useInstalacao();
  const toast = useToast();
  const [passos, setPassos] = useState(!compacto);
  if (modo === "carregando" || modo === "instalado") return null;

  return (
    <div className={cx("relative rounded-[22px] border border-brand-200 bg-brand-50 px-4 py-3.5", className)}>
      {aoFechar && (
        <button onClick={aoFechar} aria-label="Agora não" className="tap absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-white">
          <X className="h-4 w-4" />
        </button>
      )}
      <div className="flex items-start gap-3 pr-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-[12px]" />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold">Instale o {MARCA.nome} no celular</p>
          <p className="text-[13px] leading-snug text-muted">Ícone na tela inicial e abre direto, sem a barra do navegador.</p>
        </div>
      </div>

      {modo === "pronto" && (
        <Botao
          className="mt-3 !h-11"
          icone={<Download className="h-[18px] w-[18px]" />}
          onClick={async () => {
            if (await instalar()) toast("App instalado na tela inicial");
          }}
        >
          Instalar o app
        </Botao>
      )}

      {modo !== "pronto" && !passos && (
        <button onClick={() => setPassos(true)} className="mt-2 text-[14px] font-semibold text-brand-700">
          Como instalar
        </button>
      )}

      {modo === "iphone" && passos && (
        <ol className="mt-3 space-y-2 text-[14px]">
          <li className="flex items-center gap-2.5">
            <Passo n={1} />
            <span>
              No <b>Safari</b>, toque em Compartilhar <Share className="inline h-4 w-4 align-[-2px] text-brand-700" aria-label="ícone de compartilhar" />
            </span>
          </li>
          <li className="flex items-center gap-2.5">
            <Passo n={2} />
            <span>
              Escolha <b>Adicionar à Tela de Início</b> <SquarePlus className="inline h-4 w-4 align-[-2px] text-brand-700" aria-hidden />
            </span>
          </li>
          <li className="flex items-center gap-2.5">
            <Passo n={3} />
            <span>
              Toque em <b>Adicionar</b>. Pronto: o ícone fica na tela.
            </span>
          </li>
        </ol>
      )}

      {modo === "manual" && passos && (
        <ol className="mt-3 space-y-2 text-[14px]">
          <li className="flex items-center gap-2.5">
            <Passo n={1} />
            <span>
              Abra o menu do navegador (<b>⋮</b> no Chrome)
            </span>
          </li>
          <li className="flex items-center gap-2.5">
            <Passo n={2} />
            <span>
              Toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>
            </span>
          </li>
        </ol>
      )}
    </div>
  );
}

function Passo({ n }: { n: number }) {
  return <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-[12.5px] font-bold text-brand-700">{n}</span>;
}

/** Aviso no Início, uma vez por aparelho: some ao instalar ou ao tocar em "Agora não". */
export function AvisoInstalarApp({ className }: { className?: string }) {
  const [dispensado, setDispensado] = useState(true);
  useEffect(() => {
    try {
      setDispensado(localStorage.getItem(CHAVE_DISPENSADO) === "1");
    } catch {
      setDispensado(false);
    }
  }, []);
  if (dispensado) return null;
  return (
    <InstalarApp
      compacto
      className={className}
      aoFechar={() => {
        setDispensado(true);
        try {
          localStorage.setItem(CHAVE_DISPENSADO, "1");
        } catch {
          // Sem armazenamento (aba anônima): só esconde agora.
        }
      }}
    />
  );
}
