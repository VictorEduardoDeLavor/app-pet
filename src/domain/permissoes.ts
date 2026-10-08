// Quem vê o quê. Espelha o RLS do Supabase:
//  - dono: tudo
//  - recepção: operação e dinheiro, sem equipe e sem configurações do pet shop
//  - banhista/tosador: só a própria fila, a ficha dos pets e o andamento do atendimento
// A tela esconde o que o papel não usa; o banco recusa o que o papel não pode.

import type { Papel, StatusAtendimento } from "./types";
import { TRANSICOES } from "./rules";

export type Area =
  | "inicio"
  | "fila"
  | "agenda"
  | "clientes"
  | "mensagens"
  | "financeiro"
  | "planos"
  | "servicos"
  | "produtos"
  | "equipe"
  | "configuracoes";

const AREAS: Record<Papel, Area[]> = {
  dono: ["inicio", "fila", "agenda", "clientes", "mensagens", "financeiro", "planos", "servicos", "produtos", "equipe", "configuracoes"],
  recepcao: ["inicio", "agenda", "clientes", "mensagens", "financeiro", "planos", "servicos", "produtos"],
  banhista: ["fila"],
};

export const NOME_PAPEL: Record<Papel, string> = {
  dono: "Dono",
  recepcao: "Recepção",
  banhista: "Banhista / tosador",
};

export const NOME_PAPEL_CURTO: Record<Papel, string> = {
  dono: "Dono",
  recepcao: "Recepção",
  banhista: "Banhista",
};

export function pode(papel: Papel, area: Area): boolean {
  return AREAS[papel].includes(area);
}

/** Tela inicial de cada papel. */
export function inicioDoPapel(papel: Papel): string {
  return papel === "banhista" ? "/fila" : "/";
}

/** Área de cada rota. Rotas sem área (ficha do pet, atendimento, Mais) ficam abertas a todos. */
function areaDaRota(caminho: string): Area | null {
  if (caminho === "/") return "inicio";
  const mapa: [string, Area][] = [
    ["/fila", "fila"],
    ["/agenda", "agenda"],
    ["/clientes", "clientes"],
    ["/mensagens", "mensagens"],
    ["/financeiro", "financeiro"],
    ["/planos", "planos"],
    ["/servicos", "servicos"],
    ["/produtos", "produtos"],
    ["/equipe", "equipe"],
  ];
  return mapa.find(([prefixo]) => caminho === prefixo || caminho.startsWith(prefixo + "/"))?.[1] ?? null;
}

export function rotaPermitida(papel: Papel, caminho: string): boolean {
  const area = areaDaRota(caminho);
  return area === null || pode(papel, area);
}

/** Mudanças de status que cada papel pode fazer. O banhista só inicia e finaliza. */
export function transicoesDoPapel(papel: Papel, de: StatusAtendimento): StatusAtendimento[] {
  const todas = TRANSICOES[de];
  if (papel !== "banhista") return todas;
  return todas.filter((s) => s === "em_atendimento" || s === "finalizado");
}
