// Carteira de saúde do pet: vacinas, vermífugo e antipulgas, com aviso de vencimento pelo WhatsApp.

import type { Db, Vacina, TipoVacina } from "./types";
import { ErroRegra, porId, uid } from "./rules";
import { dataCurta, diferencaDias, somaDias } from "./format";

export const NOME_TIPO_VACINA: Record<TipoVacina, string> = {
  vacina: "Vacina",
  vermifugo: "Vermífugo",
  antipulgas: "Antipulgas",
  outro: "Outro",
};

/** Sugestões para o campo nome, com o intervalo usual até a próxima dose (dias). */
export const SUGESTOES_VACINA: { nome: string; tipo: TipoVacina; dias: number }[] = [
  { nome: "V10 (polivalente)", tipo: "vacina", dias: 365 },
  { nome: "V8 (polivalente)", tipo: "vacina", dias: 365 },
  { nome: "Antirrábica", tipo: "vacina", dias: 365 },
  { nome: "Gripe canina", tipo: "vacina", dias: 365 },
  { nome: "Giárdia", tipo: "vacina", dias: 365 },
  { nome: "V4/V5 felina", tipo: "vacina", dias: 365 },
  { nome: "Vermífugo", tipo: "vermifugo", dias: 90 },
  { nome: "Antipulgas", tipo: "antipulgas", dias: 30 },
];

export type VacinaInput = Omit<Vacina, "id"> & { id?: string };

export function salvarVacina(db: Db, input: VacinaInput): { db: Db; vacina: Vacina; novo: boolean } {
  if (!porId(db.pets, input.petId)) throw new ErroRegra("Pet não encontrado.");
  const nome = input.nome.trim().replace(/\s+/g, " ");
  if (nome.length < 2) throw new ErroRegra("Informe o nome da vacina ou do remédio.");
  if (!input.aplicadaEm && !input.proximaEm) throw new ErroRegra("Informe quando foi aplicada ou quando vence.");
  if (input.aplicadaEm && input.proximaEm && input.proximaEm < input.aplicadaEm) throw new ErroRegra("O vencimento não pode ser antes da aplicação.");
  const vacina: Vacina = {
    id: input.id ?? uid(),
    petId: input.petId,
    tipo: input.tipo,
    nome,
    aplicadaEm: input.aplicadaEm || undefined,
    proximaEm: input.proximaEm || undefined,
    observacao: input.observacao?.trim() || undefined,
  };
  const novo = !input.id || !porId(db.vacinas, input.id);
  return { db: { ...db, vacinas: novo ? [...db.vacinas, vacina] : db.vacinas.map((v) => (v.id === vacina.id ? vacina : v)) }, vacina, novo };
}

export function excluirVacina(db: Db, id: string): Db {
  if (!porId(db.vacinas, id)) throw new ErroRegra("Registro não encontrado.");
  return { ...db, vacinas: db.vacinas.filter((v) => v.id !== id) };
}

/** Próximo vencimento sugerido a partir da aplicação. */
export function proximaSugerida(nome: string, aplicadaEm: string): string | undefined {
  const s = SUGESTOES_VACINA.find((x) => x.nome.toLowerCase() === nome.trim().toLowerCase());
  return s && aplicadaEm ? somaDias(aplicadaEm, s.dias) : undefined;
}

export function vacinasDoPet(db: Db, petId: string): Vacina[] {
  return db.vacinas
    .filter((v) => v.petId === petId)
    .sort((a, b) => ((b.aplicadaEm ?? b.proximaEm ?? "") < (a.aplicadaEm ?? a.proximaEm ?? "") ? -1 : 1));
}

/** Registro que vale para cada pet + nome: o de vencimento mais recente (doses antigas ficam no histórico). */
function atuais(db: Db): Vacina[] {
  const porChave = new Map<string, Vacina>();
  for (const v of db.vacinas) {
    if (!v.proximaEm) continue;
    const k = `${v.petId}|${v.nome.toLowerCase()}`;
    const atual = porChave.get(k);
    if (!atual || (atual.proximaEm ?? "") < v.proximaEm) porChave.set(k, v);
  }
  return [...porChave.values()];
}

export type SituacaoVacina = "vencida" | "vence_logo" | "em_dia" | "sem_data";

export function situacao(v: Vacina, ref: string, dias = 15): SituacaoVacina {
  if (!v.proximaEm) return "sem_data";
  if (v.proximaEm < ref) return "vencida";
  if (diferencaDias(ref, v.proximaEm) <= dias) return "vence_logo";
  return "em_dia";
}

/** Vacinas vencidas há até 60 dias ou que vencem nos próximos N dias, das mais urgentes para as menos. */
export function vacinasVencendo(db: Db, ref: string, dias = 15): Vacina[] {
  const pets = new Set(db.pets.map((p) => p.id));
  return atuais(db)
    .filter((v) => pets.has(v.petId) && v.proximaEm! <= somaDias(ref, dias) && v.proximaEm! >= somaDias(ref, -60))
    .sort((a, b) => (a.proximaEm! < b.proximaEm! ? -1 : 1));
}

/** Texto da variável {vencimento}: "hoje", "amanhã", "em 12/10" ou "desde 03/10". */
export function textoVencimento(proximaEm: string, ref: string): string {
  const d = diferencaDias(ref, proximaEm);
  if (d === 0) return "hoje";
  if (d === 1) return "amanhã";
  if (d < 0) return `desde ${dataCurta(proximaEm).slice(0, 5)}`;
  return `em ${dataCurta(proximaEm).slice(0, 5)}`;
}

/** Já mandou o lembrete desta vacina (envio do modelo "vacina" para o tutor depois de 30 dias antes do vencimento)? */
export function lembreteEnviado(db: Db, v: Vacina): boolean {
  const pet = porId(db.pets, v.petId);
  const modelos = new Set(db.mensagemModelos.filter((m) => m.gatilho === "vacina").map((m) => m.id));
  if (!pet || !v.proximaEm) return false;
  const desde = somaDias(v.proximaEm, -30);
  return db.mensagensEnvios.some((e) => e.tutorId === pet.tutorId && modelos.has(e.modeloId) && e.enviadoEm.slice(0, 10) >= desde);
}
