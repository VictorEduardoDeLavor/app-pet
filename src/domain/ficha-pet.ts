import type { Pet } from "./types";
import { SEM_RACA, normalizarRaca, semAcento } from "./racas";

/** Opções de toque da ficha do pet. Qualquer outra resposta continua valendo como texto ("Outra"). */
export const PELAGENS = ["Curta", "Média", "Longa"] as const;
export const TEMPERAMENTOS = ["Tranquilo", "Agitado", "Medroso", "Bravo"] as const;

/** Guardado em `alergias` quando a resposta é "Não tem alergia". */
export const SEM_ALERGIA = "Nenhuma";
/** Guardado quando marcaram "Sim" sem dizer a quê. */
export const ALERGIA_SEM_DETALHE = "Sim";

const NEGATIVAS = new Set(["nenhuma", "nenhum", "nao", "n", "nao tem", "sem alergia", "sem", "-", "--", "nada", "nao possui", "negativo"]);
const POSITIVAS_SEM_DETALHE = new Set(["sim", "s", "tem", "possui", "positivo"]);

/** Converte o que foi digitado (ou importado) para o formato da ficha. */
export function normalizarAlergia(texto: string | undefined): string | undefined {
  const t = (texto ?? "").trim();
  if (!t) return undefined;
  const k = semAcento(t).replace(/[.!]+$/, "");
  if (NEGATIVAS.has(k)) return SEM_ALERGIA;
  if (POSITIVAS_SEM_DETALHE.has(k)) return ALERGIA_SEM_DETALHE;
  return t;
}

/** O pet tem alguma alergia registrada (e não só "Nenhuma")? */
export function temAlergia(p: Pick<Pet, "alergias">): boolean {
  const a = normalizarAlergia(p.alergias);
  return !!a && a !== SEM_ALERGIA;
}

/** Frase do aviso: "Alergia a perfume" ou "Tem alergia" quando não disseram a quê. */
export function tituloAlergia(p: Pick<Pet, "alergias">): string | undefined {
  if (!temAlergia(p)) return undefined;
  const a = normalizarAlergia(p.alergias)!;
  return a === ALERGIA_SEM_DETALHE ? "Tem alergia (confirme com o tutor)" : `Alergia a ${a}`;
}

/** Temperamento que pede cuidado ao manusear. */
export function ehBravo(p: Pick<Pet, "temperamento">): boolean {
  return /brav|morde|agress|ataca/i.test(semAcento(p.temperamento ?? ""));
}

/** Alergia, cuidado especial ou pet bravo: o que entra no filtro "Com alerta" e nos selos. */
export function temAlerta(p: Pick<Pet, "alergias" | "cuidados" | "temperamento">): boolean {
  return temAlergia(p) || !!p.cuidados?.trim() || ehBravo(p);
}

/** Texto vazio vira `undefined`; espaços nas pontas saem. */
function limpo(t: string | undefined): string | undefined {
  const v = (t ?? "").trim();
  return v ? v : undefined;
}

/** Arruma a ficha antes de gravar: raça da lista, alergia padronizada, campos vazios sem lixo. */
export function normalizarFicha<T extends Pick<Pet, "raca" | "especie" | "pelagem" | "temperamento" | "alergias" | "cuidados">>(p: T): T {
  return {
    ...p,
    raca: normalizarRaca(p.raca, p.especie) || SEM_RACA,
    pelagem: limpo(p.pelagem),
    temperamento: limpo(p.temperamento),
    alergias: normalizarAlergia(p.alergias),
    cuidados: limpo(p.cuidados),
  };
}

/** Título e texto do aviso amarelo do pet (alergia, pet bravo, cuidado especial), ou nada. */
export function avisoDoPet(p: Pick<Pet, "alergias" | "cuidados" | "temperamento">): { titulo: string; texto?: string } | undefined {
  if (!temAlerta(p)) return undefined;
  const partes = [tituloAlergia(p), ehBravo(p) ? "Bravo: cuidado ao manusear" : undefined].filter((x): x is string => !!x);
  return { titulo: partes.length ? partes.join(" · ") : "Cuidado especial", texto: p.cuidados?.trim() || undefined };
}

/** Selos curtos para listas: "Alergia: perfume", "Bravo", "Cuidado especial". */
export function selosDoPet(p: Pick<Pet, "alergias" | "cuidados" | "temperamento">): string[] {
  const selos: string[] = [];
  if (temAlergia(p)) {
    const a = normalizarAlergia(p.alergias)!;
    selos.push(a === ALERGIA_SEM_DETALHE ? "Alergia" : `Alergia: ${a}`);
  }
  if (ehBravo(p)) selos.push("Bravo");
  if (p.cuidados?.trim()) selos.push("Cuidado especial");
  return selos;
}
