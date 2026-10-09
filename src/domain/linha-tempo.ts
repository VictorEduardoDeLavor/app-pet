// A linha do tempo de um atendimento: junta as trocas de status com as etapas registradas pela equipe.
// É o que a ficha do atendimento mostra para a equipe e o que o tutor vê pelo link.

import type { AtendimentoEtapa, AtendimentoEvento, Etapa, StatusAtendimento } from "./types";
import { NOME_ETAPA, fraseEtapa } from "./rules";

export type IconeLinha = Etapa | StatusAtendimento;

export interface ItemLinha {
  id: string;
  em: string; // ISO
  icone: IconeLinha;
  titulo: string;
  /** Frase para o tutor ("Thor está no banho"). */
  frase: string;
  nota?: string;
  fotoUrl?: string;
  destaque?: boolean;
}

const TITULO_STATUS: Record<StatusAtendimento, string> = {
  agendado: "Agendado",
  confirmado: "Horário confirmado",
  em_atendimento: "Atendimento começou",
  finalizado: "Atendimento concluído",
  cancelado: "Agendamento cancelado",
  faltou: "Não compareceu",
};

function fraseStatus(status: StatusAtendimento, pet: string): string {
  switch (status) {
    case "agendado": return `Horário de ${pet} agendado`;
    case "confirmado": return `Horário de ${pet} confirmado`;
    case "em_atendimento": return `${pet} começou a ser atendido`;
    case "finalizado": return `${pet} terminou tudo`;
    case "cancelado": return `O horário de ${pet} foi cancelado`;
    case "faltou": return `${pet} não veio`;
  }
}

export function montarLinhaDoTempo(
  eventos: Pick<AtendimentoEvento, "para" | "em">[],
  etapas: Pick<AtendimentoEtapa, "id" | "etapa" | "em" | "nota" | "fotoUrl">[],
  petNome: string,
): ItemLinha[] {
  const temPronto = etapas.some((e) => e.etapa === "pronto");
  const temChegou = etapas.some((e) => e.etapa === "chegou");
  const itens: ItemLinha[] = [];
  eventos.forEach((e, i) => {
    // "Concluído" e "Pronto!" dizem a mesma coisa; a etapa (com foto) ganha. O mesmo para "começou" x "chegou".
    if (e.para === "finalizado" && temPronto) return;
    if (e.para === "em_atendimento" && temChegou) return;
    itens.push({ id: `ev_${i}`, em: e.em, icone: e.para, titulo: TITULO_STATUS[e.para], frase: fraseStatus(e.para, petNome) });
  });
  for (const e of etapas) {
    itens.push({ id: e.id, em: e.em, icone: e.etapa, titulo: NOME_ETAPA[e.etapa], frase: fraseEtapa(e.etapa, petNome), nota: e.nota, fotoUrl: e.fotoUrl, destaque: !!e.fotoUrl });
  }
  return itens.sort((a, b) => (a.em < b.em ? -1 : a.em > b.em ? 1 : 0));
}

/** O momento atual, para o título da página do tutor. */
export function momentoAtual(itens: ItemLinha[]): ItemLinha | undefined {
  return itens.at(-1);
}
