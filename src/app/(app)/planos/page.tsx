"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CircleMinus, ClipboardList, MessageCircle, Pencil, Plus, Search, Settings2, Undo2 } from "lucide-react";
import { useApp, useDb } from "@/data/store";
import type { FormaPagamento, PlanoModelo, PlanoPet } from "@/domain/types";
import { planoAtivoDoPet, planosAVencer, porId, saldoPlano, statusEfetivoPlano, uid } from "@/domain/rules";
import { dataCurta, dataDoIso, diferencaDias, hoje, lerNumero, moeda } from "@/domain/format";
import { Botao, Campo, Chip, Filtros, Folha, PetAvatar, Progresso, Segmentado, TituloVoltar, Vazio, cx } from "@/components/ui";
import { SeletorForma } from "@/components/pagamento-folha";
import { WhatsappFolha } from "@/components/whatsapp-folha";
import { useToast } from "@/components/providers";

type Filtro = "ativos" | "vencer" | "encerrados" | "todos";

export default function PlanosPagina() {
  return (
    <Suspense>
      <Planos />
    </Suspense>
  );
}

function Planos() {
  const db = useDb();
  const params = useSearchParams();
  const toast = useToast();
  const darBaixa = useApp((s) => s.darBaixaManual);
  const T = hoje();
  const [filtro, setFiltro] = useState<Filtro>(params.get("filtro") === "vencer" ? "vencer" : "ativos");
  const [busca, setBusca] = useState("");
  const [vender, setVender] = useState<string | null>(params.get("vender"));
  const [zap, setZap] = useState<PlanoPet | null>(null);
  const [baixa, setBaixa] = useState<PlanoPet | null>(null);
  const [gerir, setGerir] = useState<string | null>(null);
  const [aba, setAba] = useState<"vendidos" | "pacotes">(params.get("aba") === "pacotes" ? "pacotes" : "vendidos");

  const aVencer = useMemo(() => new Set(planosAVencer(db, T).map((p) => p.id)), [db, T]);
  const ativos = db.planosPet.filter((p) => statusEfetivoPlano(db, p, T) === "ativo");
  const restantes = ativos.reduce((s, p) => s + saldoPlano(db, p.id), 0);

  const lista = db.planosPet
    .filter((p) => {
      const st = statusEfetivoPlano(db, p, T);
      if (filtro === "ativos" && st !== "ativo") return false;
      if (filtro === "vencer" && !aVencer.has(p.id)) return false;
      if (filtro === "encerrados" && st === "ativo") return false;
      const q = busca.trim().toLowerCase();
      if (!q) return true;
      const pet = porId(db.pets, p.petId);
      const tutor = porId(db.tutores, p.tutorId);
      return [p.nome, pet?.nome, tutor?.nome].some((x) => x?.toLowerCase().includes(q));
    })
    .sort((a, b) => (a.vencimento < b.vencimento ? -1 : 1));

  return (
    <div>
      <TituloVoltar
        voltarPara="/mais"
        acao={
          <button onClick={() => setVender("")} className="tap flex items-center gap-1.5 rounded-full px-3 py-2 text-[15px] font-medium text-brand-600">
            <Plus className="h-[18px] w-[18px]" />
            Vender
          </button>
        }
      >
        Planos e pacotes
      </TituloVoltar>

      <Segmentado
        className="mx-5 mb-3 mt-1"
        valor={aba}
        onChange={setAba}
        opcoes={[
          { valor: "vendidos", rotulo: "Planos vendidos" },
          { valor: "pacotes", rotulo: "Pacotes à venda" },
        ]}
      />

      {aba === "pacotes" ? (
        <Pacotes />
      ) : (
      <>
      <div className="mx-5 mt-2 grid grid-cols-3 divide-x divide-brand-200/70 rounded-[20px] bg-surface py-4 text-center">
        <div>
          <p className="text-[22px] font-bold">{ativos.length}</p>
          <p className="text-[12px] text-muted">Planos ativos</p>
        </div>
        <div>
          <p className="text-[22px] font-bold">{restantes}</p>
          <p className="text-[12px] text-muted">Banhos restantes</p>
        </div>
        <div>
          <p className={cx("text-[22px] font-bold", aVencer.size > 0 && "text-warn-700")}>{aVencer.size}</p>
          <p className="text-[12px] text-muted">A vencer</p>
        </div>
      </div>

      <div className="px-5 pt-4">
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-subtle" />
          <input className="input bg-surface pl-11" placeholder="Buscar por plano, tutor ou pet" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Filtros
          valor={filtro}
          onChange={setFiltro}
          opcoes={[
            { valor: "ativos", rotulo: "Ativos", contagem: ativos.length },
            { valor: "vencer", rotulo: "A vencer", contagem: aVencer.size },
            { valor: "encerrados", rotulo: "Encerrados" },
            { valor: "todos", rotulo: "Todos" },
          ]}
        />
      </div>

      {lista.length === 0 ? (
        <Vazio icone={<ClipboardList className="h-6 w-6" />} titulo="Nenhum plano aqui" texto="Venda um pacote de banhos para clientes recorrentes." />
      ) : (
        <ul className="mt-4 space-y-3 px-5">
          {lista.map((p) => {
            const pet = porId(db.pets, p.petId)!;
            const tutor = porId(db.tutores, p.tutorId);
            const saldo = saldoPlano(db, p.id);
            const usados = p.totalUsos - saldo;
            const st = statusEfetivoPlano(db, p, T);
            const faltam = diferencaDias(T, p.vencimento);
            return (
              <li key={p.id} className="card px-4 py-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">{p.nome}</p>
                  {st === "ativo" ? (
                    aVencer.has(p.id) ? <Chip tom="warn">{saldo <= 1 ? "Último banho" : `Vence em ${faltam} dias`}</Chip> : <Chip tom="ok">Ativo</Chip>
                  ) : (
                    <Chip tom="neutral">{st === "finalizado" ? "Concluído" : st === "vencido" ? "Vencido" : "Cancelado"}</Chip>
                  )}
                </div>
                <Link href={`/pets/${pet.id}`} className="mt-2 flex items-center gap-3">
                  <PetAvatar pet={pet} tamanho={40} />
                  <div>
                    <p className="font-semibold">{pet.nome}</p>
                    <p className="text-[13px] text-muted">Tutor: {tutor?.nome}</p>
                  </div>
                </Link>
                <div className="mt-3 rounded-2xl bg-surface px-3.5 py-3">
                  <div className="mb-2 flex justify-between text-[13.5px]">
                    <span>
                      {usados} de {p.totalUsos} usados
                    </span>
                    <span className="font-semibold text-brand-700">{saldo} disponíveis</span>
                  </div>
                  <Progresso valor={usados} total={p.totalUsos} />
                </div>
                <p className="mt-2 text-[12.5px] text-muted">
                  Validade: {dataCurta(p.vencimento)} · pago {moeda(p.preco)}
                  {p.observacoes && ` · ${p.observacoes}`}
                </p>
                <div className="mt-3 flex gap-2">
                  {st === "ativo" && (
                    <button onClick={() => setBaixa(p)} className="tap flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-ok-500 text-[14px] font-semibold text-white">
                      <CircleMinus className="h-4 w-4" />
                      Dar baixa
                    </button>
                  )}
                  {st === "ativo" && (
                    <button onClick={() => setZap(p)} aria-label="Avisar tutor" className="tap grid h-10 w-12 place-items-center rounded-xl border border-line text-brand-600">
                      <MessageCircle className="h-[18px] w-[18px]" />
                    </button>
                  )}
                  <button
                    onClick={() => setGerir(p.id)}
                    aria-label="Usos, observações e cancelamento"
                    className={cx("tap flex h-10 items-center justify-center gap-1.5 rounded-xl border border-line px-3 text-[13.5px] font-medium text-brand-700", st !== "ativo" && "flex-1")}
                  >
                    <Settings2 className="h-4 w-4" />
                    {st !== "ativo" && "Usos e detalhes"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      </>
      )}

      <Folha aberta={!!baixa} onFechar={() => setBaixa(null)} titulo="Dar baixa manual">
        {baixa && (
          <>
            <p className="text-[14.5px]">
              Registrar 1 uso do plano de <strong>{porId(db.pets, baixa.petId)?.nome}</strong> sem atendimento na agenda?
            </p>
            <p className="mt-2 text-[13px] text-muted">Atendimentos finalizados na agenda já descontam sozinhos. Use a baixa manual só para banhos fora da agenda.</p>
            <Botao
              className="mt-5"
              onClick={() => {
                const r = darBaixa(baixa.id);
                if (!r.ok) return toast(r.erro, "erro");
                toast("1 uso descontado do plano");
                setBaixa(null);
              }}
            >
              Confirmar baixa
            </Botao>
          </>
        )}
      </Folha>

      {zap && <WhatsappFolha aberta onFechar={() => setZap(null)} tutorId={zap.tutorId} petId={zap.petId} gatilho="renovacao_plano" />}
      <VenderFolha petInicial={vender} onFechar={() => setVender(null)} />
      {gerir && <GerirPlanoFolha planoId={gerir} onFechar={() => setGerir(null)} />}
    </div>
  );
}

/** Usos (com desfazer), observações e cancelamento com devolução. */
function GerirPlanoFolha({ planoId, onFechar }: { planoId: string; onFechar: () => void }) {
  const db = useDb();
  const desfazer = useApp((s) => s.estornarUso);
  const salvarObs = useApp((s) => s.editarObservacoesPlano);
  const cancelar = useApp((s) => s.cancelarPlano);
  const toast = useToast();
  const plano = porId(db.planosPet, planoId);
  const [obs, setObs] = useState(plano?.observacoes ?? "");
  const [cancelando, setCancelando] = useState(false);
  const [devolucao, setDevolucao] = useState("");
  const [forma, setForma] = useState<FormaPagamento>("pix");
  const [motivo, setMotivo] = useState("");
  const [desfazendo, setDesfazendo] = useState<string | null>(null);
  if (!plano) return null;
  const pet = porId(db.pets, plano.petId);
  const usos = db.planoUsos.filter((u) => u.planoPetId === plano.id).sort((a, b) => (a.em < b.em ? 1 : -1));
  const saldo = saldoPlano(db, plano.id);

  return (
    <Folha aberta onFechar={onFechar} titulo={`${plano.nome} · ${pet?.nome ?? ""}`}>
      <p className="-mt-1 text-[13.5px] text-muted">
        {saldo} de {plano.totalUsos} disponíveis · de {dataCurta(plano.inicio)} a {dataCurta(plano.vencimento)} · pago {moeda(plano.preco)}
      </p>

      <h3 className="mb-2 mt-5 text-[14px] font-semibold">Usos</h3>
      {usos.length === 0 ? (
        <p className="text-[14px] text-muted">Nenhum uso ainda.</p>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {usos.map((u) => {
            const atd = porId(db.atendimentos, u.atendimentoId);
            return (
              <li key={u.id} className={cx("flex items-center gap-3 px-3.5 py-2.5", u.estornado && "opacity-50")}>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium">{dataCurta(dataDoIso(u.em))}</p>
                  <p className="truncate text-[12.5px] text-muted">{u.estornado ? "Desfeito" : atd ? atd.itens.map((i) => i.nome).join(" + ") : "Baixa manual"}</p>
                </div>
                {!u.estornado &&
                  (desfazendo === u.id ? (
                    <button
                      onClick={() => {
                        const r = desfazer(u.id);
                        setDesfazendo(null);
                        if (!r.ok) return toast(r.erro, "erro");
                        toast("Uso desfeito: o saldo voltou");
                      }}
                      className="rounded-lg bg-bad-50 px-2.5 py-1.5 text-[12.5px] font-semibold text-bad-700"
                    >
                      Confirmar
                    </button>
                  ) : (
                    <button onClick={() => setDesfazendo(u.id)} className="flex items-center gap-1 text-[13px] font-medium text-brand-600">
                      <Undo2 className="h-3.5 w-3.5" />
                      Desfazer
                    </button>
                  ))}
              </li>
            );
          })}
        </ul>
      )}

      <Campo rotulo="Observações">
        <textarea className="input mt-4 resize-none" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: secagem morna" />
      </Campo>
      <Botao
        variante="contorno"
        className="mt-3 !h-11"
        onClick={() => {
          const r = salvarObs(plano.id, obs);
          if (!r.ok) return toast(r.erro, "erro");
          toast("Observações salvas");
        }}
      >
        Salvar observações
      </Botao>

      {plano.status !== "cancelado" && (
        <div className="mt-6 border-t border-line pt-4">
          {!cancelando ? (
            <button onClick={() => setCancelando(true)} className="text-[14px] font-medium text-bad-700">
              Cancelar este plano
            </button>
          ) : (
            <div className="space-y-3 rounded-2xl bg-bad-50 px-4 py-4">
              <p className="text-[14px] font-semibold text-bad-700">Cancelar o plano de {pet?.nome}</p>
              <p className="text-[13px] text-muted">Agendamentos futuros que usariam o plano passam a ser cobrados normalmente.</p>
              <Campo rotulo="Valor devolvido ao cliente (R$)" dica="Deixe 0 se não houver devolução. Vira uma despesa no caixa de hoje.">
                <input className="input" inputMode="decimal" value={devolucao} onChange={(e) => setDevolucao(e.target.value)} placeholder="0,00" />
              </Campo>
              {lerNumero(devolucao) > 0 && <SeletorForma valor={forma} onChange={setForma} />}
              <Campo rotulo="Motivo (opcional)">
                <input className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              </Campo>
              <div className="grid grid-cols-2 gap-2">
                <Botao variante="contorno" className="!h-11" onClick={() => setCancelando(false)}>
                  Voltar
                </Botao>
                <Botao
                  variante="perigo"
                  className="!h-11"
                  onClick={() => {
                    const valor = lerNumero(devolucao) || 0;
                    const r = cancelar({ planoId: plano.id, devolucao: valor, formaPagamento: valor > 0 ? forma : undefined, motivo });
                    if (!r.ok) return toast(r.erro, "erro");
                    toast("Plano cancelado");
                    onFechar();
                  }}
                >
                  Cancelar plano
                </Botao>
              </div>
            </div>
          )}
        </div>
      )}
    </Folha>
  );
}

/** Modelos de pacote que a recepção vende (criar, editar, desativar). */
function Pacotes() {
  const db = useDb();
  const [editando, setEditando] = useState<PlanoModelo | null>(null);
  const novo = (): PlanoModelo => ({ id: uid(), nome: "", servicoIds: db.servicos.filter((s) => s.ativo && s.categoria === "banho").slice(0, 1).map((s) => s.id), quantidadeUsos: 4, validadeDias: 30, preco: 0, ativo: true });
  const lista = [...db.planosModelo].sort((a, b) => Number(b.ativo) - Number(a.ativo));
  return (
    <div className="px-5">
      <p className="text-[14px] text-muted">Pacotes de banhos com preço fechado. Cada atendimento finalizado com um serviço do pacote desconta 1 uso.</p>
      <ul className="mt-4 space-y-2.5">
        {lista.map((m) => {
          const vendidos = db.planosPet.filter((p) => p.modeloId === m.id).length;
          const unit = m.quantidadeUsos > 0 ? m.preco / m.quantidadeUsos : 0;
          return (
            <li key={m.id} className={cx("card flex items-center gap-3 px-4 py-3.5", !m.ativo && "opacity-60")}>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{m.nome}</p>
                <p className="truncate text-[12.5px] text-muted">
                  {m.quantidadeUsos} usos · {m.validadeDias} dias · {m.servicoIds.map((id) => porId(db.servicos, id)?.nome).filter(Boolean).join(", ")}
                </p>
                <p className="text-[12.5px] text-muted">
                  {moeda(unit)} por uso · {vendidos} {vendidos === 1 ? "vendido" : "vendidos"}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="font-semibold">{moeda(m.preco)}</span>
                {!m.ativo && <Chip tom="neutral">Desativado</Chip>}
              </div>
              <button aria-label={`Editar ${m.nome}`} onClick={() => setEditando(m)} className="tap grid h-9 w-9 place-items-center rounded-full text-brand-600 hover:bg-surface">
                <Pencil className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ul>
      <Botao variante="contorno" className="mt-4" icone={<Plus className="h-5 w-5" />} onClick={() => setEditando(novo())}>
        Novo pacote
      </Botao>
      {editando && <PacoteFolha pacote={editando} onFechar={() => setEditando(null)} />}
    </div>
  );
}

function PacoteFolha({ pacote, onFechar }: { pacote: PlanoModelo; onFechar: () => void }) {
  const db = useDb();
  const salvar = useApp((s) => s.salvarPacote);
  const toast = useToast();
  const novo = !db.planosModelo.some((m) => m.id === pacote.id);
  const [nome, setNome] = useState(pacote.nome);
  const [servicos, setServicos] = useState<string[]>(pacote.servicoIds);
  const [usos, setUsos] = useState(String(pacote.quantidadeUsos));
  const [validade, setValidade] = useState(String(pacote.validadeDias));
  const [preco, setPreco] = useState(pacote.preco ? String(pacote.preco).replace(".", ",") : "");
  const [ativo, setAtivo] = useState(pacote.ativo);
  const opcoes = db.servicos.filter((s) => s.ativo || servicos.includes(s.id));

  return (
    <Folha aberta onFechar={onFechar} titulo={novo ? "Novo pacote" : `Editar ${pacote.nome}`}>
      <div className="space-y-4">
        <Campo rotulo="Nome">
          <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Pacote 4 banhos" />
        </Campo>
        <div>
          <span className="label">Serviços que o pacote cobre</span>
          <div className="flex flex-wrap gap-2">
            {opcoes.map((s) => {
              const on = servicos.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setServicos(on ? servicos.filter((x) => x !== s.id) : [...servicos, s.id])}
                  className={cx("tap rounded-full border px-3.5 py-2 text-[13.5px] font-medium", on ? "border-brand-600 bg-brand-600 text-white" : "border-line text-muted")}
                >
                  {s.nome}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[12.5px] text-muted">Cada atendimento usa no máximo 1 uso, mesmo com dois serviços do pacote.</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Campo rotulo="Usos">
            <input className="input" inputMode="numeric" value={usos} onChange={(e) => setUsos(e.target.value)} />
          </Campo>
          <Campo rotulo="Validade (dias)">
            <input className="input" inputMode="numeric" value={validade} onChange={(e) => setValidade(e.target.value)} />
          </Campo>
          <Campo rotulo="Preço (R$)">
            <input className="input" inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} />
          </Campo>
        </div>
        {!novo && (
          <label className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 text-[14.5px]">
            <span>
              À venda
              <span className="block text-[12.5px] text-muted">Desativado não aparece para vender; os planos já vendidos continuam valendo.</span>
            </span>
            <input type="checkbox" className="h-6 w-6 accent-brand-600" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
          </label>
        )}
      </div>
      <Botao
        className="mt-5"
        onClick={() => {
          const r = salvar({ ...pacote, nome, servicoIds: servicos, quantidadeUsos: Number(usos), validadeDias: Number(validade), preco: lerNumero(preco), ativo });
          if (!r.ok) return toast(r.erro, "erro");
          toast(novo ? "Pacote criado" : "Pacote atualizado");
          onFechar();
        }}
      >
        {novo ? "Criar pacote" : "Salvar"}
      </Botao>
    </Folha>
  );
}

function VenderFolha({ petInicial, onFechar }: { petInicial: string | null; onFechar: () => void }) {
  const db = useDb();
  const vender = useApp((s) => s.venderPlano);
  const toast = useToast();
  const T = hoje();
  const aberta = petInicial !== null;
  const [petId, setPetId] = useState<string>("");
  const modelos = db.planosModelo.filter((m) => m.ativo);
  const [modeloId, setModeloId] = useState(modelos[0]?.id ?? "");
  const [preco, setPreco] = useState("");
  const [forma, setForma] = useState<FormaPagamento>("pix");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (aberta) {
      setPetId(petInicial ?? "");
      setBusca("");
      const m = modelos[0];
      setModeloId(m?.id ?? "");
      setPreco(m ? String(m.preco) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta, petInicial]);

  const pet = porId(db.pets, petId);
  const candidatos = db.pets
    .filter((p) => !planoAtivoDoPet(db, p.id, T))
    .filter((p) => {
      const q = busca.trim().toLowerCase();
      return !q || p.nome.toLowerCase().includes(q) || porId(db.tutores, p.tutorId)?.nome.toLowerCase().includes(q);
    })
    .slice(0, 6);

  return (
    <Folha aberta={aberta} onFechar={onFechar} titulo="Vender plano">
      <div className="space-y-4">
        <div>
          <span className="label">Pet</span>
          {pet ? (
            <div className="flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-3 py-2.5">
              <PetAvatar pet={pet} tamanho={36} />
              <span className="flex-1 font-semibold">
                {pet.nome}
                <span className="block text-[12.5px] font-normal text-muted">{porId(db.tutores, pet.tutorId)?.nome}</span>
              </span>
              <button onClick={() => setPetId("")} className="text-[14px] font-medium text-brand-600">
                Trocar
              </button>
            </div>
          ) : (
            <>
              <input className="input" placeholder="Buscar pet ou tutor" value={busca} onChange={(e) => setBusca(e.target.value)} />
              <ul className="mt-2 divide-y divide-line rounded-2xl border border-line">
                {candidatos.map((p) => (
                  <li key={p.id}>
                    <button onClick={() => setPetId(p.id)} className="tap flex w-full items-center gap-3 px-3 py-2.5 text-left">
                      <PetAvatar pet={p} tamanho={32} />
                      <span className="text-[14.5px] font-medium">{p.nome}</span>
                      <span className="text-[12.5px] text-muted">{porId(db.tutores, p.tutorId)?.nome}</span>
                    </button>
                  </li>
                ))}
                {candidatos.length === 0 && <li className="px-3 py-2.5 text-[14px] text-muted">Nenhum pet sem plano encontrado.</li>}
              </ul>
            </>
          )}
        </div>
        <div>
          <span className="label">Pacote</span>
          <div className="space-y-2">
            {modelos.length === 0 && <p className="text-[14px] text-muted">Nenhum pacote à venda. Crie um na aba “Pacotes à venda”.</p>}
            {modelos.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setModeloId(m.id);
                  setPreco(String(m.preco));
                }}
                className={cx("tap flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left", m.id === modeloId ? "border-brand-600 bg-brand-50" : "border-line")}
              >
                <span>
                  <span className="block text-[15px] font-medium">{m.nome}</span>
                  <span className="block text-[12.5px] text-muted">
                    {m.quantidadeUsos} usos · validade {m.validadeDias} dias
                  </span>
                </span>
                <span className="font-semibold">{moeda(m.preco)}</span>
              </button>
            ))}
          </div>
        </div>
        <Campo rotulo="Preço cobrado (R$)">
          <input className="input text-[17px] font-semibold" inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} />
        </Campo>
        <div>
          <span className="label">Pagamento</span>
          <SeletorForma valor={forma} onChange={setForma} />
        </div>
        <Botao
          onClick={() => {
            const r = vender({ modeloId, petId, preco: lerNumero(preco), formaPagamento: forma, inicio: T });
            if (!r.ok) return toast(r.erro, "erro");
            toast(`Plano vendido para ${pet?.nome}. Receita no caixa de hoje.`);
            onFechar();
          }}
          disabled={!pet}
        >
          Confirmar venda
        </Botao>
      </div>
    </Folha>
  );
}
