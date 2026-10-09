// Relatórios do período: faturamento, ticket médio, serviços e clientes que mais rendem,
// formas de pagamento, equipe, produtos e retorno dos clientes. Tudo calculado sobre o Db.

import type { Db, FormaPagamento, Lancamento } from "./types";
import { comissaoDoAtendimento, porId } from "./rules";
import { dataDoIso, diferencaDias, somaDias } from "./format";

const r2 = (v: number) => Math.round(v * 100) / 100;

export interface Periodo {
  de: string; // YYYY-MM-DD
  ate: string; // YYYY-MM-DD
}

export function periodoAnterior(p: Periodo): Periodo {
  const dias = diferencaDias(p.de, p.ate) + 1;
  return { de: somaDias(p.de, -dias), ate: somaDias(p.de, -1) };
}

export function periodoDoMes(ref: string, deslocamento = 0): Periodo {
  const [a, m] = ref.split("-").map(Number);
  const ini = new Date(a, m - 1 + deslocamento, 1);
  const fim = new Date(a, m + deslocamento, 0);
  const f = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { de: f(ini), ate: f(fim) };
}

const dentro = (d: string, p: Periodo) => d >= p.de && d <= p.ate;

export interface Relatorio {
  periodo: Periodo;
  /** Dinheiro que entrou (receitas pagas no período, pela data do pagamento). */
  recebido: number;
  /** Despesas pagas no período. */
  gasto: number;
  saldo: number;
  /** Valor dos atendimentos finalizados no período (pela data do atendimento). */
  faturamentoServicos: number;
  vendasProdutos: number;
  vendasPlanos: number;
  atendimentos: number;
  ticketMedio: number;
  faltas: number;
  cancelamentos: number;
  online: number;
  clientesAtendidos: number;
  clientesNovos: number;
  aReceber: number;
  porCategoriaReceita: { nome: string; valor: number }[];
  porCategoriaDespesa: { nome: string; valor: number }[];
  porForma: { forma: FormaPagamento; valor: number }[];
  servicos: { nome: string; quantidade: number; valor: number; porPlano: number }[];
  clientes: { tutorId: string; nome: string; atendimentos: number; valor: number }[];
  equipe: { membroId: string; nome: string; atendimentos: number; valor: number; comissao: number }[];
  produtos: { nome: string; quantidade: number; valor: number; lucro?: number }[];
  porDia: { data: string; valor: number; atendimentos: number }[];
}

function somaPorChave<T>(xs: T[], chave: (x: T) => string, valor: (x: T) => number) {
  const m = new Map<string, number>();
  for (const x of xs) m.set(chave(x), (m.get(chave(x)) ?? 0) + valor(x));
  return [...m].map(([nome, v]) => ({ nome, valor: r2(v) })).sort((a, b) => b.valor - a.valor);
}

export function relatorio(db: Db, p: Periodo): Relatorio {
  const pagos = db.lancamentos.filter((l) => l.status === "pago" && l.pagoEm && dentro(dataDoIso(l.pagoEm), p));
  const receitas = pagos.filter((l) => l.tipo === "receita");
  const despesas = pagos.filter((l) => l.tipo === "despesa");
  const recebido = r2(receitas.reduce((s, l) => s + l.valor, 0));
  const gasto = r2(despesas.reduce((s, l) => s + l.valor, 0));

  const doPeriodo = db.atendimentos.filter((a) => dentro(a.data, p));
  const finalizados = doPeriodo.filter((a) => a.status === "finalizado");
  const faturamentoServicos = r2(finalizados.reduce((s, a) => s + a.valorTotal, 0));

  const vendas = db.vendas.filter((v) => v.status !== "cancelada" && dentro(dataDoIso(v.criadoEm), p));
  const vendasProdutos = r2(vendas.reduce((s, v) => s + v.total, 0));
  const planos = db.planosPet.filter((x) => dentro(x.inicio, p));
  const vendasPlanos = r2(planos.reduce((s, x) => s + x.preco, 0));

  const porForma = new Map<FormaPagamento, number>();
  for (const l of receitas) if (l.formaPagamento) porForma.set(l.formaPagamento, (porForma.get(l.formaPagamento) ?? 0) + l.valor);

  // Serviços: quantos e quanto (itens de plano contam na quantidade, não no valor).
  const serv = new Map<string, { nome: string; quantidade: number; valor: number; porPlano: number }>();
  for (const a of finalizados) {
    const fator = a.itens.filter((i) => !i.cobertoPorPlano).reduce((s, i) => s + i.preco, 0);
    for (const i of a.itens) {
      const x = serv.get(i.servicoId) ?? { nome: porId(db.servicos, i.servicoId)?.nome ?? i.nome, quantidade: 0, valor: 0, porPlano: 0 };
      x.quantidade++;
      if (i.cobertoPorPlano) x.porPlano++;
      // O desconto do atendimento é dividido entre os itens cobrados, na proporção do preço.
      else x.valor += fator > 0 ? (i.preco / fator) * a.valorTotal : 0;
      serv.set(i.servicoId, x);
    }
  }

  // Clientes: serviços + produtos + planos no período.
  const cli = new Map<string, { atendimentos: number; valor: number }>();
  const somaCli = (tutorId: string | undefined, valor: number, atd = 0) => {
    if (!tutorId) return;
    const x = cli.get(tutorId) ?? { atendimentos: 0, valor: 0 };
    x.valor += valor;
    x.atendimentos += atd;
    cli.set(tutorId, x);
  };
  for (const a of finalizados) somaCli(a.tutorId, a.valorTotal, 1);
  for (const v of vendas) somaCli(v.tutorId, v.total);
  for (const x of planos) somaCli(x.tutorId, x.preco);

  const equipe = new Map<string, { atendimentos: number; valor: number; comissao: number }>();
  for (const a of finalizados) {
    const x = equipe.get(a.profissionalId) ?? { atendimentos: 0, valor: 0, comissao: 0 };
    x.atendimentos++;
    x.valor += a.valorTotal;
    x.comissao += comissaoDoAtendimento(db, a);
    equipe.set(a.profissionalId, x);
  }

  const prod = new Map<string, { nome: string; quantidade: number; valor: number; lucro?: number }>();
  for (const v of vendas) {
    const bruto = v.itens.reduce((s, i) => s + i.preco * i.quantidade, 0);
    for (const i of v.itens) {
      const k = i.produtoId ?? i.nome;
      const x = prod.get(k) ?? { nome: i.nome, quantidade: 0, valor: 0, lucro: 0 };
      const valor = bruto > 0 ? ((i.preco * i.quantidade) / bruto) * v.total : 0;
      x.quantidade += i.quantidade;
      x.valor += valor;
      const custo = porId(db.produtos, i.produtoId)?.custo;
      x.lucro = custo === undefined || x.lucro === undefined ? undefined : x.lucro + valor - custo * i.quantidade;
      prod.set(k, x);
    }
  }

  const atendidos = new Set(finalizados.map((a) => a.tutorId));
  const novos = db.tutores.filter((t) => dentro(dataDoIso(t.criadoEm), p)).length;

  const dias = new Map<string, { valor: number; atendimentos: number }>();
  for (let d = p.de; d <= p.ate; d = somaDias(d, 1)) dias.set(d, { valor: 0, atendimentos: 0 });
  for (const l of receitas) {
    const x = dias.get(dataDoIso(l.pagoEm!));
    if (x) x.valor += l.valor;
  }
  for (const a of finalizados) {
    const x = dias.get(a.data);
    if (x) x.atendimentos++;
  }

  return {
    periodo: p,
    recebido,
    gasto,
    saldo: r2(recebido - gasto),
    faturamentoServicos,
    vendasProdutos,
    vendasPlanos,
    atendimentos: finalizados.length,
    ticketMedio: finalizados.length ? r2(faturamentoServicos / finalizados.length) : 0,
    faltas: doPeriodo.filter((a) => a.status === "faltou").length,
    cancelamentos: doPeriodo.filter((a) => a.status === "cancelado").length,
    online: doPeriodo.filter((a) => a.origem === "portal" && a.status !== "cancelado").length,
    clientesAtendidos: atendidos.size,
    clientesNovos: novos,
    aReceber: r2(db.lancamentos.filter((l) => l.tipo === "receita" && l.status === "pendente").reduce((s, l) => s + l.valor, 0)),
    porCategoriaReceita: somaPorChave(receitas, (l) => l.categoria, (l) => l.valor),
    porCategoriaDespesa: somaPorChave(despesas, (l) => l.categoria, (l) => l.valor),
    porForma: [...porForma].map(([forma, valor]) => ({ forma, valor: r2(valor) })).sort((a, b) => b.valor - a.valor),
    servicos: [...serv.values()].map((x) => ({ ...x, valor: r2(x.valor) })).sort((a, b) => b.quantidade - a.quantidade || b.valor - a.valor),
    clientes: [...cli]
      .map(([tutorId, x]) => ({ tutorId, nome: porId(db.tutores, tutorId)?.nome ?? "Cliente removido", atendimentos: x.atendimentos, valor: r2(x.valor) }))
      .sort((a, b) => b.valor - a.valor),
    equipe: [...equipe]
      .map(([membroId, x]) => ({ membroId, nome: porId(db.membros, membroId)?.nome ?? "—", atendimentos: x.atendimentos, valor: r2(x.valor), comissao: r2(x.comissao) }))
      .sort((a, b) => b.atendimentos - a.atendimentos),
    produtos: [...prod.values()].map((x) => ({ ...x, valor: r2(x.valor), lucro: x.lucro === undefined ? undefined : r2(x.lucro) })).sort((a, b) => b.valor - a.valor),
    porDia: [...dias].map(([data, x]) => ({ data, valor: r2(x.valor), atendimentos: x.atendimentos })),
  };
}

/** Variação percentual entre dois valores (undefined quando não há base). */
export function variacao(atual: number, anterior: number): number | undefined {
  if (anterior <= 0) return undefined;
  return Math.round(((atual - anterior) / anterior) * 100);
}

// ---------------------------------------------------------------------------
// Exportação para planilha (CSV com ; para o Excel em português)
// ---------------------------------------------------------------------------

const celula = (v: unknown) => {
  const s = typeof v === "number" ? v.toFixed(2).replace(".", ",") : String(v ?? "");
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (linhas: unknown[][]) => "﻿" + linhas.map((l) => l.map(celula).join(";")).join("\r\n");

export function csvLancamentos(db: Db, p: Periodo): string {
  const doPeriodo = (l: Lancamento) => dentro(l.pagoEm ? dataDoIso(l.pagoEm) : l.competencia, p);
  const linhas = db.lancamentos
    .filter(doPeriodo)
    .sort((a, b) => ((a.pagoEm ?? a.criadoEm) < (b.pagoEm ?? b.criadoEm) ? -1 : 1))
    .map((l) => [
      (l.pagoEm ? dataDoIso(l.pagoEm) : l.competencia).split("-").reverse().join("/"),
      l.tipo === "receita" ? "Receita" : "Despesa",
      l.categoria,
      l.descricao,
      l.status === "pago" ? "Pago" : "A receber",
      l.formaPagamento ?? "",
      l.tipo === "despesa" ? -l.valor : l.valor,
    ]);
  return csv([["Data", "Tipo", "Categoria", "Descrição", "Situação", "Forma", "Valor"], ...linhas]);
}

export function csvAtendimentos(db: Db, p: Periodo): string {
  const linhas = db.atendimentos
    .filter((a) => dentro(a.data, p))
    .sort((a, b) => (a.data + a.hora < b.data + b.hora ? -1 : 1))
    .map((a) => [
      a.data.split("-").reverse().join("/"),
      a.hora,
      porId(db.pets, a.petId)?.nome ?? "",
      porId(db.tutores, a.tutorId)?.nome ?? "",
      a.itens.map((i) => i.nome + (i.cobertoPorPlano ? " (plano)" : "")).join(" + "),
      porId(db.membros, a.profissionalId)?.nome ?? "",
      a.status,
      a.origem === "portal" ? "Online" : "Balcão",
      a.desconto,
      a.valorTotal,
    ]);
  return csv([["Data", "Hora", "Pet", "Tutor", "Serviços", "Profissional", "Situação", "Origem", "Desconto", "Valor"], ...linhas]);
}
