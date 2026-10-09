"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, BarChart3, CalendarDays, ChevronLeft, ChevronRight, Clock, Ellipsis, Lock, Plus, ReceiptText, Trash2, Undo2 } from "lucide-react";
import { useApp, useDb } from "@/data/store";
import type { FormaPagamento, Lancamento } from "@/domain/types";
import { bloqueioExcluirLancamento, origemDoLancamento } from "@/domain/edicao";
import { porId, resumoCaixa } from "@/domain/rules";
import { NOME_FORMA, dataCurta, dataDoIso, dataMedia, diferencaDias, hoje, horaDoIso, lerNumero, moeda, moedaCurta, somaDias } from "@/domain/format";
import { Botao, Campo, Chip, Folha, PetAvatar, Segmentado, Titulo, cx } from "@/components/ui";
import { PagamentoFolha, SeletorForma } from "@/components/pagamento-folha";
import { useToast } from "@/components/providers";

export default function FinanceiroPagina() {
  return (
    <Suspense>
      <Financeiro />
    </Suspense>
  );
}

function Financeiro() {
  const db = useDb();
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const fecharCaixa = useApp((s) => s.fecharCaixa);
  const T = hoje();
  const data = params.get("data") ?? T;
  const r = resumoCaixa(db, data);
  const [pagando, setPagando] = useState<{ id?: string } | null>(null);
  const [despesa, setDespesa] = useState(false);
  const [gerir, setGerir] = useState<string | null>(null);
  const [fechando, setFechando] = useState(false);
  const ehHoje = data === T;
  const irPara = (d: string) => router.replace(d === T ? "/financeiro" : `/financeiro?data=${d}`, { scroll: false });

  return (
    <div>
      <Titulo
        acao={
          <button onClick={() => setDespesa(true)} className="tap flex items-center gap-1.5 rounded-full px-3 py-2 text-[15px] font-medium text-brand-600">
            <Plus className="h-[18px] w-[18px]" />
            Lançar
          </button>
        }
      >
        Financeiro
      </Titulo>

      <div className="mx-5 flex items-center justify-between rounded-2xl border border-line px-2 py-1.5">
        <button aria-label="Dia anterior" onClick={() => irPara(somaDias(data, -1))} className="tap grid h-10 w-10 place-items-center text-muted">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="flex items-center gap-2 text-[15px]">
          <CalendarDays className="h-[18px] w-[18px] text-ink" />
          {ehHoje ? dataMedia(data) : dataCurta(data)}
        </span>
        <button aria-label="Próximo dia" onClick={() => irPara(somaDias(data, 1))} disabled={ehHoje} className="tap grid h-10 w-10 place-items-center text-muted disabled:opacity-30">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="px-5 pt-5">
        <p className="text-[17px] font-semibold">{ehHoje ? "Caixa de hoje" : "Caixa do dia"}</p>
        <p className="mt-1 text-[44px] font-bold leading-none tracking-tight text-brand-600">{moedaCurta(r.saldo)}</p>
        <p className="mt-2 text-[14px] text-muted">Saldo do dia (abertura {moeda(r.saldoInicial)})</p>
        {r.fechado && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-[12.5px] text-muted">
            <Lock className="h-3.5 w-3.5" />
            Caixa fechado por {porId(db.membros, r.fechado.fechadoPorId)?.nome.split(" ")[0]} às {horaDoIso(r.fechado.fechadoEm)}
          </p>
        )}
      </div>

      <div className="mx-5 mt-4 grid grid-cols-2 gap-3">
        <div className="card flex items-center gap-3 px-4 py-3.5">
          <ArrowUp className="h-6 w-6 text-ok-500" strokeWidth={2.4} />
          <div>
            <p className="text-[13px] text-muted">Entradas</p>
            <p className="text-[18px] font-bold">{moedaCurta(r.entradas)}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 px-4 py-3.5">
          <ArrowDown className="h-6 w-6 text-bad-500" strokeWidth={2.4} />
          <div>
            <p className="text-[13px] text-muted">Saídas</p>
            <p className="text-[18px] font-bold">{moedaCurta(r.saidas)}</p>
          </div>
        </div>
      </div>

      <a href="#a-receber" className="tap mx-5 mt-3 flex items-center gap-3 rounded-2xl bg-surface px-4 py-3.5">
        <Clock className="h-6 w-6 text-ink/80" />
        <div className="flex-1">
          <p className="text-[13px] text-muted">A receber</p>
          <p className="text-[18px] font-bold">{moedaCurta(r.aReceber)}</p>
        </div>
        <ChevronRight className="h-5 w-5 text-subtle" />
      </a>

      <section className="mt-6 px-5">
        <h2 className="mb-1 text-[17px] font-semibold">{ehHoje ? "Movimentações de hoje" : "Movimentações do dia"}</h2>
        {r.movimentos.length === 0 ? (
          <p className="py-4 text-[14px] text-muted">Nenhuma movimentação neste dia.</p>
        ) : (
          <ul className="divide-y divide-line">
            {r.movimentos.map((l) => {
              const entrada = l.tipo === "receita";
              const titulo = l.categoria === "Planos" ? "Venda de plano" : l.categoria === "Serviços" ? "Serviço pago" : l.categoria === "Sinal" ? "Sinal do agendamento online" : l.descricao;
              const detalhe = ["Planos", "Serviços", "Sinal"].includes(l.categoria) ? l.descricao.split(" · ").slice(1).join(" · ") || l.descricao : l.categoria;
              return (
                <li key={l.id}>
                  <button onClick={() => setGerir(l.id)} className="tap flex w-full items-center gap-3 py-3 text-left">
                  <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-full", entrada ? "bg-ok-50 text-ok-500" : "bg-bad-50 text-bad-500")}>
                    {entrada ? <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.4} /> : <ArrowDown className="h-[18px] w-[18px]" strokeWidth={2.4} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">{titulo}</p>
                    <p className="truncate text-[12.5px] text-muted">
                      {horaDoIso(l.pagoEm!)} · {detalhe}
                      {l.formaPagamento && ` · ${NOME_FORMA[l.formaPagamento]}`}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={cx("text-[15px] font-semibold", !entrada && "text-bad-500")}>
                      {entrada ? "" : "- "}
                      {moedaCurta(l.valor)}
                    </span>
                    <Chip tom="ok" className="!px-2 !py-0.5 !text-[11px]">
                      Pago
                    </Chip>
                  </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section id="a-receber" className="mt-4 scroll-mt-4 px-5">
        <h2 className="mb-1 flex items-center gap-2 text-[17px] font-semibold">
          <Clock className="h-5 w-5 text-brand-600" />A receber
        </h2>
        {r.pendentes.length === 0 ? (
          <p className="py-4 text-[14px] text-muted">Nada pendente. Tudo recebido.</p>
        ) : (
          <ul className="divide-y divide-line">
            {r.pendentes.map((l) => {
              const atd = porId(db.atendimentos, l.atendimentoId);
              const pet = atd ? porId(db.pets, atd.petId) : undefined;
              const dias = atd ? diferencaDias(atd.data, T) : 0;
              return (
                <li key={l.id} className="flex items-center gap-1">
                  <button onClick={() => setPagando({ id: l.id })} className="tap flex min-w-0 flex-1 items-center gap-3 py-3 text-left">
                    {pet ? <PetAvatar pet={pet} tamanho={40} /> : <ReceiptText className="h-10 w-10 p-2 text-muted" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium">{l.descricao}</p>
                      <p className="text-[12.5px] text-muted">
                        {atd ? (dias === 0 ? `hoje · ${atd.hora}` : dias === 1 ? `ontem · ${atd.hora}` : `${dataCurta(atd.data)} · ${atd.hora}`) : dataCurta(l.competencia)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[15px] font-semibold">{moedaCurta(l.valor)}</span>
                      <Chip tom="warn" className="!px-2 !py-0.5 !text-[11px]">
                        Pendente
                      </Chip>
                    </div>
                  </button>
                  {!l.atendimentoId && (
                    <button aria-label="Opções" onClick={() => setGerir(l.id)} className="tap grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface">
                      <Ellipsis className="h-4 w-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="space-y-3 px-5 pt-4">
        <Botao icone={<Plus className="h-5 w-5" />} onClick={() => setPagando({})} disabled={r.pendentes.length === 0}>
          Registrar pagamento
        </Botao>
        {ehHoje && !r.fechado && (
          <Botao variante="contorno" icone={<Lock className="h-5 w-5" />} onClick={() => setFechando(true)}>
            Fechar caixa
          </Botao>
        )}
        <div className="flex justify-center gap-6">
          <Link href="/relatorios" className="flex items-center gap-1.5 py-2 text-[14px] font-medium text-brand-600">
            <BarChart3 className="h-4 w-4" />
            Relatórios
          </Link>
          <Link href="/planos" className="block py-2 text-center text-[14px] font-medium text-brand-600">
            Planos e pacotes
          </Link>
        </div>
      </div>

      <PagamentoFolha aberta={!!pagando} onFechar={() => setPagando(null)} lancamentoId={pagando?.id} />
      <LancarFolha aberta={despesa} onFechar={() => setDespesa(false)} />
      {gerir && <GerirLancamentoFolha lancamentoId={gerir} onFechar={() => setGerir(null)} />}

      <Folha aberta={fechando} onFechar={() => setFechando(false)} titulo="Fechar caixa de hoje">
        <dl className="space-y-2 rounded-2xl bg-surface px-4 py-4 text-[15px]">
          <div className="flex justify-between"><dt className="text-muted">Abertura</dt><dd>{moeda(r.saldoInicial)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Entradas</dt><dd className="text-ok-700">+ {moeda(r.entradas)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Saídas</dt><dd className="text-bad-700">- {moeda(r.saidas)}</dd></div>
          <div className="flex justify-between border-t border-line pt-2 font-semibold"><dt>Saldo final</dt><dd>{moeda(r.saldo)}</dd></div>
        </dl>
        {r.pendentes.length > 0 && (
          <p className="mt-3 text-[13px] text-muted">
            {r.pendentes.length} {r.pendentes.length === 1 ? "valor continua" : "valores continuam"} a receber ({moeda(r.aReceber)}) e {r.pendentes.length === 1 ? "aparece" : "aparecem"} amanhã.
          </p>
        )}
        <Botao
          className="mt-5"
          onClick={() => {
            const res = fecharCaixa(data);
            if (!res.ok) return toast(res.erro, "erro");
            toast("Caixa fechado");
            setFechando(false);
          }}
        >
          Confirmar fechamento
        </Botao>
      </Folha>
    </div>
  );
}

const CATEGORIAS = ["Produtos", "Materiais", "Aluguel", "Contas", "Equipe", "Outros"];
const CATEGORIAS_RECEITA = ["Serviços", "Hospedagem", "Adestramento", "Produtos", "Outros"];

/** Despesa paga ou receita avulsa (recebida agora ou a receber). */
function LancarFolha({ aberta, onFechar }: { aberta: boolean; onFechar: () => void }) {
  const lancarDespesa = useApp((s) => s.lancarDespesa);
  const lancarReceita = useApp((s) => s.lancarReceita);
  const toast = useToast();
  const [tipo, setTipo] = useState<"despesa" | "receita">("despesa");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [categoria, setCategoria] = useState("Produtos");
  const [forma, setForma] = useState<FormaPagamento | "depois">("pix");
  const cats = tipo === "despesa" ? CATEGORIAS : CATEGORIAS_RECEITA;

  return (
    <Folha aberta={aberta} onFechar={onFechar} titulo={tipo === "despesa" ? "Lançar despesa" : "Lançar receita"}>
      <Segmentado
        className="mb-4"
        valor={tipo}
        onChange={(t) => {
          setTipo(t);
          setCategoria(t === "despesa" ? "Produtos" : "Serviços");
          setForma("pix");
        }}
        opcoes={[
          { valor: "despesa", rotulo: "Despesa" },
          { valor: "receita", rotulo: "Receita avulsa" },
        ]}
      />
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const v = lerNumero(valor);
          const r =
            tipo === "despesa"
              ? lancarDespesa({ descricao, categoria, valor: v, formaPagamento: forma === "depois" ? "pix" : forma })
              : lancarReceita({ descricao, categoria, valor: v, formaPagamento: forma === "depois" ? undefined : forma });
          if (!r.ok) return toast(r.erro, "erro");
          toast(tipo === "despesa" ? "Despesa lançada" : forma === "depois" ? "Receita a receber lançada" : "Receita lançada no caixa");
          setDescricao("");
          setValor("");
          onFechar();
        }}
      >
        <Campo rotulo="Descrição">
          <input className="input" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder={tipo === "despesa" ? "Ex.: Shampoo neutro 5 L" : "Ex.: Hospedagem do Thor (2 diárias)"} />
        </Campo>
        <Campo rotulo="Valor (R$)">
          <input className="input" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
        </Campo>
        <div>
          <span className="label">Categoria</span>
          <div className="flex flex-wrap gap-2">
            {cats.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategoria(c)}
                className={cx("tap rounded-full border px-3.5 py-2 text-[13px] font-medium", c === categoria ? "border-brand-600 bg-brand-600 text-white" : "border-line text-muted")}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="label">{tipo === "despesa" ? "Pago com" : "Recebido com"}</span>
          {forma !== "depois" && <SeletorForma valor={forma} onChange={setForma} />}
          {tipo === "receita" && (
            <button
              type="button"
              onClick={() => setForma(forma === "depois" ? "pix" : "depois")}
              className={cx("tap mt-2 w-full rounded-2xl border px-4 py-3 text-left text-[14px] font-medium", forma === "depois" ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line text-muted")}
            >
              {forma === "depois" ? "✓ Ainda não recebi (fica a receber)" : "Ainda não recebi"}
            </button>
          )}
        </div>
        <Botao type="submit">{tipo === "despesa" ? "Lançar despesa" : "Lançar receita"}</Botao>
      </form>
    </Folha>
  );
}

/** Detalhe de um lançamento: desfazer recebimento ou excluir o que foi lançado por engano. */
function GerirLancamentoFolha({ lancamentoId, onFechar }: { lancamentoId: string; onFechar: () => void }) {
  const db = useDb();
  const estornar = useApp((s) => s.estornarPagamento);
  const excluir = useApp((s) => s.excluirLancamento);
  const toast = useToast();
  const [confirmar, setConfirmar] = useState<"estornar" | "excluir" | null>(null);
  const l = porId(db.lancamentos, lancamentoId) as Lancamento | undefined;
  if (!l) return null;
  const origem = origemDoLancamento(db, l);
  const bloqueioExcluir = bloqueioExcluirLancamento(db, l);
  const podeEstornar = l.tipo === "receita" && l.status === "pago" && !origem && !(l.pagoEm && db.caixas.some((c) => c.data === dataDoIso(l.pagoEm!)));

  return (
    <Folha aberta onFechar={onFechar} titulo={l.tipo === "receita" ? "Receita" : "Despesa"}>
      <div className="rounded-2xl bg-surface px-4 py-3">
        <p className="text-[13px] text-muted">{l.categoria}</p>
        <p className="text-[15px] font-semibold">{l.descricao}</p>
        <p className={cx("mt-1 text-[24px] font-bold tracking-tight", l.tipo === "despesa" ? "text-bad-700" : "text-brand-700")}>{moeda(l.valor)}</p>
        <p className="text-[12.5px] text-muted">
          {l.status === "pago" ? `Pago em ${dataCurta(dataDoIso(l.pagoEm!))} às ${horaDoIso(l.pagoEm!)}${l.formaPagamento ? ` · ${NOME_FORMA[l.formaPagamento]}` : ""}` : "A receber"}
        </p>
      </div>
      <div className="mt-4 space-y-2 pb-2">
        {podeEstornar &&
          (confirmar === "estornar" ? (
            <Botao
              variante="perigo"
              onClick={() => {
                const r = estornar(l.id);
                if (!r.ok) return toast(r.erro, "erro");
                toast("Recebimento desfeito: voltou para a receber");
                onFechar();
              }}
            >
              Confirmar: não foi recebido
            </Botao>
          ) : (
            <button onClick={() => setConfirmar("estornar")} className="tap flex w-full items-center gap-3 rounded-2xl border border-line px-4 py-3.5 text-left text-[15px] font-medium">
              <Undo2 className="h-5 w-5" />
              Desfazer recebimento (registrado por engano)
            </button>
          ))}
        {!bloqueioExcluir &&
          (confirmar === "excluir" ? (
            <Botao
              variante="perigo"
              onClick={() => {
                const r = excluir(l.id);
                if (!r.ok) return toast(r.erro, "erro");
                toast("Lançamento excluído");
                onFechar();
              }}
            >
              Confirmar exclusão
            </Botao>
          ) : (
            <button onClick={() => setConfirmar("excluir")} className="tap flex w-full items-center gap-3 rounded-2xl border border-line px-4 py-3.5 text-left text-[15px] font-medium text-bad-700">
              <Trash2 className="h-5 w-5" />
              Excluir lançamento
            </button>
          ))}
        {!podeEstornar && bloqueioExcluir && <p className="text-[13.5px] text-muted">{bloqueioExcluir}</p>}
      </div>
    </Folha>
  );
}
