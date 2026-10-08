"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, CalendarDays, ChevronLeft, ChevronRight, Clock, Lock, Plus, ReceiptText } from "lucide-react";
import { useApp, useDb } from "@/data/store";
import type { FormaPagamento } from "@/domain/types";
import { porId, resumoCaixa } from "@/domain/rules";
import { NOME_FORMA, dataCurta, dataMedia, diferencaDias, hoje, horaDoIso, moeda, moedaCurta, somaDias } from "@/domain/format";
import { Botao, Campo, Chip, Folha, PetAvatar, Titulo, cx } from "@/components/ui";
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
  const [fechando, setFechando] = useState(false);
  const ehHoje = data === T;
  const irPara = (d: string) => router.replace(d === T ? "/financeiro" : `/financeiro?data=${d}`, { scroll: false });

  return (
    <div>
      <Titulo
        acao={
          <button onClick={() => setDespesa(true)} className="tap flex items-center gap-1.5 rounded-full px-3 py-2 text-[15px] font-medium text-brand-600">
            <Plus className="h-[18px] w-[18px]" />
            Despesa
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
              const titulo = l.categoria === "Planos" ? "Venda de plano" : l.categoria === "Serviços" ? "Serviço pago" : l.descricao;
              const detalhe = l.categoria === "Planos" || l.categoria === "Serviços" ? l.descricao.split(" · ").slice(1).join(" · ") || l.descricao : l.categoria;
              return (
                <li key={l.id} className="flex items-center gap-3 py-3">
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
                <li key={l.id}>
                  <button onClick={() => setPagando({ id: l.id })} className="tap flex w-full items-center gap-3 py-3 text-left">
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
        <Link href="/planos" className="block py-2 text-center text-[14px] font-medium text-brand-600">
          Ver planos e pacotes
        </Link>
      </div>

      <PagamentoFolha aberta={!!pagando} onFechar={() => setPagando(null)} lancamentoId={pagando?.id} />
      <DespesaFolha aberta={despesa} onFechar={() => setDespesa(false)} />

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

function DespesaFolha({ aberta, onFechar }: { aberta: boolean; onFechar: () => void }) {
  const lancar = useApp((s) => s.lancarDespesa);
  const toast = useToast();
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [categoria, setCategoria] = useState("Produtos");
  const [forma, setForma] = useState<FormaPagamento>("pix");

  return (
    <Folha aberta={aberta} onFechar={onFechar} titulo="Lançar despesa">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const r = lancar({ descricao, categoria, valor: Number(valor.replace(",", ".")), formaPagamento: forma });
          if (!r.ok) return toast(r.erro, "erro");
          toast("Despesa lançada");
          setDescricao("");
          setValor("");
          onFechar();
        }}
      >
        <Campo rotulo="Descrição">
          <input className="input" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Shampoo neutro 5 L" />
        </Campo>
        <Campo rotulo="Valor (R$)">
          <input className="input" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
        </Campo>
        <div>
          <span className="label">Categoria</span>
          <div className="flex flex-wrap gap-2">
            {CATEGORIAS.map((c) => (
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
          <span className="label">Pago com</span>
          <SeletorForma valor={forma} onChange={setForma} />
        </div>
        <Botao type="submit">Lançar despesa</Botao>
      </form>
    </Folha>
  );
}
