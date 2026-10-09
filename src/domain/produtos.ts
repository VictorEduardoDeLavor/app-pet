// Produtos, estoque e vendas (balcão ou junto com o atendimento).
// O saldo do estoque é a soma dos movimentos: entrada, venda, ajuste e estorno (no banco, um trigger soma).

import type { Db, FormaPagamento, Lancamento, MovimentoEstoque, Produto, Venda, VendaItem } from "./types";
import { ErroRegra, porId, uid } from "./rules";
import { dataDoIso } from "./format";

const r2 = (v: number) => Math.round(v * 100) / 100;
const limpar = (s: string | undefined) => (s ?? "").trim().replace(/\s+/g, " ");

export const CATEGORIAS_PRODUTO = ["Higiene", "Alimentação", "Petiscos", "Acessórios", "Brinquedos", "Farmácia", "Outros"];
export const UNIDADES = ["un", "pct", "kg", "g", "L", "ml"];

export function produtoEmBranco(): Produto {
  return { id: uid(), nome: "", categoria: "Higiene", precoVenda: 0, custo: undefined, estoque: 0, estoqueMinimo: 0, unidade: "un", ativo: true, criadoEm: new Date().toISOString() };
}

export function salvarProduto(db: Db, p: Produto, agora: Date, estoqueInicial = 0): { db: Db; produto: Produto; novo: boolean; movimento?: MovimentoEstoque } {
  const nome = limpar(p.nome);
  if (nome.length < 2) throw new ErroRegra("Informe o nome do produto.");
  if (db.produtos.some((x) => x.id !== p.id && x.nome.toLowerCase() === nome.toLowerCase())) throw new ErroRegra("Já existe um produto com este nome.");
  if (!(p.precoVenda >= 0)) throw new ErroRegra("Preço de venda inválido.");
  if (p.custo !== undefined && !(p.custo >= 0)) throw new ErroRegra("Custo inválido.");
  if (!(p.estoqueMinimo >= 0)) throw new ErroRegra("Estoque mínimo inválido.");
  if (!(estoqueInicial >= 0)) throw new ErroRegra("Estoque inicial inválido.");
  const existente = porId(db.produtos, p.id);
  const produto: Produto = {
    ...p,
    nome,
    categoria: limpar(p.categoria) || "Outros",
    unidade: limpar(p.unidade) || "un",
    precoVenda: r2(p.precoVenda),
    custo: p.custo === undefined ? undefined : r2(p.custo),
    // O saldo nunca é digitado na edição: só muda por movimento.
    estoque: existente ? existente.estoque : 0,
    criadoEm: existente?.criadoEm ?? agora.toISOString(),
  };
  let novoDb: Db = {
    ...db,
    produtos: existente ? db.produtos.map((x) => (x.id === produto.id ? produto : x)) : [...db.produtos, produto],
  };
  let movimento: MovimentoEstoque | undefined;
  if (!existente && estoqueInicial > 0) {
    const r = entradaEstoque(novoDb, { produtoId: produto.id, quantidade: estoqueInicial, custoUnitario: produto.custo, observacao: "Estoque inicial" }, agora);
    novoDb = r.db;
    movimento = r.movimento;
  }
  return { db: novoDb, produto: porId(novoDb.produtos, produto.id)!, novo: !existente, movimento };
}

function aplicarMovimento(db: Db, m: MovimentoEstoque): Db {
  return {
    ...db,
    movimentos: [...db.movimentos, m],
    produtos: db.produtos.map((p) =>
      p.id === m.produtoId
        ? { ...p, estoque: r2(p.estoque + m.quantidade), custo: m.tipo === "entrada" && m.custoUnitario !== undefined ? m.custoUnitario : p.custo }
        : p,
    ),
  };
}

export interface EntradaInput {
  produtoId: string;
  quantidade: number;
  custoUnitario?: number;
  observacao?: string;
  /** Lança a compra como despesa paga hoje. */
  despesaForma?: FormaPagamento;
}

export function entradaEstoque(db: Db, input: EntradaInput, agora: Date): { db: Db; movimento: MovimentoEstoque; despesa?: Lancamento } {
  const produto = porId(db.produtos, input.produtoId);
  if (!produto) throw new ErroRegra("Produto não encontrado.");
  if (!(input.quantidade > 0)) throw new ErroRegra("Informe a quantidade que chegou.");
  if (input.custoUnitario !== undefined && !(input.custoUnitario >= 0)) throw new ErroRegra("Custo inválido.");
  if (input.despesaForma && !(input.custoUnitario && input.custoUnitario > 0)) throw new ErroRegra("Para lançar a compra no caixa, informe o custo.");
  const movimento: MovimentoEstoque = {
    id: uid(),
    produtoId: produto.id,
    tipo: "entrada",
    quantidade: r2(input.quantidade),
    custoUnitario: input.custoUnitario === undefined ? undefined : r2(input.custoUnitario),
    observacao: limpar(input.observacao) || undefined,
    porMembroId: db.usuarioAtualId,
    em: agora.toISOString(),
  };
  let novo = aplicarMovimento(db, movimento);
  let despesa: Lancamento | undefined;
  if (input.despesaForma && input.custoUnitario) {
    despesa = {
      id: uid(),
      tipo: "despesa",
      categoria: "Produtos",
      descricao: `Compra · ${produto.nome} (${r2(input.quantidade)} ${produto.unidade})`,
      valor: r2(input.quantidade * input.custoUnitario),
      formaPagamento: input.despesaForma,
      status: "pago",
      competencia: dataDoIso(agora.toISOString()),
      criadoEm: agora.toISOString(),
      pagoEm: agora.toISOString(),
    };
    novo = { ...novo, lancamentos: [...novo.lancamentos, despesa] };
  }
  return { db: novo, movimento, despesa };
}

/** Contagem do estoque: informa o saldo real e o sistema registra a diferença. */
export function ajustarEstoque(db: Db, input: { produtoId: string; saldoReal: number; observacao?: string }, agora: Date): { db: Db; movimento: MovimentoEstoque } {
  const produto = porId(db.produtos, input.produtoId);
  if (!produto) throw new ErroRegra("Produto não encontrado.");
  if (!(input.saldoReal >= 0)) throw new ErroRegra("Informe quanto tem na prateleira.");
  const dif = r2(input.saldoReal - produto.estoque);
  if (dif === 0) throw new ErroRegra("O saldo já é esse.");
  const movimento: MovimentoEstoque = {
    id: uid(),
    produtoId: produto.id,
    tipo: "ajuste",
    quantidade: dif,
    observacao: limpar(input.observacao) || "Contagem do estoque",
    porMembroId: db.usuarioAtualId,
    em: agora.toISOString(),
  };
  return { db: aplicarMovimento(db, movimento), movimento };
}

export interface VendaInput {
  itens: { produtoId: string; quantidade: number; preco?: number }[];
  desconto?: number;
  tutorId?: string;
  atendimentoId?: string;
  /** Sem forma = fica a receber (fiado ou paga junto com o banho). */
  formaPagamento?: FormaPagamento;
}

export function totalDaVenda(db: Db, input: { itens: { produtoId?: string; quantidade: number; preco?: number }[]; desconto?: number }): { bruto: number; total: number } {
  const bruto = r2(input.itens.reduce((s, i) => s + (i.preco ?? porId(db.produtos, i.produtoId)?.precoVenda ?? 0) * i.quantidade, 0));
  return { bruto, total: r2(Math.max(0, bruto - (input.desconto ?? 0))) };
}

export function registrarVenda(db: Db, input: VendaInput, agora: Date): { db: Db; venda: Venda; lancamento?: Lancamento } {
  if (input.itens.length === 0) throw new ErroRegra("Adicione pelo menos um produto.");
  const juntos = new Map<string, { quantidade: number; preco?: number }>();
  for (const i of input.itens) {
    if (!(i.quantidade > 0)) throw new ErroRegra("Quantidade inválida.");
    const atual = juntos.get(i.produtoId);
    juntos.set(i.produtoId, { quantidade: r2((atual?.quantidade ?? 0) + i.quantidade), preco: i.preco ?? atual?.preco });
  }
  const itens: VendaItem[] = [...juntos].map(([produtoId, i]) => {
    const p = porId(db.produtos, produtoId);
    if (!p) throw new ErroRegra("Produto não encontrado.");
    if (!p.ativo) throw new ErroRegra(`${p.nome} está desativado.`);
    if (i.quantidade > p.estoque) throw new ErroRegra(`Estoque de ${p.nome}: ${p.estoque} ${p.unidade}. Registre a entrada da mercadoria antes de vender.`);
    const preco = r2(i.preco ?? p.precoVenda);
    if (preco < 0) throw new ErroRegra("Preço inválido.");
    return { produtoId, nome: p.nome, quantidade: i.quantidade, preco };
  });
  const desconto = r2(input.desconto ?? 0);
  const { bruto, total } = totalDaVenda(db, { itens, desconto });
  if (desconto < 0 || desconto > bruto) throw new ErroRegra("O desconto não pode passar do valor da venda.");
  if (input.tutorId && !porId(db.tutores, input.tutorId)) throw new ErroRegra("Cliente não encontrado.");
  const atd = porId(db.atendimentos, input.atendimentoId);
  if (input.atendimentoId && !atd) throw new ErroRegra("Atendimento não encontrado.");
  if (!input.formaPagamento && !(input.tutorId || atd)) throw new ErroRegra("Venda a receber precisa do cliente.");

  const pago = !!input.formaPagamento;
  const tutorId = input.tutorId ?? atd?.tutorId;
  const tutor = porId(db.tutores, tutorId);
  const vendaId = uid();
  let lancamento: Lancamento | undefined;
  if (total > 0) {
    lancamento = {
      id: uid(),
      tipo: "receita",
      categoria: "Produtos",
      descricao: `${itens.map((i) => (i.quantidade === 1 ? i.nome : `${i.quantidade}× ${i.nome}`)).join(", ")}${tutor ? ` · ${tutor.nome.split(" ")[0]}` : ""}`,
      valor: total,
      formaPagamento: input.formaPagamento,
      status: pago ? "pago" : "pendente",
      competencia: dataDoIso(agora.toISOString()),
      criadoEm: agora.toISOString(),
      pagoEm: pago ? agora.toISOString() : undefined,
    };
  }
  const venda: Venda = {
    id: vendaId,
    tutorId,
    atendimentoId: atd?.id,
    itens,
    total,
    desconto,
    status: pago || total === 0 ? "pago" : "pendente",
    formaPagamento: input.formaPagamento,
    porMembroId: db.usuarioAtualId,
    lancamentoId: lancamento?.id,
    criadoEm: agora.toISOString(),
  };
  let novo: Db = { ...db, vendas: [...db.vendas, venda], lancamentos: lancamento ? [...db.lancamentos, lancamento] : db.lancamentos };
  for (const i of itens) {
    novo = aplicarMovimento(novo, { id: uid(), produtoId: i.produtoId!, tipo: "venda", quantidade: -i.quantidade, vendaId, porMembroId: db.usuarioAtualId, em: agora.toISOString() });
  }
  return { db: novo, venda, lancamento };
}

/**
 * Cancela a venda: os produtos voltam ao estoque; o valor a receber some e o já recebido
 * vira uma despesa de estorno (o caixa do dia da venda não muda).
 */
export function cancelarVenda(db: Db, vendaId: string, agora: Date): { db: Db; venda: Venda; estornos: MovimentoEstoque[]; removerLancamento?: string; despesa?: Lancamento } {
  const venda = porId(db.vendas, vendaId);
  if (!venda) throw new ErroRegra("Venda não encontrada.");
  if (venda.status === "cancelada") throw new ErroRegra("Esta venda já foi cancelada.");
  const lanc = porId(db.lancamentos, venda.lancamentoId);
  const estornos: MovimentoEstoque[] = venda.itens
    .filter((i) => i.produtoId && porId(db.produtos, i.produtoId))
    .map((i) => ({ id: uid(), produtoId: i.produtoId!, tipo: "estorno", quantidade: i.quantidade, vendaId: venda.id, observacao: "Venda cancelada", porMembroId: db.usuarioAtualId, em: agora.toISOString() }));
  let novo: Db = { ...db, vendas: db.vendas.map((v) => (v.id === venda.id ? { ...v, status: "cancelada" } : v)) };
  for (const m of estornos) novo = aplicarMovimento(novo, m);
  let removerLancamento: string | undefined;
  let despesa: Lancamento | undefined;
  if (lanc?.status === "pendente") {
    removerLancamento = lanc.id;
    novo = { ...novo, lancamentos: novo.lancamentos.filter((l) => l.id !== lanc.id) };
  } else if (lanc?.status === "pago") {
    despesa = {
      id: uid(),
      tipo: "despesa",
      categoria: "Devoluções",
      descricao: `Estorno de venda · ${venda.itens.map((i) => i.nome).join(", ")}`,
      valor: lanc.valor,
      formaPagamento: lanc.formaPagamento,
      status: "pago",
      competencia: dataDoIso(agora.toISOString()),
      criadoEm: agora.toISOString(),
      pagoEm: agora.toISOString(),
    };
    novo = { ...novo, lancamentos: [...novo.lancamentos, despesa] };
  }
  return { db: novo, venda: porId(novo.vendas, venda.id)!, estornos, removerLancamento, despesa };
}

export function produtosAbaixoDoMinimo(db: Db): Produto[] {
  return db.produtos.filter((p) => p.ativo && p.estoqueMinimo > 0 && p.estoque <= p.estoqueMinimo).sort((a, b) => a.estoque - b.estoque);
}

export function movimentosDoProduto(db: Db, produtoId: string): MovimentoEstoque[] {
  return db.movimentos.filter((m) => m.produtoId === produtoId).sort((a, b) => (a.em < b.em ? 1 : -1));
}

export function vendasDoAtendimento(db: Db, atendimentoId: string): Venda[] {
  return db.vendas.filter((v) => v.atendimentoId === atendimentoId && v.status !== "cancelada");
}

export const NOME_MOVIMENTO: Record<MovimentoEstoque["tipo"], string> = {
  entrada: "Entrada",
  venda: "Venda",
  ajuste: "Ajuste",
  estorno: "Devolução",
};

/** Margem sobre o preço de venda, em %. */
export function margem(p: Pick<Produto, "precoVenda" | "custo">): number | undefined {
  if (p.custo === undefined || p.precoVenda <= 0) return undefined;
  return Math.round(((p.precoVenda - p.custo) / p.precoVenda) * 100);
}
