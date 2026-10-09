"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ChevronRight, CreditCard, FileCheck2, LifeBuoy, Lock, LogOut } from "lucide-react";
import { useApp } from "@/data/store";
import { aceitarTermos, useAssinatura } from "@/data/assinatura";
import { faturaEmAberto, situacao } from "@/domain/assinatura";
import { supabase } from "@/lib/supabase/client";
import { MARCA, linkSuporte } from "@/lib/marca";
import { Botao, BotaoExterno, BotaoLink, Folha, cx } from "./ui";
import { useSessao, useToast } from "./providers";

/**
 * Fecha o app quando a assinatura não está liberada (o banco já fecha os dados; aqui fica a explicação).
 * A tela de assinatura continua aberta para o dono pagar.
 */
export function PortaoAssinatura({ children }: { children: ReactNode }) {
  const info = useAssinatura((s) => s.info);
  const modo = useApp((s) => s.modo);
  const caminho = usePathname();
  const nuvem = modo === "nuvem";

  if (nuvem && info && !info.liberado && !caminho.startsWith("/assinatura")) return <TelaBloqueio />;
  return (
    <>
      {children}
      {nuvem && info?.dono && info.liberado && info.termosVersao !== MARCA.versaoTermos && <AceiteTermos />}
    </>
  );
}

function TelaBloqueio() {
  const info = useAssinatura((s) => s.info)!;
  const nomePetshop = useApp((s) => s.db.petshop.nome);
  const { sair } = useSessao();
  const s = situacao(info);
  const aberta = faturaEmAberto(info);
  const suporte = linkSuporte(`Olá! Sou do ${nomePetshop} e o acesso ao ${MARCA.nome} está suspenso.`);

  return (
    <main className="mx-auto flex min-h-dvh max-w-[440px] flex-col bg-white px-6 pb-10 pt-6 sm:border-x sm:border-line">
      <div className="relative h-44 overflow-hidden rounded-[28px] bg-[#efe6dc] shadow-[var(--shadow-hero)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/fotos/boas-vindas.webp" alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: "center 45%" }} />
        <span className="absolute bottom-4 left-4 grid h-12 w-12 place-items-center rounded-2xl bg-white/90 text-brand-600 shadow-sm backdrop-blur">
          <Lock className="h-6 w-6" strokeWidth={2.2} />
        </span>
      </div>
      <p className="mt-6 text-[13px] font-semibold uppercase tracking-[0.14em] text-brand-600">{nomePetshop}</p>
      <h1 className="mt-1 text-[26px] font-bold leading-tight tracking-tight">{s.titulo}</h1>
      <p className="mt-2 text-[15px] text-muted">
        {info.dono ? s.texto : "O acesso do pet shop está pausado até a assinatura ser regularizada. Peça para o dono do pet shop abrir o app; seus dados e sua fila estão guardados."}
      </p>

      <div className="mt-7 space-y-3">
        {info.dono && aberta?.link && (
          <BotaoExterno href={aberta.link} icone={<CreditCard className="h-5 w-5" />}>
            Pagar agora
          </BotaoExterno>
        )}
        {info.dono && (
          <BotaoLink href="/assinatura" icone={<ChevronRight className="h-5 w-5" />}>
            {aberta?.link ? "Ver assinatura" : info.assinada ? "Ver assinatura e faturas" : `Assinar por R$ ${info.valor}/mês`}
          </BotaoLink>
        )}
        {suporte && (
          <a href={suporte} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-2xl py-3 text-[14.5px] font-semibold text-brand-700">
            <LifeBuoy className="h-[18px] w-[18px]" /> Falar com o suporte
          </a>
        )}
      </div>
      <button onClick={sair} className="mt-auto flex items-center justify-center gap-2 pt-10 text-[14px] text-muted">
        <LogOut className="h-4 w-4" /> Sair desta conta
      </button>
    </main>
  );
}

/** Pede o aceite quando os termos mudam de versão (o cadastro novo já aceita na criação do pet shop). */
function AceiteTermos() {
  const petshopId = useApp((s) => s.petshopId);
  const recarregar = useAssinatura((s) => s.recarregar);
  const toast = useToast();
  const [marcado, setMarcado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function aceitar() {
    if (!petshopId) return;
    setEnviando(true);
    try {
      await aceitarTermos(supabase(), petshopId, MARCA.versaoTermos);
      await recarregar(supabase(), petshopId);
      toast("Obrigado! Termos aceitos.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível registrar o aceite.", "erro");
      setEnviando(false);
    }
  }

  return (
    <Folha aberta onFechar={() => {}} titulo="Termos de uso e privacidade">
      <div className="space-y-4 pb-2">
        <p className="text-[14.5px] text-muted">
          Para seguir usando o {MARCA.nome}, leia e aceite os termos. Eles explicam a assinatura, o que fazemos com os dados dos seus clientes, das fotos e da localização do motorista.
        </p>
        <div className="divide-y divide-line rounded-2xl border border-line">
          <a href="/termos" target="_blank" className="flex items-center justify-between px-4 py-3 text-[14.5px] font-medium">
            Termos de uso <ChevronRight className="h-4 w-4 text-muted" />
          </a>
          <a href="/privacidade" target="_blank" className="flex items-center justify-between px-4 py-3 text-[14.5px] font-medium">
            Política de privacidade <ChevronRight className="h-4 w-4 text-muted" />
          </a>
        </div>
        <label className="flex items-start gap-3 text-[14.5px]">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-[var(--color-brand-600)]" checked={marcado} onChange={(e) => setMarcado(e.target.checked)} />
          <span>Li e aceito os termos de uso e a política de privacidade em nome do pet shop.</span>
        </label>
        <Botao disabled={!marcado || enviando} onClick={aceitar} icone={<FileCheck2 className="h-5 w-5" />}>
          {enviando ? "Aguarde…" : "Aceitar e continuar"}
        </Botao>
      </div>
    </Folha>
  );
}

/** Faixa na tela inicial do dono: dias de teste, fatura em aberto ou cancelamento agendado. */
export function FaixaAssinatura({ className }: { className?: string }) {
  const info = useAssinatura((s) => s.info);
  if (!info || !info.dono) return null;
  const s = situacao(info);
  if (!["teste", "pendente", "cancelada_em_uso", "liberada"].includes(s.fase)) return null;
  if (s.fase === "teste" && info.assinada && !info.demo) return null; // já assinou: nada a fazer até o vencimento
  const urgente = s.tom === "aviso";
  return (
    <Link
      href="/assinatura"
      className={cx(
        "tap flex items-center gap-3 rounded-[20px] border px-4 py-3",
        urgente ? "border-warn-100 bg-warn-50" : "border-brand-200 bg-brand-50",
        className,
      )}
    >
      <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white", urgente ? "text-warn-500" : "text-brand-600")}>
        <CreditCard className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cx("block text-[14.5px] font-semibold", urgente ? "text-warn-700" : "text-brand-700")}>{s.titulo}</span>
        <span className="block text-[13px] text-muted">{s.fase === "teste" ? `Assine por R$ ${info.valor}/mês e continue sem interrupção` : s.texto}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
    </Link>
  );
}
