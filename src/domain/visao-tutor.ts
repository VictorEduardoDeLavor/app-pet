// O que o tutor vê pelo link de acompanhamento, montado do Db (demonstração) ou do banco (link real).

import type { Db, Especie, Etapa, StatusAtendimento, Transporte } from "./types";
import { emRota, etapasDoAtendimento, porId, posicaoDoAtendimento } from "./rules";
import { montarLinhaDoTempo, type ItemLinha } from "./linha-tempo";
import { dataLonga } from "./format";

export interface VisaoTutor {
  petshop: { nome: string; whatsapp?: string; fuso?: string };
  pet: { nome: string; raca?: string; especie: Especie; fotoUrl?: string };
  tutorNome: string;
  atendimento: {
    status: StatusAtendimento;
    data: string; // YYYY-MM-DD no fuso do pet shop
    hora: string; // HH:MM
    itens: string[];
    transporte: Transporte;
    endereco?: string;
    motorista?: string;
  };
  eventos: { para: StatusAtendimento; em: string }[];
  etapas: { id: string; etapa: Etapa; nota?: string; fotoUrl?: string; em: string }[];
  emRota: boolean;
  posicao?: { lat: number; lng: number; precisao?: number; em: string };
}

export function visaoDoDb(db: Db, token: string): VisaoTutor | null {
  const a = db.atendimentos.find((x) => x.token === token);
  if (!a) return null;
  const pet = porId(db.pets, a.petId);
  const tutor = porId(db.tutores, a.tutorId);
  const pos = posicaoDoAtendimento(db, a.id);
  const rota = emRota(db, a.id);
  return {
    petshop: { nome: db.petshop.nome, whatsapp: db.petshop.whatsapp },
    pet: { nome: pet?.nome ?? "Seu pet", raca: pet?.raca, especie: pet?.especie ?? "cao", fotoUrl: pet?.fotoUrl },
    tutorNome: tutor?.nome ?? "",
    atendimento: {
      status: a.status,
      data: a.data,
      hora: a.hora,
      itens: a.itens.map((i) => i.nome),
      transporte: a.transporte,
      endereco: a.enderecoTransporte,
      motorista: porId(db.membros, a.motoristaId)?.nome,
    },
    eventos: a.eventos.map((e) => ({ para: e.para, em: e.em })),
    etapas: etapasDoAtendimento(db, a.id).map((e) => ({ id: e.id, etapa: e.etapa, nota: e.nota, fotoUrl: e.fotoUrl, em: e.em })),
    emRota: rota,
    posicao: rota && pos ? { lat: pos.lat, lng: pos.lng, precisao: pos.precisao, em: pos.em } : undefined,
  };
}

export function linhaDoTutor(v: VisaoTutor): ItemLinha[] {
  return montarLinhaDoTempo(v.eventos, v.etapas, v.pet.nome);
}

export interface Passo {
  rotulo: string;
  feito: boolean;
}

/** A barra de progresso do topo: do "buscando" ao "em casa", conforme o leva e traz contratado. */
export function passosDoTutor(v: VisaoTutor): Passo[] {
  const feitas = new Set(v.etapas.map((e) => e.etapa));
  const status = new Set(v.eventos.map((e) => e.para));
  const t = v.atendimento.transporte;
  const busca = t === "busca" || t === "busca_e_entrega";
  const entrega = t === "entrega" || t === "busca_e_entrega";
  const passos: Passo[] = [];
  if (busca) passos.push({ rotulo: "Buscando", feito: feitas.has("saiu_para_buscar") });
  passos.push({ rotulo: "No pet shop", feito: feitas.has("chegou") });
  passos.push({ rotulo: "Banho", feito: feitas.has("banho") || feitas.has("secagem") || feitas.has("tosa") || status.has("em_atendimento") });
  passos.push({ rotulo: "Pronto", feito: feitas.has("pronto") || status.has("finalizado") });
  if (entrega) {
    passos.push({ rotulo: "Voltando", feito: feitas.has("saiu_para_entregar") });
    passos.push({ rotulo: "Em casa", feito: feitas.has("entregue") });
  }
  // Se um passo adiante aconteceu, os anteriores também.
  for (let i = passos.length - 2; i >= 0; i--) if (passos[i + 1].feito) passos[i].feito = true;
  return passos;
}

/** Frase grande do topo. */
export function fraseAtual(v: VisaoTutor, linha: ItemLinha[]): string {
  if (v.atendimento.status === "cancelado") return `O horário de ${v.pet.nome} foi cancelado`;
  if (v.atendimento.status === "faltou") return `${v.pet.nome} não veio hoje`;
  const ultimo = linha.at(-1);
  if (!ultimo || (ultimo.icone === "agendado" || ultimo.icone === "confirmado")) {
    return `${v.pet.nome} tem horário ${dataLonga(v.atendimento.data).toLowerCase()} às ${v.atendimento.hora}`;
  }
  return ultimo.frase;
}

/**
 * Demonstração: faz o carro andar um pouco a cada atualização, para mostrar o mapa ao vivo
 * sem precisar de um motorista de verdade na rua.
 */
export function posicaoSimulada(base: { lat: number; lng: number; precisao?: number; em: string }, agora: number) {
  const s = Math.max(0, (agora - Date.parse(base.em)) / 1000) % 300;
  const ida = s < 150 ? s : 300 - s; // vai e volta em 5 minutos
  return { lat: base.lat + ida * 0.000011, lng: base.lng + ida * 0.000008, precisao: base.precisao, em: new Date(agora).toISOString() };
}
