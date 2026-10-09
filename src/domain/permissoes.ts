// Quem vê o quê. Espelha o RLS do Supabase:
//  - dono: tudo
//  - recepção: operação e dinheiro, sem equipe, comissões e configurações do pet shop
//  - banhista/tosador: só a própria fila, a ficha dos pets e o andamento do atendimento
//  - motorista: só as rotas do leva e traz (endereços, telefones e as etapas de transporte)
// A tela esconde o que o papel não usa; o banco recusa o que o papel não pode.

import type { Papel, StatusAtendimento } from "./types";
import { TRANSICOES } from "./rules";

export type Area =
  | "inicio"
  | "fila"
  | "rotas"
  | "agenda"
  | "clientes"
  | "mensagens"
  | "financeiro"
  | "relatorios"
  | "comissoes"
  | "planos"
  | "servicos"
  | "produtos"
  | "equipe"
  | "assinatura"
  | "configuracoes";

const AREAS: Record<Papel, Area[]> = {
  dono: ["inicio", "fila", "rotas", "agenda", "clientes", "mensagens", "financeiro", "relatorios", "comissoes", "planos", "servicos", "produtos", "equipe", "assinatura", "configuracoes"],
  recepcao: ["inicio", "rotas", "agenda", "clientes", "mensagens", "financeiro", "relatorios", "planos", "servicos", "produtos"],
  banhista: ["fila"],
  motorista: ["rotas"],
};

export const NOME_PAPEL: Record<Papel, string> = {
  dono: "Dono",
  recepcao: "Recepção",
  banhista: "Banhista / tosador",
  motorista: "Motorista",
};

export const NOME_PAPEL_CURTO: Record<Papel, string> = {
  dono: "Dono",
  recepcao: "Recepção",
  banhista: "Banhista",
  motorista: "Motorista",
};

export function pode(papel: Papel, area: Area): boolean {
  return AREAS[papel].includes(area);
}

/** Tela inicial de cada papel. */
export function inicioDoPapel(papel: Papel): string {
  if (papel === "banhista") return "/fila";
  if (papel === "motorista") return "/rotas";
  return "/";
}

/** Área de cada rota. Rotas sem área (ficha do pet, atendimento, Mais) ficam abertas a todos. */
function areaDaRota(caminho: string): Area | null {
  if (caminho === "/") return "inicio";
  const mapa: [string, Area][] = [
    ["/fila", "fila"],
    ["/rotas", "rotas"],
    ["/agenda", "agenda"],
    ["/clientes", "clientes"],
    ["/mensagens", "mensagens"],
    ["/financeiro", "financeiro"],
    ["/relatorios", "relatorios"],
    ["/comissoes", "comissoes"],
    ["/planos", "planos"],
    ["/servicos", "servicos"],
    ["/produtos", "produtos"],
    ["/equipe", "equipe"],
    ["/assinatura", "assinatura"],
    ["/configuracoes", "configuracoes"],
  ];
  return mapa.find(([prefixo]) => caminho === prefixo || caminho.startsWith(prefixo + "/"))?.[1] ?? null;
}

export function rotaPermitida(papel: Papel, caminho: string): boolean {
  const area = areaDaRota(caminho);
  return area === null || pode(papel, area);
}

/** Mudanças de status que cada papel pode fazer. O banhista só inicia e finaliza; o motorista não mexe no status. */
export function transicoesDoPapel(papel: Papel, de: StatusAtendimento): StatusAtendimento[] {
  const todas = TRANSICOES[de];
  if (papel === "motorista") return [];
  if (papel !== "banhista") return todas;
  return todas.filter((s) => s === "em_atendimento" || s === "finalizado");
}

/** Quem registra as etapas do banho (chegou, banho, secagem, tosa, pronto). */
export function registraEtapasDoBanho(papel: Papel): boolean {
  return papel !== "motorista";
}
