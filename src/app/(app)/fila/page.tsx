"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Camera, Car, Check, ChevronRight, CircleCheck, ClipboardList, Clock, MessageSquareText, PawPrint, Play, TriangleAlert, UserX } from "lucide-react";
import { useApp, useDb, useEu } from "@/data/store";
import type { Atendimento } from "@/domain/types";
import { NOME_ETAPA, NOME_TRANSPORTE, comissaoDoAtendimento, etapasDoAtendimento, filaDoProfissional, inicioDoAtendimento, porId, resumoProfissional } from "@/domain/rules";
import { NOME_PORTE, dataLonga, diaCurto, duracao, hoje, horaDeMinutos, horaDoIso, minutos, moeda, moedaCurta, parseData, primeiroNome, saudacao, somaDias } from "@/domain/format";
import { Botao, CapaFoto, Chip, Filtros, Folha, NumeroVidro, PetAvatar, Progresso, StatusChip, Vazio, cx } from "@/components/ui";
import { useToast } from "@/components/providers";
import { EtapaFolha, FotoBotao } from "@/components/acompanhamento";
import { ehBravo, temAlergia, tituloAlergia } from "@/domain/ficha-pet";

/** Relógio que anda sozinho, para o "há 25 min" não congelar. */
function useAgora(intervaloMs = 30_000) {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), intervaloMs);
    return () => clearInterval(id);
  }, [intervaloMs]);
  return agora;
}

export default function FilaPagina() {
  const db = useDb();
  const eu = useEu();
  const T = hoje();
  const [dia, setDia] = useState(T);
  const [finalizando, setFinalizando] = useState<Atendimento | null>(null);
  const [etapaDe, setEtapaDe] = useState<Atendimento | null>(null);
  const mudarStatus = useApp((s) => s.mudarStatus);
  const registrarEtapa = useApp((s) => s.registrarEtapa);
  const toast = useToast();

  if (!eu) return null;
  const fila = filaDoProfissional(db, eu.id, dia);
  const resumo = resumoProfissional(db, eu.id, dia);
  const ehHoje = dia === T;
  const mostrarComissao = eu.papel === "banhista" || resumo.comissao > 0;
  const dias = [T, somaDias(T, 1), somaDias(T, 2)];

  function iniciar(a: Atendimento) {
    const r = mudarStatus(a.id, "em_atendimento");
    if (!r.ok) return toast(r.erro, "erro");
    toast(`${porId(db.pets, a.petId)?.nome} na mesa. Bom trabalho!`);
  }

  async function finalizar(a: Atendimento, foto: File | null, nota: string) {
    // A foto do resultado vai para a linha do tempo do tutor como "Pronto!".
    if (foto || nota.trim()) {
      const e = await registrarEtapa({ atendimentoId: a.id, etapa: "pronto", foto, nota });
      if (!e.ok) return toast(e.erro, "erro");
    }
    const r = mudarStatus(a.id, "finalizado");
    setFinalizando(null);
    if (!r.ok) return toast(r.erro, "erro");
    const leva = a.transporte === "entrega" || a.transporte === "busca_e_entrega";
    toast(`${porId(db.pets, a.petId)?.nome} pronto! ${leva ? "O motorista já pode levar para casa." : "A recepção já pode avisar o tutor."}`);
  }

  const vazio = resumo.total === 0 && fila.ausentes.length === 0;

  return (
    <div>
      <CapaFoto foto="/fotos/fila-banho.webp" posicao="center 30%" className="mx-5 mt-5">
        <div className="px-5 pb-5 pt-24">
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/75">Minha fila</p>
          <h1 className="mt-1 text-[28px] font-bold leading-[1.1] tracking-tight text-white">
            {saudacao()}, {primeiroNome(eu.nome)}!
          </h1>
          <p className="mt-1.5 text-[14.5px] text-white/85">{dataLonga(dia)}</p>
          <div className="mt-5 flex gap-2">
            <NumeroVidro valor={String(fila.agora.length + fila.proximos.length)} rotulo={ehHoje ? "Na fila" : "Agendados"} />
            <NumeroVidro valor={`${resumo.concluidos}/${resumo.total}`} rotulo="Prontos" />
            {mostrarComissao && <NumeroVidro valor={moedaCurta(resumo.comissao)} rotulo="Comissão" sub="estimada" />}
          </div>
        </div>
      </CapaFoto>

      <div className="mt-4 px-5">
        <Filtros
          valor={dia}
          onChange={setDia}
          opcoes={dias.map((d, i) => ({
            valor: d,
            rotulo: i === 0 ? "Hoje" : i === 1 ? "Amanhã" : `${diaCurto(d)} ${parseData(d).getDate()}`,
            contagem: resumoProfissional(db, eu.id, d).total,
          }))}
        />
      </div>

      {vazio ? (
        <div className="mt-6">
          <Vazio
            foto="/fotos/descanso.webp"
            icone={<PawPrint className="h-6 w-6" />}
            titulo={ehHoje ? "Nenhum pet na sua fila hoje" : "Nada agendado com você"}
            texto="Quando a recepção marcar um horário com você, ele aparece aqui."
          />
        </div>
      ) : (
        <>
          {fila.agora.length > 0 && (
            <Bloco titulo="Agora na mesa">
              {fila.agora.map((a) => (
                <CartaoFila
                  key={a.id}
                  a={a}
                  destaque
                  acao={
                    <div className="grid grid-cols-[1fr_1.3fr] gap-2.5">
                      <Botao variante="contorno" icone={<Camera className="h-5 w-5" />} onClick={() => setEtapaDe(a)}>
                        Etapa
                      </Botao>
                      <Botao icone={<Check className="h-5 w-5" />} onClick={() => setFinalizando(a)}>
                        Finalizar
                      </Botao>
                    </div>
                  }
                />
              ))}
            </Bloco>
          )}

          {fila.proximos.length > 0 && (
            <Bloco titulo={ehHoje ? "A seguir" : "Agendados"}>
              {fila.proximos.map((a) => (
                <CartaoFila
                  key={a.id}
                  a={a}
                  acao={
                    ehHoje ? (
                      <Botao variante="contorno" icone={<Play className="h-5 w-5" />} onClick={() => iniciar(a)}>
                        Iniciar
                      </Botao>
                    ) : undefined
                  }
                />
              ))}
            </Bloco>
          )}

          {(fila.concluidos.length > 0 || fila.ausentes.length > 0) && (
            <Bloco titulo="Prontos">
              <ul className="card divide-y divide-line">
                {fila.concluidos.map((a) => (
                  <LinhaPronto key={a.id} a={a} comissao={mostrarComissao ? comissaoDoAtendimento(db, a) : undefined} />
                ))}
                {fila.ausentes.map((a) => (
                  <LinhaPronto key={a.id} a={a} />
                ))}
              </ul>
            </Bloco>
          )}
        </>
      )}

      {mostrarComissao && !vazio && (
        <p className="mx-5 mt-5 text-[12.5px] leading-snug text-subtle">
          Comissão sobre o preço de tabela dos serviços finalizados, inclusive os cobertos por plano. O valor final é fechado pelo dono.
        </p>
      )}

      <Folha aberta={!!finalizando} onFechar={() => setFinalizando(null)} titulo="Finalizar atendimento?">
        {finalizando && <ConfirmarFim a={finalizando} onConfirmar={(foto, nota) => finalizar(finalizando, foto, nota)} />}
      </Folha>
      {etapaDe && <EtapaFolha aberta atendimentoId={etapaDe.id} onFechar={() => setEtapaDe(null)} />}
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mt-6 px-5">
      <h2 className="mb-3 text-[17px] font-semibold">{titulo}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function CartaoFila({ a, destaque = false, acao }: { a: Atendimento; destaque?: boolean; acao?: ReactNode }) {
  const db = useDb();
  const agora = useAgora();
  const pet = porId(db.pets, a.petId)!;
  const tutor = porId(db.tutores, a.tutorId);
  const etapas = etapasDoAtendimento(db, a.id);
  const inicio = inicioDoAtendimento(a);
  const decorrido = inicio ? Math.max(0, Math.round((agora.getTime() - new Date(inicio).getTime()) / 60000)) : 0;
  const previsto = inicio ? horaDoIso(new Date(new Date(inicio).getTime() + a.duracaoMin * 60000).toISOString()) : undefined;
  const fimAgendado = horaDeMinutos(minutos(a.hora) + a.duracaoMin);

  return (
    <article className={cx("overflow-hidden rounded-[20px] border bg-white", destaque ? "border-brand-300 shadow-[var(--shadow-card)]" : "border-line")}>
      <div className={cx("flex items-center justify-between gap-2 px-4 py-2.5", destaque ? "bg-brand-50" : "bg-surface/70")}>
        <p className="flex items-center gap-1.5 text-[14px] font-semibold tabular-nums">
          <Clock className="h-4 w-4 text-brand-600" />
          {a.hora} – {fimAgendado}
          <span className="font-normal text-muted">· {duracao(a.duracaoMin)}</span>
        </p>
        <StatusChip status={a.status} />
      </div>

      <div className="px-4 pb-4 pt-3">
        <Link href={`/pets/${pet.id}`} className="tap flex items-center gap-3">
          <PetAvatar pet={pet} tamanho={52} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[18px] font-bold tracking-tight">{pet.nome}</p>
            <p className="truncate text-[13.5px] text-muted">
              {pet.raca} · {NOME_PORTE[pet.porte]}
              {pet.temperamento && ` · ${pet.temperamento}`}
            </p>
            {tutor && <p className="truncate text-[12.5px] text-subtle">Tutor: {primeiroNome(tutor.nome)}</p>}
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-subtle" />
        </Link>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {a.itens.map((i) => (
            <Chip key={i.servicoId} tom="brand" className="py-1.5 text-[13px]">
              {i.nome}
            </Chip>
          ))}
          {a.planoPetId && <Chip tom="info" className="py-1.5 text-[13px]">Plano</Chip>}
          {a.transporte !== "nenhum" && (
            <Chip tom="neutral" className="py-1.5 text-[13px]">
              <Car className="mr-1 h-3.5 w-3.5" />
              {NOME_TRANSPORTE[a.transporte]}
            </Chip>
          )}
        </div>
        {etapas.length > 0 && (
          <div className="mt-3 flex items-center gap-2 overflow-x-auto">
            {etapas.map((e) =>
              e.fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={e.id} src={e.fotoUrl} alt={NOME_ETAPA[e.etapa]} title={NOME_ETAPA[e.etapa]} className="h-11 w-11 shrink-0 rounded-xl object-cover" />
              ) : (
                <span key={e.id} className="shrink-0 rounded-full bg-surface px-2.5 py-1 text-[12px] font-medium text-muted">
                  {NOME_ETAPA[e.etapa]}
                </span>
              ),
            )}
            <span className="shrink-0 text-[12px] text-subtle">o tutor acompanha</span>
          </div>
        )}

        {(temAlergia(pet) || ehBravo(pet) || pet.cuidados || pet.observacoes || a.observacoes) && (
          <ul className="mt-3 space-y-2">
            {temAlergia(pet) && <Alerta tom="bad" icone={<TriangleAlert />} texto={tituloAlergia(pet)!} />}
            {ehBravo(pet) && <Alerta tom="bad" icone={<TriangleAlert />} texto="Bravo: cuidado ao manusear" />}
            {pet.cuidados && <Alerta tom="warn" icone={<TriangleAlert />} texto={pet.cuidados} />}
            {pet.observacoes && <Alerta tom="neutro" icone={<ClipboardList />} texto={pet.observacoes} />}
            {a.observacoes && <Alerta tom="neutro" icone={<MessageSquareText />} texto={`Recado: ${a.observacoes}`} />}
          </ul>
        )}

        {destaque && inicio && (
          <div className="mt-4">
            <div className="mb-1.5 flex justify-between gap-2 text-[12.5px] text-muted">
              <span>
                Começou {horaDoIso(inicio)} · há {duracao(decorrido)}
              </span>
              {decorrido > a.duracaoMin ? (
                <span className="font-medium text-warn-700">{duracao(decorrido - a.duracaoMin)} além do previsto</span>
              ) : (
                <span>Previsto {previsto}</span>
              )}
            </div>
            <Progresso valor={Math.min(decorrido, a.duracaoMin)} total={a.duracaoMin} />
          </div>
        )}

        {acao && <div className="mt-4">{acao}</div>}
      </div>
    </article>
  );
}

function Alerta({ tom, icone, texto }: { tom: "bad" | "warn" | "neutro"; icone: ReactNode; texto: string }) {
  return (
    <li
      className={cx(
        "flex items-start gap-2 rounded-xl px-3 py-2 text-[13.5px] font-medium [&>svg]:mt-px [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0",
        tom === "bad" && "bg-bad-50 text-bad-700",
        tom === "warn" && "bg-warn-50 text-warn-700",
        tom === "neutro" && "bg-surface text-ink/80",
      )}
    >
      {icone}
      <span>{texto}</span>
    </li>
  );
}

function LinhaPronto({ a, comissao }: { a: Atendimento; comissao?: number }) {
  const db = useDb();
  const pet = porId(db.pets, a.petId)!;
  const fim = a.eventos.findLast((e) => e.para === a.status)?.em;
  const faltou = a.status === "faltou";
  return (
    <li>
      <Link href={`/atendimentos/${a.id}`} className="tap flex items-center gap-3 px-3.5 py-3">
        <PetAvatar pet={pet} tamanho={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{pet.nome}</p>
          <p className="truncate text-[12.5px] text-muted">
            {faltou ? "Não compareceu" : `Pronto às ${fim ? horaDoIso(fim) : a.hora}`} · {a.itens.map((i) => i.nome).join(" + ")}
          </p>
        </div>
        {faltou ? (
          <UserX className="h-5 w-5 shrink-0 text-warn-500" />
        ) : comissao ? (
          <span className="shrink-0 text-[13.5px] font-semibold text-ok-700">+{moeda(comissao)}</span>
        ) : (
          <CircleCheck className="h-5 w-5 shrink-0 text-ok-500" />
        )}
      </Link>
    </li>
  );
}

function ConfirmarFim({ a, onConfirmar }: { a: Atendimento; onConfirmar: (foto: File | null, nota: string) => Promise<void> }) {
  const db = useDb();
  const pet = porId(db.pets, a.petId)!;
  const [foto, setFoto] = useState<File | null>(null);
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);
  const leva = a.transporte === "entrega" || a.transporte === "busca_e_entrega";
  return (
    <div>
      <div className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3">
        <PetAvatar pet={pet} tamanho={44} />
        <div className="min-w-0">
          <p className="font-semibold">{pet.nome}</p>
          <p className="truncate text-[13px] text-muted">{a.itens.map((i) => i.nome).join(" + ")}</p>
        </div>
      </div>
      <FotoBotao className="mt-4" foto={foto} onFoto={setFoto} rotulo="Foto do resultado" />
      <input className="input mt-3" value={nota} onChange={(e) => setNota(e.target.value)} placeholder={`Recado para o tutor (opcional)`} maxLength={140} />
      <p className="mt-4 text-[14px] text-muted">
        {leva ? "O pet sai da sua fila e aparece para o motorista levar para casa." : "O pet sai da sua fila e a recepção vê que ele está pronto para avisar o tutor."}
        {a.planoPetId && " Um banho do plano será descontado."}
      </p>
      <Botao
        className="mt-5"
        icone={<Check className="h-5 w-5" />}
        disabled={enviando}
        onClick={async () => {
          setEnviando(true);
          await onConfirmar(foto, nota);
          setEnviando(false);
        }}
      >
        {enviando ? (foto ? "Enviando a foto…" : "Salvando…") : `Sim, ${pet.nome} está pronto`}
      </Botao>
    </div>
  );
}
