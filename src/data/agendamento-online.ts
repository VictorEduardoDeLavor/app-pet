"use client";

// Página pública de agendamento no modo nuvem: duas funções do banco liberadas sem login.
// agenda_publica(slug) traz serviços, funcionamento e horários ocupados (sem nomes);
// agendar_online(slug, pedido) revalida tudo e grava o atendimento com origem "portal".

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Porte } from "@/domain/types";
import type { AgendaPublica, Confirmacao, PedidoOnline, ServicoPublico } from "@/domain/agendamento-online";
import { minutos } from "@/domain/format";
import { FUSO_PADRAO, partesNoFuso } from "./cloud";

interface Resposta {
  petshop: { nome: string; whatsapp: string | null; endereco: string | null; fuso: string | null; dias_abertos: number[]; abre: string; fecha: string; sinal_pct: number };
  servicos: { id: string; nome: string; categoria: ServicoPublico["categoria"]; precos: Partial<Record<Porte, { preco: number; duracao: number }>> | null }[];
  equipe: string[];
  ocupados: { p: string; i: string; f: string }[];
}

export async function buscarAgenda(sb: SupabaseClient, slug: string): Promise<AgendaPublica | null> {
  const { data, error } = await sb.rpc("agenda_publica", { p_slug: slug, p_dias: 60 });
  if (error) throw new Error(error.message);
  if (!data) return null;
  const r = data as Resposta;
  const fuso = r.petshop.fuso || FUSO_PADRAO;
  return {
    petshop: {
      nome: r.petshop.nome,
      whatsapp: r.petshop.whatsapp ?? undefined,
      endereco: r.petshop.endereco ?? undefined,
      diasAbertos: r.petshop.dias_abertos ?? [],
      abre: r.petshop.abre,
      fecha: r.petshop.fecha,
      sinalPct: Number(r.petshop.sinal_pct) || 0,
    },
    servicos: r.servicos.map((s) => ({
      id: s.id,
      nome: s.nome,
      categoria: s.categoria,
      precos: Object.fromEntries(Object.entries(s.precos ?? {}).map(([k, v]) => [k, { preco: Number(v.preco), duracao: Number(v.duracao) }])),
    })),
    equipe: r.equipe,
    ocupados: r.ocupados.map((o) => {
      const ini = partesNoFuso(o.i, fuso);
      const dur = Math.round((Date.parse(o.f) - Date.parse(o.i)) / 60000);
      const m = minutos(ini.hora);
      return { p: o.p, data: ini.data, ini: m, fim: m + dur };
    }),
  };
}

export async function agendarNaNuvem(sb: SupabaseClient, slug: string, p: PedidoOnline): Promise<Confirmacao> {
  const { data, error } = await sb.rpc("agendar_online", {
    p_slug: slug,
    p: {
      nome: p.nome,
      whatsapp: p.whatsapp,
      pet: p.pet,
      especie: p.especie,
      raca: p.raca ?? "",
      porte: p.porte,
      servicos: p.servicos,
      data: p.data,
      hora: p.hora,
      observacoes: p.observacoes ?? "",
      aceite: p.aceite,
    },
  });
  if (error) throw new Error(error.message.includes("Failed to fetch") ? "Sem conexão. Verifique a internet." : error.message);
  const r = data as { token: string; data: string; hora: string; total: number; sinal: number; pix_chave: string | null; pix_cidade: string | null; petshop: string; whatsapp: string | null };
  return {
    token: r.token,
    data: r.data,
    hora: r.hora,
    total: Number(r.total),
    sinal: Number(r.sinal),
    pixChave: r.pix_chave ?? undefined,
    pixCidade: r.pix_cidade ?? undefined,
    petshop: r.petshop,
    whatsapp: r.whatsapp ?? undefined,
  };
}
