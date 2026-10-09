// Cartão fidelidade: cada atendimento finalizado com um serviço que conta vira um selo;
// ao completar a meta, o pet ganha o prêmio (desconto no próximo atendimento). Mesma conta da função
// fidelidade_selos() do banco.

import type { Atendimento, Db, ResgateFidelidade, Servico } from "./types";
import { ErroRegra, porId, uid } from "./rules";
import { dataDoIso } from "./format";

export function servicosQueContam(db: Db): Servico[] {
  const escolhidos = db.petshop.fidelidadeServicoIds;
  return db.servicos.filter((s) => (escolhidos.length > 0 ? escolhidos.includes(s.id) : s.categoria === "banho" || s.categoria === "tosa"));
}

function contaSelo(db: Db, a: Atendimento, contam: Set<string>): boolean {
  return a.itens.some((i) => !i.cobertoPorPlano && contam.has(i.servicoId));
}

export function ultimoResgate(db: Db, petId: string): ResgateFidelidade | undefined {
  return db.resgates.filter((r) => r.petId === petId).sort((a, b) => (a.em < b.em ? -1 : 1)).at(-1);
}

/** Atendimentos que contam selo no cartão atual do pet (desde o último prêmio). */
export function atendimentosComSelo(db: Db, petId: string): Atendimento[] {
  const contam = new Set(servicosQueContam(db).map((s) => s.id));
  const resgatados = new Set(db.resgates.map((r) => r.atendimentoId).filter(Boolean));
  const ultimo = ultimoResgate(db, petId);
  const desde = ultimo ? dataDoIso(ultimo.em) : "";
  return db.atendimentos
    .filter((a) => a.petId === petId && a.status === "finalizado" && !resgatados.has(a.id) && a.data >= desde && contaSelo(db, a, contam))
    .sort((a, b) => (a.data + a.hora < b.data + b.hora ? -1 : 1));
}

export function selos(db: Db, petId: string): number {
  return atendimentosComSelo(db, petId).length;
}

export interface CartaoFidelidade {
  ativo: boolean;
  meta: number;
  selos: number;
  premio: string;
  /** Selos de sobra contam para o próximo cartão. */
  completo: boolean;
  faltam: number;
}

export function cartao(db: Db, petId: string): CartaoFidelidade {
  const ps = db.petshop;
  const s = selos(db, petId);
  return { ativo: ps.fidelidadeAtiva, meta: ps.fidelidadeMeta, selos: s, premio: ps.fidelidadePremio, completo: s >= ps.fidelidadeMeta, faltam: Math.max(0, ps.fidelidadeMeta - s) };
}

export function resgateDoAtendimento(db: Db, atendimentoId: string): ResgateFidelidade | undefined {
  return db.resgates.find((r) => r.atendimentoId === atendimentoId);
}

/** Valor do prêmio neste atendimento: o serviço que conta selo mais caro, sem passar do que seria cobrado. */
export function valorDoPremio(db: Db, atd: Atendimento): number {
  const contam = new Set(servicosQueContam(db).map((s) => s.id));
  const elegiveis = atd.itens.filter((i) => !i.cobertoPorPlano && contam.has(i.servicoId));
  const maior = Math.max(0, ...elegiveis.map((i) => i.preco));
  return Math.min(maior, atd.valorTotal);
}

/** Usa o prêmio do cartão completo como desconto neste atendimento. */
export function resgatar(db: Db, atendimentoId: string, agora: Date): { db: Db; resgate: ResgateFidelidade; atendimento: Atendimento } {
  const atd = porId(db.atendimentos, atendimentoId);
  if (!atd) throw new ErroRegra("Atendimento não encontrado.");
  if (!db.petshop.fidelidadeAtiva) throw new ErroRegra("O cartão fidelidade está desligado.");
  if (!["agendado", "confirmado", "em_atendimento"].includes(atd.status)) throw new ErroRegra("Use o prêmio antes de finalizar o atendimento.");
  if (resgateDoAtendimento(db, atd.id)) throw new ErroRegra("O prêmio já foi usado neste atendimento.");
  if (selos(db, atd.petId) < db.petshop.fidelidadeMeta) throw new ErroRegra("O cartão ainda não está completo.");
  const valor = valorDoPremio(db, atd);
  if (valor <= 0) throw new ErroRegra("Este atendimento não tem serviço que vale o prêmio (ou já está coberto pelo plano).");
  const resgate: ResgateFidelidade = { id: uid(), petId: atd.petId, atendimentoId: atd.id, valor, em: agora.toISOString() };
  const atualizado: Atendimento = { ...atd, desconto: Math.round((atd.desconto + valor) * 100) / 100, valorTotal: Math.round((atd.valorTotal - valor) * 100) / 100 };
  return {
    db: { ...db, resgates: [...db.resgates, resgate], atendimentos: db.atendimentos.map((a) => (a.id === atd.id ? atualizado : a)) },
    resgate,
    atendimento: atualizado,
  };
}

export function desfazerResgate(db: Db, atendimentoId: string): { db: Db; atendimento: Atendimento } {
  const atd = porId(db.atendimentos, atendimentoId);
  const r = resgateDoAtendimento(db, atendimentoId);
  if (!atd || !r) throw new ErroRegra("Nenhum prêmio usado neste atendimento.");
  if (!["agendado", "confirmado", "em_atendimento"].includes(atd.status)) throw new ErroRegra("Atendimento encerrado.");
  const atualizado: Atendimento = {
    ...atd,
    desconto: Math.max(0, Math.round((atd.desconto - r.valor) * 100) / 100),
    valorTotal: Math.round((atd.valorTotal + Math.min(r.valor, atd.desconto)) * 100) / 100,
  };
  return {
    db: { ...db, resgates: db.resgates.filter((x) => x.id !== r.id), atendimentos: db.atendimentos.map((a) => (a.id === atd.id ? atualizado : a)) },
    atendimento: atualizado,
  };
}

/** Pets com cartão completo esperando o prêmio (para a recepção lembrar). */
export function petsComPremio(db: Db): { petId: string; selos: number }[] {
  if (!db.petshop.fidelidadeAtiva) return [];
  return db.pets.map((p) => ({ petId: p.id, selos: selos(db, p.id) })).filter((x) => x.selos >= db.petshop.fidelidadeMeta);
}
