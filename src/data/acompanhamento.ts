"use client";

// Link do tutor no modo nuvem: uma única chamada ao banco (RPC "acompanhamento"), liberada sem login.
// O token de 32 caracteres aleatórios é a chave; sem ele não se lê nada.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Especie, Etapa, StatusAtendimento, Transporte } from "@/domain/types";
import type { VisaoTutor } from "@/domain/visao-tutor";
import { urlPublica } from "@/lib/fotos";
import { FUSO_PADRAO, partesNoFuso } from "./cloud";

interface Resposta {
  petshop: { nome: string; whatsapp: string | null; fuso: string | null };
  pet: { nome: string; raca: string | null; especie: Especie; foto_path: string | null };
  tutor: { nome: string };
  atendimento: { inicio: string; status: StatusAtendimento; transporte: Transporte; endereco: string | null; motorista: string | null; itens: string[] };
  eventos: { para: StatusAtendimento; em: string }[];
  etapas: { id: string; etapa: Etapa; nota: string | null; foto_path: string | null; em: string }[];
  em_rota: boolean;
  posicao: { lat: number; lng: number; precisao: number | null; em: string } | null;
}

export async function buscarAcompanhamento(sb: SupabaseClient, token: string): Promise<VisaoTutor | null> {
  const { data, error } = await sb.rpc("acompanhamento", { p_token: token });
  if (error) throw new Error(error.message);
  if (!data) return null;
  const r = data as Resposta;
  const fuso = r.petshop.fuso || FUSO_PADRAO;
  const { data: dia, hora } = partesNoFuso(r.atendimento.inicio, fuso);
  const foto = (p: string | null) => (p ? urlPublica(sb, p) : undefined);
  return {
    petshop: { nome: r.petshop.nome, whatsapp: r.petshop.whatsapp ?? undefined, fuso },
    pet: { nome: r.pet.nome, raca: r.pet.raca ?? undefined, especie: r.pet.especie, fotoUrl: foto(r.pet.foto_path) },
    tutorNome: r.tutor.nome,
    atendimento: {
      status: r.atendimento.status,
      data: dia,
      hora,
      itens: r.atendimento.itens,
      transporte: r.atendimento.transporte,
      endereco: r.atendimento.endereco ?? undefined,
      motorista: r.atendimento.motorista ?? undefined,
    },
    eventos: r.eventos,
    etapas: r.etapas.map((e) => ({ id: e.id, etapa: e.etapa, nota: e.nota ?? undefined, fotoUrl: foto(e.foto_path), em: e.em })),
    emRota: r.em_rota,
    posicao: r.posicao ? { lat: r.posicao.lat, lng: r.posicao.lng, precisao: r.posicao.precisao ?? undefined, em: r.posicao.em } : undefined,
  };
}
