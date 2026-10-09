"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import {
  Ban,
  Camera,
  Car,
  Check,
  Copy,
  ExternalLink,
  ChevronRight,
  ClipboardList,
  CreditCard,
  EllipsisVertical,
  FileText,
  MessageCircle,
  PawPrint,
  Play,
  Scissors,
  Smile,
  TriangleAlert,
  User,
  UserX,
  CalendarCheck,
} from "lucide-react";
import { useApp, useDb, usePapel } from "@/data/store";
import type { GatilhoMensagem, StatusAtendimento } from "@/domain/types";
import { NOME_STATUS, NOME_TRANSPORTE, etapasDoAtendimento, porId, profissionais, receitaPendenteDoAtendimento, saldoPlano, statusEfetivoPlano, usosDoPlano } from "@/domain/rules";
import { montarLinhaDoTempo } from "@/domain/linha-tempo";
import { NOME_FORMA, NOME_PORTE, dataLonga, duracao, hoje, moeda, telefone } from "@/domain/format";
import { gatilhoSugerido, linkAcompanhamento } from "@/domain/messages";
import { Aviso, Botao, Chip, Folha, PetAvatar, Progresso, StatusChip, TituloVoltar, Vazio, cx } from "@/components/ui";
import { WhatsappFolha } from "@/components/whatsapp-folha";
import { PagamentoFolha } from "@/components/pagamento-folha";
import { useToast } from "@/components/providers";
import { pode, registraEtapasDoBanho, transicoesDoPapel } from "@/domain/permissoes";
import { EtapaFolha, LinhaDoTempo } from "@/components/acompanhamento";
import { TransporteFolha } from "@/components/transporte";

const ACOES: Record<StatusAtendimento, { rotulo: string; Icone: typeof Check; perigo?: boolean }> = {
  agendado: { rotulo: "Voltar para agendado", Icone: CalendarCheck },
  confirmado: { rotulo: "Confirmar horário", Icone: CalendarCheck },
  em_atendimento: { rotulo: "Iniciar atendimento", Icone: Play },
  finalizado: { rotulo: "Finalizar atendimento", Icone: Check },
  cancelado: { rotulo: "Cancelar agendamento", Icone: Ban, perigo: true },
  faltou: { rotulo: "Marcar falta", Icone: UserX, perigo: true },
};

export default function AtendimentoPagina() {
  return (
    <Suspense>
      <AtendimentoDetalhe />
    </Suspense>
  );
}

function AtendimentoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const recemCriado = useSearchParams().get("novo") === "1";
  const db = useDb();
  const mudarStatus = useApp((s) => s.mudarStatus);
  const reatribuir = useApp((s) => s.reatribuir);
  const toast = useToast();
  const papel = usePapel();
  const verDinheiro = pode(papel, "financeiro");
  const falaComTutor = pode(papel, "mensagens");
  const [menu, setMenu] = useState(false);
  const [profs, setProfs] = useState(false);
  const [zap, setZap] = useState<GatilhoMensagem | null>(recemCriado && falaComTutor ? "confirmacao" : null);
  const [pagando, setPagando] = useState(false);
  const [etapa, setEtapa] = useState(false);
  const [transporte, setTransporte] = useState(false);

  const a = porId(db.atendimentos, id);
  if (!a) {
    return (
      <>
        <TituloVoltar voltarPara={papel === "banhista" ? "/fila" : "/agenda"}>Atendimento</TituloVoltar>
        <Vazio icone={<PawPrint className="h-6 w-6" />} titulo="Atendimento não encontrado" />
      </>
    );
  }
  const pet = porId(db.pets, a.petId)!;
  const tutor = porId(db.tutores, a.tutorId)!;
  const prof = porId(db.membros, a.profissionalId);
  const plano = porId(db.planosPet, a.planoPetId);
  const saldo = plano ? saldoPlano(db, plano.id) : 0;
  const usoDeste = plano ? usosDoPlano(db, plano.id).find((u) => u.atendimentoId === a.id) : undefined;
  const pendente = receitaPendenteDoAtendimento(db, a.id);
  const lancPago = db.lancamentos.find((l) => l.atendimentoId === a.id && l.status === "pago");
  const coberto = a.planoPetId && a.valorTotal === 0;
  const encerrado = ["finalizado", "cancelado", "faltou"].includes(a.status);
  const etapas = etapasDoAtendimento(db, a.id);
  const linha = montarLinhaDoTempo(a.eventos, etapas, pet.nome);
  const motorista = porId(db.membros, a.motoristaId);
  const podeTransporte = pode(papel, "agenda") && a.status !== "cancelado" && a.status !== "faltou";

  function mudar(para: StatusAtendimento) {
    const r = mudarStatus(a!.id, para);
    setMenu(false);
    if (!r.ok) return toast(r.erro, "erro");
    if (para === "finalizado") {
      const partes = ["Atendimento finalizado"];
      if (r.valor.usoRegistrado) partes.push(r.valor.planoEncerrado ? "último banho do plano usado" : "1 banho descontado do plano");
      if (r.valor.receitaCriada && verDinheiro) partes.push(`${moeda(r.valor.receitaCriada.valor)} a receber`);
      toast(partes.join(" · "));
      if (falaComTutor) setZap("pet_pronto");
    } else {
      toast(`Status atualizado: ${NOME_STATUS[para]}`);
    }
  }

  const principal: { rotulo: string; icone: ReactNode; acao: () => void } | null =
    a.status === "agendado"
      ? { rotulo: "Iniciar atendimento", icone: <Play className="h-5 w-5" />, acao: () => mudar("em_atendimento") }
      : a.status === "confirmado"
        ? { rotulo: "Iniciar atendimento", icone: <Play className="h-5 w-5" />, acao: () => mudar("em_atendimento") }
        : a.status === "em_atendimento"
          ? { rotulo: "Finalizar atendimento", icone: <Check className="h-5 w-5" />, acao: () => mudar("finalizado") }
          : a.status === "finalizado" && pendente && verDinheiro
            ? { rotulo: `Registrar pagamento · ${moeda(pendente.valor)}`, icone: <CreditCard className="h-5 w-5" />, acao: () => setPagando(true) }
            : null;

  return (
    <div>
      <TituloVoltar
        voltarPara={papel === "banhista" ? "/fila" : `/agenda${a.data === hoje() ? "" : `?data=${a.data}`}`}
        acao={
          <button aria-label="Mais ações" onClick={() => setMenu(true)} className="tap grid h-10 w-10 place-items-center rounded-full hover:bg-surface">
            <EllipsisVertical className="h-[22px] w-[22px]" />
          </button>
        }
      >
        Atendimento
      </TituloVoltar>

      <div className="flex items-center gap-4 px-5 pb-4 pt-2">
        <PetAvatar pet={pet} tamanho={68} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <Link href={`/pets/${pet.id}`} className="block truncate text-[21px] font-bold tracking-tight">
              {pet.nome}
            </Link>
            <StatusChip status={a.status} />
          </div>
          <p className="truncate text-[13.5px] text-muted">
            {pet.raca} · {NOME_PORTE[pet.porte]}
          </p>
          <p className="mt-0.5 text-[12.5px] text-subtle">
            {dataLonga(a.data)} · {a.hora}
          </p>
        </div>
      </div>

      <div className="divide-y divide-line border-y border-line">
        <Linha icone={<User />} rotulo="Tutor" href={pode(papel, "clientes") ? `/clientes/${tutor.id}` : undefined}>
          <p className="font-medium">{tutor.nome}</p>
          {falaComTutor && <p className="text-[13px] text-muted">{telefone(tutor.whatsapp)}</p>}
        </Linha>
        <Linha icone={<Scissors />} rotulo="Profissional" onClick={encerrado || papel === "banhista" ? undefined : () => setProfs(true)}>
          <p className="font-medium">{prof?.nome.split(" ")[0] ?? "—"}</p>
        </Linha>
        {(a.transporte !== "nenhum" || podeTransporte) && (
          <Linha icone={<Car />} rotulo="Leva e traz" onClick={podeTransporte ? () => setTransporte(true) : undefined}>
            <p className="font-medium">{NOME_TRANSPORTE[a.transporte]}</p>
            {a.enderecoTransporte && <p className="text-[13px] text-muted">{a.enderecoTransporte}</p>}
            {a.transporte !== "nenhum" && <p className="text-[12.5px] text-subtle">Motorista: {motorista ? motorista.nome.split(" ")[0] : "a definir"}</p>}
          </Linha>
        )}
      </div>

      {(pet.alergias || pet.cuidados) && (
        <div className="px-5 pt-4">
          <Aviso
            icone={<TriangleAlert className="h-6 w-6 fill-warn-500 text-white" />}
            titulo={pet.alergias ? `Alergia a ${pet.alergias}` : "Cuidado especial"}
            texto={pet.cuidados}
          />
        </div>
      )}

      <div className="mt-2 divide-y divide-line">
        {pet.temperamento && (
          <Linha icone={<Smile />} rotulo="Temperamento">
            <p>{pet.temperamento}</p>
          </Linha>
        )}
        <Linha icone={<ClipboardList />} rotulo="Serviço de hoje">
          {a.itens.map((i) => (
            <p key={i.servicoId} className="font-semibold">
              {i.nome}
              {i.cobertoPorPlano && <span className="ml-1.5 text-[12px] font-medium text-ok-700">· plano</span>}
            </p>
          ))}
          <p className="text-[13px] text-muted">{duracao(a.duracaoMin)}</p>
        </Linha>
        {plano && (
          <Linha icone={<FileText />} rotulo="Plano">
            {(() => {
              const st = statusEfetivoPlano(db, plano, hoje());
              return (
                <Chip tom={st === "ativo" ? "ok" : "neutral"} className="mb-2">
                  {st === "ativo" ? "Plano ativo" : st === "finalizado" ? "Plano concluído" : "Plano vencido"}
                </Chip>
              );
            })()}
            <p className="text-[14.5px]">
              {saldo} de {plano.totalUsos} {plano.totalUsos === 1 ? "banho disponível" : "banhos disponíveis"}
            </p>
            <Progresso valor={saldo} total={plano.totalUsos} className="mt-2" />
            <p className="mt-2 text-[12.5px] text-muted">
              {usoDeste ? "1 banho descontado neste atendimento." : encerrado ? "Nenhum banho descontado." : "Ao finalizar, desconta 1 banho."}
            </p>
          </Linha>
        )}
        {verDinheiro && (
          <Linha icone={<CreditCard />} rotulo="Pagamento">
            {coberto ? (
              <>
                <p className="font-medium">Coberto pelo plano</p>
                <p className="text-[12.5px] text-muted">Não gerar cobrança novamente.</p>
              </>
            ) : lancPago ? (
              <>
                <p className="font-medium">
                  Pago · {moeda(lancPago.valor)}
                </p>
                <p className="text-[12.5px] text-muted">{lancPago.formaPagamento ? NOME_FORMA[lancPago.formaPagamento] : ""}</p>
              </>
            ) : pendente ? (
              <>
                <p className="font-medium">A receber · {moeda(pendente.valor)}</p>
                <p className="text-[12.5px] text-muted">Registre quando o tutor pagar.</p>
              </>
            ) : (
              <>
                <p className="font-medium">{moeda(a.valorTotal)}</p>
                <p className="text-[12.5px] text-muted">{a.status === "cancelado" || a.status === "faltou" ? "Sem cobrança." : "Cobrança gerada ao finalizar."}</p>
              </>
            )}
          </Linha>
        )}
        {(pet.observacoes || a.observacoes) && (
          <Linha icone={<FileText />} rotulo="Observações">
            {pet.observacoes && <p className="text-[14px]">{pet.observacoes}</p>}
            {a.observacoes && <p className="text-[14px]">{a.observacoes}</p>}
          </Linha>
        )}
      </div>

      <div className="space-y-3 px-5 pt-5">
        {principal && (
          <Botao icone={principal.icone} onClick={principal.acao}>
            {principal.rotulo}
          </Botao>
        )}
        {a.status !== "cancelado" && falaComTutor && (
          <Botao variante="contorno" icone={<MessageCircle className="h-5 w-5" />} onClick={() => setZap(gatilhoSugerido(a.status))}>
            Abrir WhatsApp
          </Botao>
        )}
      </div>

      <section className="mx-5 mt-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[17px] font-semibold">Acompanhamento do tutor</h2>
          <span className="text-[12.5px] text-muted">{etapas.filter((e) => e.fotoUrl).length} fotos</span>
        </div>
        <div className="rounded-[20px] border border-line px-4 py-4">
          <LinhaDoTempo itens={linha} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {registraEtapasDoBanho(papel) && a.status !== "cancelado" && a.status !== "faltou" && (
            <Botao variante="contorno" className="h-12" icone={<Camera className="h-[18px] w-[18px]" />} onClick={() => setEtapa(true)}>
              Etapa e foto
            </Botao>
          )}
          {falaComTutor && a.status !== "cancelado" && (
            <Botao variante="fantasma" className="h-12" icone={<MessageCircle className="h-[18px] w-[18px]" />} onClick={() => setZap("acompanhamento")}>
              Enviar link
            </Botao>
          )}
        </div>
        <div className="mt-2 flex items-center justify-center gap-5">
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(linkAcompanhamento(a));
                toast("Link do tutor copiado");
              } catch {
                toast("Não foi possível copiar", "erro");
              }
            }}
            className="flex items-center gap-1.5 py-2 text-[13px] font-medium text-brand-600"
          >
            <Copy className="h-3.5 w-3.5" /> Copiar link do tutor
          </button>
          <a href={linkAcompanhamento(a)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 py-2 text-[13px] font-medium text-brand-600">
            <ExternalLink className="h-3.5 w-3.5" /> Ver como o tutor
          </a>
        </div>
      </section>

      <Folha aberta={menu} onFechar={() => setMenu(false)} titulo="Ações do atendimento">
        {transicoesDoPapel(papel, a.status).length === 0 ? (
          <p className="pb-4 text-[14px] text-muted">Este atendimento está encerrado. Nenhuma mudança de status disponível.</p>
        ) : (
          <ul className="space-y-2 pb-2">
            {transicoesDoPapel(papel, a.status).map((s) => {
              const { rotulo, Icone, perigo } = ACOES[s];
              return (
                <li key={s}>
                  <button
                    onClick={() => mudar(s)}
                    className={cx("tap flex w-full items-center gap-3 rounded-2xl border border-line px-4 py-3.5 text-left text-[15px] font-medium", perigo ? "text-bad-700" : "text-ink")}
                  >
                    <Icone className="h-5 w-5" />
                    {rotulo}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Folha>

      <Folha aberta={profs} onFechar={() => setProfs(false)} titulo="Trocar profissional">
        <ul className="space-y-2 pb-2">
          {profissionais(db).map((m) => (
              <li key={m.id}>
                <button
                  onClick={() => {
                    const r = reatribuir(a.id, m.id);
                    if (!r.ok) return toast(r.erro, "erro");
                    toast(`${m.nome.split(" ")[0]} assumiu o atendimento`);
                    setProfs(false);
                  }}
                  className={cx(
                    "tap flex w-full items-center justify-between rounded-2xl border px-4 py-3.5 text-left text-[15px] font-medium",
                    m.id === a.profissionalId ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line",
                  )}
                >
                  {m.nome}
                  {m.id === a.profissionalId && <Check className="h-5 w-5" />}
                </button>
              </li>
            ))}
        </ul>
      </Folha>

      {zap && <WhatsappFolha aberta onFechar={() => setZap(null)} tutorId={tutor.id} atendimentoId={a.id} gatilho={zap} />}
      <PagamentoFolha aberta={pagando} onFechar={() => setPagando(false)} lancamentoId={pendente?.id} />
      {etapa && <EtapaFolha aberta atendimentoId={a.id} onFechar={() => setEtapa(false)} />}
      <TransporteFolha aberta={transporte} onFechar={() => setTransporte(false)} atendimentoId={a.id} />
    </div>
  );
}

function Linha({ icone, rotulo, children, href, onClick }: { icone: ReactNode; rotulo: string; children: ReactNode; href?: string; onClick?: () => void }) {
  const corpo = (
    <>
      <span className="mt-0.5 text-brand-600 [&>svg]:h-5 [&>svg]:w-5">{icone}</span>
      <span className="w-[112px] shrink-0 pt-0.5 text-[14px] text-ink/85">{rotulo}</span>
      <div className="min-w-0 flex-1 text-[14.5px]">{children}</div>
      {(href || onClick) && <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-subtle" />}
    </>
  );
  const cls = "flex items-start gap-3 px-5 py-3.5";
  if (href)
    return (
      <Link href={href} className={cx(cls, "tap")}>
        {corpo}
      </Link>
    );
  if (onClick)
    return (
      <button onClick={onClick} className={cx(cls, "tap w-full text-left")}>
        {corpo}
      </button>
    );
  return <div className={cls}>{corpo}</div>;
}
