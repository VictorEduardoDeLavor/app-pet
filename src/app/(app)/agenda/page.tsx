"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Funnel, Globe, Plus } from "lucide-react";
import { useDb } from "@/data/store";
import type { Atendimento, StatusAtendimento } from "@/domain/types";
import { NOME_STATUS, atendimentosDoDia, petshopAberto, porId } from "@/domain/rules";
import { dataLonga, diaCurto, duracao, hoje, inicioSemana, minutos, moeda, pad, parseData, somaDias } from "@/domain/format";
import { Chip, Filtros, PetAvatar, Segmentado, StatusChip, Titulo, Vazio, cx } from "@/components/ui";

type Filtro = "todos" | "online" | StatusAtendimento;

const passa = (a: Atendimento, filtro: Filtro) =>
  filtro === "todos" ? a.status !== "cancelado" : filtro === "online" ? a.origem === "portal" && a.status !== "cancelado" : a.status === filtro;

export default function AgendaPagina() {
  return (
    <Suspense>
      <Agenda />
    </Suspense>
  );
}

function Agenda() {
  const db = useDb();
  const router = useRouter();
  const params = useSearchParams();
  const T = hoje();
  const data = params.get("data") ?? T;
  const [modo, setModo] = useState<"dia" | "semana">(params.get("status") === "online" ? "semana" : "dia");
  const [filtro, setFiltro] = useState<Filtro>((params.get("status") as Filtro) ?? "todos");
  const [mostrarFiltro, setMostrarFiltro] = useState(params.has("status"));

  const irPara = (d: string) => router.replace(d === T ? "/agenda" : `/agenda?data=${d}`, { scroll: false });
  const semana = useMemo(() => {
    const seg = inicioSemana(data);
    return Array.from({ length: 7 }, (_, i) => somaDias(seg, i));
  }, [data]);

  const doDia = atendimentosDoDia(db, data);
  const filtrados = doDia.filter((a) => passa(a, filtro));

  const contagem = (s: Filtro) => doDia.filter((a) => passa(a, s)).length;

  return (
    <div>
      <Titulo
        acao={
          <button onClick={() => setMostrarFiltro((v) => !v)} className={cx("tap flex items-center gap-1.5 rounded-full px-3 py-2 text-[15px] font-medium", mostrarFiltro ? "bg-brand-100 text-brand-700" : "text-brand-600")}>
            <Funnel className="h-[18px] w-[18px]" />
            Filtrar
          </button>
        }
      >
        Agenda
      </Titulo>

      <div className="px-5">
        <Segmentado
          opcoes={[
            { valor: "dia", rotulo: "Dia" },
            { valor: "semana", rotulo: "Semana" },
          ]}
          valor={modo}
          onChange={setModo}
        />
      </div>

      {mostrarFiltro && (
        <div className="mt-3 px-5">
          <Filtros
            valor={filtro}
            onChange={setFiltro}
            opcoes={(["todos", "online", "agendado", "confirmado", "em_atendimento", "finalizado", "cancelado", "faltou"] as Filtro[]).map((s) => ({
              valor: s,
              rotulo: s === "todos" ? "Todos" : s === "online" ? "Online" : NOME_STATUS[s],
              contagem: contagem(s),
            }))}
          />
        </div>
      )}

      <div className="mt-4 flex items-center gap-1 px-2">
        <button aria-label="Semana anterior" onClick={() => irPara(somaDias(data, -7))} className="tap grid h-10 w-9 place-items-center text-muted">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="grid flex-1 grid-cols-7">
          {semana.map((d) => {
            const sel = d === data;
            const fechado = !petshopAberto(db, d);
            const qtd = atendimentosDoDia(db, d).filter((a) => a.status !== "cancelado").length;
            return (
              <button key={d} onClick={() => irPara(d)} className={cx("tap flex flex-col items-center gap-1 py-1", fechado && !sel && "opacity-45")}>
                <span className={cx("text-[12.5px]", sel ? "font-semibold text-brand-600" : "text-muted")}>{diaCurto(d)}</span>
                <span
                  className={cx(
                    "grid h-10 w-10 place-items-center rounded-full text-[15px] font-semibold",
                    sel ? "bg-brand-600 text-white shadow-[var(--shadow-float)]" : d === T ? "text-brand-600 ring-1 ring-brand-300" : "text-ink",
                  )}
                >
                  {parseData(d).getDate()}
                </span>
                <span className={cx("h-1 w-1 rounded-full", qtd > 0 && !sel ? "bg-brand-400" : "bg-transparent")} />
              </button>
            );
          })}
        </div>
        <button aria-label="Próxima semana" onClick={() => irPara(somaDias(data, 7))} className="tap grid h-10 w-9 place-items-center text-muted">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {modo === "dia" ? (
        <>
          <p className="mb-2 mt-1 text-center text-[16px] font-medium">
            {dataLonga(data)}
            {data !== T && (
              <button onClick={() => irPara(T)} className="ml-2 text-[13px] font-medium text-brand-600">
                Hoje
              </button>
            )}
          </p>
          {!petshopAberto(db, data) ? (
            <Vazio icone={<CalendarDays className="h-6 w-6" />} titulo="Pet shop fechado neste dia" />
          ) : (
            <LinhaDoTempo itens={filtrados} abre={db.petshop.abre} fecha={db.petshop.fecha} />
          )}
        </>
      ) : (
        <VisaoSemana dias={semana} filtro={filtro} />
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(84px+env(safe-area-inset-bottom))] z-30 mx-auto max-w-[440px] px-5 lg:bottom-6 lg:left-[256px] lg:flex lg:max-w-[760px] lg:justify-end">
        <Link
          href={`/agenda/novo?data=${data}`}
          className="tap botao-primario pointer-events-auto flex h-[54px] items-center justify-center gap-2.5 rounded-2xl text-[16px] font-semibold text-white lg:w-[260px]"
        >
          <Plus className="h-5 w-5" />
          Novo agendamento
        </Link>
      </div>
    </div>
  );
}

function LinhaDoTempo({ itens, abre, fecha }: { itens: Atendimento[]; abre: string; fecha: string }) {
  const horas: number[] = [];
  for (let h = Math.floor(minutos(abre) / 60); h < Math.ceil(minutos(fecha) / 60); h++) horas.push(h);
  return (
    <div className="px-4 pb-24">
      {horas.map((h) => {
        const daHora = itens.filter((a) => Math.floor(minutos(a.hora) / 60) === h);
        return (
          <div key={h} className="flex gap-3">
            <span className="w-12 shrink-0 pt-2.5 text-right text-[13px] tabular-nums text-muted">{pad(h)}:00</span>
            <div className={cx("min-w-0 flex-1 border-t border-line pt-2", daHora.length ? "pb-3" : "min-h-[52px]")}>
              <div className="space-y-2.5">
                {daHora.map((a) => (
                  <CartaoAtendimento key={a.id} a={a} />
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CartaoAtendimento({ a, compacto = false }: { a: Atendimento; compacto?: boolean }) {
  const db = useDb();
  const pet = porId(db.pets, a.petId)!;
  const tutor = porId(db.tutores, a.tutorId);
  const prof = porId(db.membros, a.profissionalId);
  const apagado = ["finalizado", "cancelado", "faltou"].includes(a.status);
  return (
    <Link
      href={`/atendimentos/${a.id}`}
      className={cx(
        "tap flex gap-3 rounded-2xl border-l-[3px] bg-surface px-3 py-3",
        a.status === "em_atendimento" ? "border-brand-600" : "border-brand-300",
        apagado && "opacity-60",
      )}
    >
      <PetAvatar pet={pet} tamanho={compacto ? 40 : 46} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-[15.5px] font-semibold">
            {compacto && <span className="mr-1.5 tabular-nums text-muted">{a.hora}</span>}
            {pet.nome}
          </p>
          <span className="flex shrink-0 items-center gap-1">
            {a.origem === "portal" && (
              <span title="Agendado pela página online" className="grid h-6 w-6 place-items-center rounded-full bg-info-50 text-info-600">
                <Globe className="h-3.5 w-3.5" />
              </span>
            )}
            <StatusChip status={a.status} />
          </span>
        </div>
        <p className="truncate text-[13px] text-muted">
          {tutor?.nome}
          {a.origem === "portal" && a.status === "agendado" && <span className="font-medium text-info-600"> · pedido online: confirme</span>}
        </p>
        <div className="mt-0.5 flex items-end justify-between gap-2">
          <p className="truncate text-[13px] text-muted">
            {a.itens.map((i) => i.nome).join(" + ")} · {duracao(a.duracaoMin)}
            {prof && <span className="text-subtle"> · {prof.nome.split(" ")[0]}</span>}
          </p>
          {a.planoPetId && a.valorTotal === 0 ? (
            <Chip tom="info">Plano ativo</Chip>
          ) : (
            <span className="shrink-0 text-[14px] font-semibold">{moeda(a.valorTotal)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

function VisaoSemana({ dias, filtro }: { dias: string[]; filtro: Filtro }) {
  const db = useDb();
  return (
    <div className="space-y-5 px-5 pb-24 pt-2">
      {dias.map((d) => {
        const lista = atendimentosDoDia(db, d).filter((a) => passa(a, filtro));
        // Dia fechado sem nada marcado não ocupa espaço na semana.
        if (!petshopAberto(db, d) && lista.length === 0) return null;
        return (
          <section key={d}>
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-[15px] font-semibold">{dataLonga(d)}</h3>
              <span className="text-[13px] text-muted">{lista.length} {lista.length === 1 ? "atendimento" : "atendimentos"}</span>
            </div>
            {lista.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-[13.5px] text-subtle">Sem atendimentos</p>
            ) : (
              <div className="space-y-2">
                {lista.map((a) => (
                  <CartaoAtendimento key={a.id} a={a} compacto />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
