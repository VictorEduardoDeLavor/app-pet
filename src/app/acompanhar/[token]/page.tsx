"use client";

import { MARCA } from "@/lib/marca";
// Página do tutor: abre pelo link do WhatsApp, sem senha. Mostra em que etapa o pet está,
// as fotos que a equipe tirou e, no leva e traz, o carro andando no mapa.

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Car, Check, Clock, MapPin, MessageCircle, PawPrint, RefreshCw, SearchX } from "lucide-react";
import { useApp } from "@/data/store";
import { buscarAcompanhamento } from "@/data/acompanhamento";
import { supabase, temSupabase } from "@/lib/supabase/client";
import { NOME_TRANSPORTE } from "@/domain/rules";
import { dataLonga, primeiroNome } from "@/domain/format";
import { linkWhatsapp } from "@/domain/messages";
import { fraseAtual, linhaDoTutor, passosDoTutor, posicaoSimulada, visaoDoDb, type VisaoTutor } from "@/domain/visao-tutor";
import { LinhaDoTempo } from "@/components/acompanhamento";
import { Chip, cx } from "@/components/ui";

const MapaCarro = dynamic(() => import("@/components/mapa").then((m) => m.MapaCarro), {
  ssr: false,
  loading: () => <div className="h-60 animate-pulse bg-surface" />,
});

type Estado = { tipo: "carregando" } | { tipo: "nao-encontrado" } | { tipo: "erro"; msg: string } | { tipo: "ok"; v: VisaoTutor; demo: boolean; em: number };

export default function AcompanharPagina() {
  const { token } = useParams<{ token: string }>();
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });

  const atualizar = useCallback(async () => {
    // 1) Demonstração: o atendimento está nos dados de exemplo deste navegador.
    const local = visaoDoDb(useApp.getState().db, token);
    if (local) {
      const pos = local.posicao ? posicaoSimulada(local.posicao, Date.now()) : undefined;
      setEstado({ tipo: "ok", v: { ...local, posicao: pos }, demo: true, em: Date.now() });
      return local.emRota;
    }
    // 2) Link real: pergunta ao banco.
    if (!temSupabase) {
      setEstado({ tipo: "nao-encontrado" });
      return false;
    }
    try {
      const v = await buscarAcompanhamento(supabase(), token);
      setEstado(v ? { tipo: "ok", v, demo: false, em: Date.now() } : { tipo: "nao-encontrado" });
      return !!v?.emRota;
    } catch (e) {
      setEstado((s) => (s.tipo === "ok" ? s : { tipo: "erro", msg: e instanceof Error ? e.message : String(e) }));
      return false;
    }
  }, [token]);

  // Atualiza sozinho: a cada 5 s com o carro na rua, a cada 20 s no resto. Pausa com a tela escondida.
  useEffect(() => {
    let vivo = true;
    let timer: ReturnType<typeof setTimeout>;
    const ciclo = async () => {
      if (document.visibilityState === "visible") {
        const rota = await atualizar();
        if (!vivo) return;
        timer = setTimeout(ciclo, rota ? 5000 : 20000);
      } else {
        timer = setTimeout(ciclo, 2000);
      }
    };
    void ciclo();
    const aoVoltar = () => document.visibilityState === "visible" && void atualizar();
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      vivo = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [atualizar]);

  if (estado.tipo === "carregando") {
    return (
      <div className="grid min-h-dvh place-items-center bg-white">
        <PawPrint className="h-9 w-9 animate-pulse text-brand-500" />
      </div>
    );
  }
  if (estado.tipo !== "ok") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center bg-white px-8 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-surface text-brand-600">
          <SearchX className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-[20px] font-bold">{estado.tipo === "erro" ? "Não deu para carregar agora" : "Link não encontrado"}</h1>
        <p className="mt-1.5 text-[14.5px] text-muted">
          {estado.tipo === "erro" ? "Verifique a internet e tente de novo em instantes." : "Confira se o link está completo ou peça um novo ao pet shop."}
        </p>
        {estado.tipo === "erro" && (
          <button onClick={() => void atualizar()} className="tap mt-5 flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-[14px] font-semibold text-white">
            <RefreshCw className="h-4 w-4" /> Tentar de novo
          </button>
        )}
      </main>
    );
  }

  return <Visao v={estado.v} demo={estado.demo} atualizadoEm={estado.em} />;
}

function Visao({ v, demo, atualizadoEm }: { v: VisaoTutor; demo: boolean; atualizadoEm: number }) {
  const linha = useMemo(() => linhaDoTutor(v), [v]);
  const passos = passosDoTutor(v);
  const frase = fraseAtual(v, linha);
  const fotoCapa = [...linha].reverse().find((i) => i.fotoUrl)?.fotoUrl ?? v.pet.fotoUrl ?? "/fotos/capa-banho.webp";
  const encerrado = v.atendimento.status === "cancelado" || v.atendimento.status === "faltou";
  const agora = useAgora(atualizadoEm);
  const segundos = v.posicao ? Math.max(0, Math.round((agora - Date.parse(v.posicao.em)) / 1000)) : 0;

  return (
    <main className="mx-auto min-h-dvh max-w-[480px] bg-white pb-12 sm:my-6 sm:min-h-0 sm:overflow-hidden sm:rounded-[32px] sm:shadow-[var(--shadow-hero)]">
      {/* Capa com a foto mais recente */}
      <header className="relative h-[340px] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={fotoCapa} alt={`Foto de ${v.pet.nome}`} className="absolute inset-0 h-full w-full object-cover" />
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgb(29_18_74/0.15)_0%,rgb(40_26_99/0.20)_40%,rgb(29_18_74/0.88)_100%)]" />
        <div className="vidro absolute left-4 top-[max(16px,env(safe-area-inset-top))] flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 text-white">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-brand-600">
            <PawPrint className="h-4 w-4" strokeWidth={2.4} />
          </span>
          <span className="max-w-[220px] truncate text-[13.5px] font-semibold">{v.petshop.nome}</span>
        </div>
        {demo && <Chip tom="warn" className="absolute right-4 top-[max(20px,env(safe-area-inset-top))]">Demonstração</Chip>}
        <div className="absolute inset-x-5 bottom-10 text-white">
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/75">
            Olá, {primeiroNome(v.tutorNome)} · acompanhe {v.pet.nome}
          </p>
          <h1 className="mt-1.5 text-[28px] font-bold leading-[1.1] tracking-tight">{frase}</h1>
          <p className="mt-2 flex items-center gap-1.5 text-[13px] text-white/80">
            <span className={cx("h-2 w-2 rounded-full", encerrado ? "bg-white/50" : "animate-pulse bg-ok-500")} />
            {encerrado ? "Atendimento encerrado" : "Ao vivo · a página atualiza sozinha"}
          </p>
        </div>
      </header>

      <div className="relative z-10 -mt-6 rounded-t-[28px] bg-white px-5 pt-6">
        {/* Progresso */}
        {!encerrado && (
          <ol className="flex items-start" aria-label="Etapas">
            {passos.map((p, i) => {
              const atual = p.feito && !passos[i + 1]?.feito;
              return (
                <li key={p.rotulo} className="relative flex flex-1 flex-col items-center text-center">
                  {i > 0 && <span aria-hidden className={cx("absolute right-1/2 top-[13px] h-[3px] w-full rounded", p.feito ? "bg-brand-500" : "bg-brand-100")} />}
                  <span
                    className={cx(
                      "relative z-10 grid h-7 w-7 place-items-center rounded-full text-[12px] font-bold",
                      p.feito ? "bg-brand-600 text-white" : "bg-brand-100 text-brand-400",
                      atual && "ring-4 ring-brand-200",
                    )}
                  >
                    {p.feito ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
                  </span>
                  <span className={cx("mt-1.5 text-[11.5px] leading-tight", p.feito ? "font-semibold text-ink" : "text-muted")}>{p.rotulo}</span>
                </li>
              );
            })}
          </ol>
        )}

        {/* Carro no mapa */}
        {v.emRota && (
          <section className="mt-6 overflow-hidden rounded-[22px] border border-line shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-600 text-white">
                <Car className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">
                  {v.atendimento.motorista ? `${primeiroNome(v.atendimento.motorista)} está a caminho` : "O motorista está a caminho"}
                </p>
                <p className="text-[12.5px] text-muted">
                  {v.posicao ? (segundos < 60 ? `Localização de ${segundos} s atrás` : `Localização de ${Math.round(segundos / 60)} min atrás`) : "Esperando o GPS do motorista…"}
                </p>
              </div>
            </div>
            {v.posicao ? (
              <MapaCarro lat={v.posicao.lat} lng={v.posicao.lng} precisao={v.posicao.precisao} className="h-60 w-full" />
            ) : (
              <div className="grid h-40 place-items-center bg-surface text-[13.5px] text-muted">O mapa aparece assim que o carro sair.</div>
            )}
            {v.atendimento.endereco && (
              <p className="flex items-center gap-1.5 border-t border-line px-4 py-2.5 text-[12.5px] text-muted">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{v.atendimento.endereco}</span>
              </p>
            )}
          </section>
        )}

        {/* Resumo do atendimento */}
        <section className="mt-6 rounded-[20px] bg-surface px-4 py-3.5">
          <p className="flex items-center gap-1.5 text-[13px] text-muted">
            <Clock className="h-3.5 w-3.5" />
            {dataLonga(v.atendimento.data)} · {v.atendimento.hora}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {v.atendimento.itens.map((i) => (
              <Chip key={i} tom="brand" className="bg-white py-1.5 text-[13px]">
                {i}
              </Chip>
            ))}
            {v.atendimento.transporte !== "nenhum" && (
              <Chip tom="info" className="py-1.5 text-[13px]">
                <Car className="mr-1 h-3.5 w-3.5" />
                {NOME_TRANSPORTE[v.atendimento.transporte]}
              </Chip>
            )}
          </div>
        </section>

        {/* Linha do tempo com fotos */}
        <section className="mt-7">
          <h2 className="mb-4 text-[17px] font-semibold">Como foi o dia de {v.pet.nome}</h2>
          <LinhaDoTempo
            itens={linha}
            paraTutor
            fuso={v.petshop.fuso}
            vazio={<p className="text-[14px] text-muted">Assim que {v.pet.nome} chegar, as etapas e fotos aparecem aqui.</p>}
          />
        </section>

        {v.petshop.whatsapp && (
          <a
            href={linkWhatsapp(v.petshop.whatsapp, `Olá! Sou ${primeiroNome(v.tutorNome)}, tutor(a) de ${v.pet.nome}.`)}
            target="_blank"
            rel="noreferrer"
            className="tap mt-8 flex h-[52px] items-center justify-center gap-2.5 rounded-2xl bg-ok-500 text-[15px] font-semibold text-white"
          >
            <MessageCircle className="h-5 w-5" />
            Falar com a {v.petshop.nome}
          </a>
        )}
        <p className="mt-6 text-center text-[12px] text-subtle">Feito com {MARCA.nome}</p>
      </div>
    </main>
  );
}

/** Relógio que anda a cada segundo, para o "há 12 s" contar sozinho. */
function useAgora(base: number) {
  const [agora, setAgora] = useState(base);
  useEffect(() => {
    setAgora(Date.now());
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [base]);
  return agora;
}
