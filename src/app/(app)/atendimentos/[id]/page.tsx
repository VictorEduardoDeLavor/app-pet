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
  Gift,
  Globe,
  ImageOff,
  Pencil,
  ShoppingBag,
  Trash2,
  Undo2,
} from "lucide-react";
import { useApp, useDb, usePapel } from "@/data/store";
import type { FormaPagamento, GatilhoMensagem, StatusAtendimento } from "@/domain/types";
import { ETAPAS_TRANSPORTE, NOME_ETAPA, NOME_STATUS, NOME_TRANSPORTE, etapasDoAtendimento, porId, profissionais, receitaPendenteDoAtendimento, saldoPlano, statusEfetivoPlano, usosDoPlano } from "@/domain/rules";
import { montarLinhaDoTempo } from "@/domain/linha-tempo";
import { NOME_FORMA, NOME_PORTE, dataLonga, duracao, hoje, moeda, telefone } from "@/domain/format";
import { gatilhoSugerido, linkAcompanhamento } from "@/domain/messages";
import { Aviso, Botao, Chip, Folha, PetAvatar, Progresso, StatusChip, TituloVoltar, Vazio, cx } from "@/components/ui";
import { WhatsappFolha } from "@/components/whatsapp-folha";
import { PagamentoFolha, SeletorForma } from "@/components/pagamento-folha";
import { EditarAtendimentoFolha } from "@/components/editar-atendimento";
import { VendaFolha } from "@/components/venda-folha";
import { cartao, resgateDoAtendimento, valorDoPremio } from "@/domain/fidelidade";
import { vendasDoAtendimento } from "@/domain/produtos";
import { useToast } from "@/components/providers";
import { pode, registraEtapasDoBanho, transicoesDoPapel } from "@/domain/permissoes";
import { EtapaFolha, LinhaDoTempo } from "@/components/acompanhamento";
import { TransporteFolha } from "@/components/transporte";

const ACOES: Partial<Record<StatusAtendimento, { rotulo: string; Icone: typeof Check; perigo?: boolean }>> = {
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
  const [editando, setEditando] = useState(false);
  const [vendendo, setVendendo] = useState(false);
  const [sinal, setSinal] = useState(false);
  const [formaSinal, setFormaSinal] = useState<FormaPagamento>("pix");
  const [gerirEtapa, setGerirEtapa] = useState<string | null>(null);
  const [receberId, setReceberId] = useState<string | null>(null);
  const resgatar = useApp((s) => s.resgatarFidelidade);
  const desfazerResgate = useApp((s) => s.desfazerResgate);
  const registrarSinal = useApp((s) => s.registrarSinal);
  const removerEtapa = useApp((s) => s.removerEtapa);

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
  const lancPago = db.lancamentos.find((l) => l.atendimentoId === a.id && l.status === "pago" && l.categoria !== "Sinal");
  const editavel = pode(papel, "agenda") && ["agendado", "confirmado", "em_atendimento"].includes(a.status);
  const resgate = resgateDoAtendimento(db, a.id);
  const fidelidade = db.petshop.fidelidadeAtiva ? cartao(db, pet.id) : undefined;
  const premio = !resgate && fidelidade?.completo && editavel ? valorDoPremio(db, a) : 0;
  const vendas = verDinheiro ? vendasDoAtendimento(db, a.id) : [];
  const etapaGerida = gerirEtapa ? db.etapas.find((e) => e.id === gerirEtapa) : undefined;
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
            <div className="flex shrink-0 items-center gap-1.5">
              {a.origem === "portal" && (
                <Chip tom="info">
                  <Globe className="mr-1 h-3 w-3" />
                  Online
                </Chip>
              )}
              <StatusChip status={a.status} />
            </div>
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
        {verDinheiro && !!a.sinalValor && (
          <Linha icone={<Globe />} rotulo="Sinal online">
            {a.sinalPago ? (
              <>
                <p className="font-medium">Pago · {moeda(a.sinalValor)}</p>
                <p className="text-[12.5px] text-muted">Já está no caixa; ao finalizar, cobra só a diferença.</p>
              </>
            ) : (
              <>
                <p className="font-medium">{moeda(a.sinalValor)} por Pix · a conferir</p>
                <p className="text-[12.5px] text-muted">Confira no extrato e registre quando cair.</p>
                {editavel && (
                  <button onClick={() => setSinal(true)} className="mt-2 rounded-xl bg-brand-50 px-3 py-2 text-[13.5px] font-semibold text-brand-700">
                    Registrar sinal recebido
                  </button>
                )}
              </>
            )}
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
            {a.desconto > 0 && <p className="text-[12.5px] text-muted">Desconto de {moeda(a.desconto)}{resgate ? ` (prêmio de fidelidade ${moeda(resgate.valor)})` : ""}</p>}
          </Linha>
        )}
        {fidelidade && (resgate || premio > 0) && (
          <Linha icone={<Gift />} rotulo="Fidelidade">
            {resgate ? (
              <>
                <p className="font-medium text-ok-700">Prêmio usado · −{moeda(resgate.valor)}</p>
                {editavel && (
                  <button
                    onClick={() => {
                      const r = desfazerResgate(a.id);
                      toast(r.ok ? "Prêmio devolvido ao cartão" : r.erro, r.ok ? "ok" : "erro");
                    }}
                    className="mt-1 flex items-center gap-1 text-[13px] font-medium text-brand-600"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                    Desfazer
                  </button>
                )}
              </>
            ) : (
              <>
                <p className="font-medium">Cartão completo: {fidelidade.premio}</p>
                <button
                  onClick={() => {
                    const r = resgatar(a.id);
                    toast(r.ok ? `Prêmio aplicado: −${moeda(premio)}` : r.erro, r.ok ? "ok" : "erro");
                  }}
                  className="mt-2 rounded-xl bg-ok-500 px-3 py-2 text-[13.5px] font-semibold text-white"
                >
                  Usar o prêmio aqui (−{moeda(premio)})
                </button>
              </>
            )}
          </Linha>
        )}
        {verDinheiro && (vendas.length > 0 || editavel || a.status === "finalizado") && db.produtos.some((p) => p.ativo) && (
          <Linha icone={<ShoppingBag />} rotulo="Produtos">
            {vendas.length === 0 && <p className="text-muted">Nenhum produto.</p>}
            {vendas.map((v) => {
              const l = porId(db.lancamentos, v.lancamentoId);
              return (
                <div key={v.id} className="mb-1.5">
                  <p className="font-medium">{v.itens.map((i) => (i.quantidade === 1 ? i.nome : `${i.quantidade}× ${i.nome}`)).join(", ")}</p>
                  <p className="text-[12.5px] text-muted">
                    {moeda(v.total)} · {l?.status === "pendente" ? "a receber" : "pago"}
                    {l?.status === "pendente" && (
                      <button onClick={() => setReceberId(l.id)} className="ml-2 font-semibold text-brand-600">
                        Receber
                      </button>
                    )}
                  </p>
                </div>
              );
            })}
            {a.status !== "cancelado" && a.status !== "faltou" && (
              <button onClick={() => setVendendo(true)} className="mt-1 text-[13.5px] font-semibold text-brand-600">
                + Adicionar produto
              </button>
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
          <LinhaDoTempo itens={linha} onGerenciar={registraEtapasDoBanho(papel) ? setGerirEtapa : undefined} />
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
        {editavel && (
          <button
            onClick={() => {
              setMenu(false);
              setEditando(true);
            }}
            className="tap mb-2 flex w-full items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3.5 text-left text-[15px] font-medium text-brand-700"
          >
            <Pencil className="h-5 w-5" />
            {["agendado", "confirmado"].includes(a.status) ? "Reagendar ou mudar serviços" : "Mudar serviços ou desconto"}
          </button>
        )}
        {transicoesDoPapel(papel, a.status).length === 0 ? (
          <p className="pb-4 text-[14px] text-muted">Este atendimento está encerrado. Nenhuma mudança de status disponível.</p>
        ) : (
          <ul className="space-y-2 pb-2">
            {transicoesDoPapel(papel, a.status).filter((s) => ACOES[s]).map((s) => {
              const { rotulo, Icone, perigo } = ACOES[s]!;
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
      <EditarAtendimentoFolha aberta={editando} onFechar={() => setEditando(false)} atendimentoId={a.id} />
      <VendaFolha aberta={vendendo} onFechar={() => setVendendo(false)} atendimentoId={a.id} />
      <PagamentoFolha aberta={!!receberId} onFechar={() => setReceberId(null)} lancamentoId={receberId ?? undefined} />

      <Folha aberta={sinal} onFechar={() => setSinal(false)} titulo="Sinal recebido">
        <p className="text-[14.5px]">
          Conferiu o Pix de <strong>{moeda(a.sinalValor ?? 0)}</strong> no extrato? O valor entra no caixa de hoje e é descontado ao finalizar.
        </p>
        <div className="mt-4">
          <SeletorForma valor={formaSinal} onChange={setFormaSinal} />
        </div>
        <Botao
          className="mt-5"
          onClick={() => {
            const r = registrarSinal(a.id, formaSinal);
            if (!r.ok) return toast(r.erro, "erro");
            toast("Sinal registrado no caixa");
            setSinal(false);
            if (a.status === "agendado") mudar("confirmado");
          }}
        >
          Registrar {moeda(a.sinalValor ?? 0)}
        </Botao>
      </Folha>

      <Folha aberta={!!etapaGerida} onFechar={() => setGerirEtapa(null)} titulo={etapaGerida ? NOME_ETAPA[etapaGerida.etapa] : ""}>
        {etapaGerida && (
          <div className="space-y-2 pb-2">
            {etapaGerida.fotoUrl && (
              <button
                onClick={() => {
                  const r = removerEtapa(etapaGerida.id, true);
                  setGerirEtapa(null);
                  toast(r.ok ? "Foto removida: o tutor não vê mais" : r.erro, r.ok ? "ok" : "erro");
                }}
                className="tap flex w-full items-center gap-3 rounded-2xl border border-line px-4 py-3.5 text-left text-[15px] font-medium"
              >
                <ImageOff className="h-5 w-5" />
                Tirar só a foto
              </button>
            )}
            {!ETAPAS_TRANSPORTE.includes(etapaGerida.etapa) && (
              <button
                onClick={() => {
                  const r = removerEtapa(etapaGerida.id, false);
                  setGerirEtapa(null);
                  toast(r.ok ? "Etapa apagada" : r.erro, r.ok ? "ok" : "erro");
                }}
                className="tap flex w-full items-center gap-3 rounded-2xl border border-line px-4 py-3.5 text-left text-[15px] font-medium text-bad-700"
              >
                <Trash2 className="h-5 w-5" />
                Apagar a etapa{etapaGerida.fotoUrl ? " e a foto" : ""}
              </button>
            )}
            {ETAPAS_TRANSPORTE.includes(etapaGerida.etapa) && !etapaGerida.fotoUrl && <p className="text-[14px] text-muted">Etapas do leva e traz ficam registradas.</p>}
          </div>
        )}
      </Folha>
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
