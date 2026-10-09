"use client";

// Assinatura do pet shop (nuvem) e painel do administrador.
// O estado fica fora do store principal: não vai para o localStorage nem para a demonstração.

import { create } from "zustand";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assinaturaDemo, infoDoBanco, type InfoAssinatura } from "@/domain/assinatura";
import { MARCA } from "@/lib/marca";

type Sb = SupabaseClient;

interface EstadoAssinatura {
  info: InfoAssinatura | null;
  admin: boolean;
  definir: (info: InfoAssinatura | null, admin?: boolean) => void;
  recarregar: (sb: Sb, petshopId: string) => Promise<InfoAssinatura>;
}

export const useAssinatura = create<EstadoAssinatura>()((set, get) => ({
  info: null,
  admin: false,
  definir: (info, admin) => set({ info, admin: admin ?? get().admin }),
  recarregar: async (sb, petshopId) => {
    const info = await buscarAssinatura(sb, petshopId);
    set({ info });
    return info;
  },
}));

export const demoAssinatura = () => assinaturaDemo(new Date(), MARCA.precoMensal);

export async function buscarAssinatura(sb: Sb, petshopId: string): Promise<InfoAssinatura> {
  const { data, error } = await sb.rpc("minha_assinatura", { p_petshop: petshopId });
  if (error) throw new Error(error.message);
  return infoDoBanco((data ?? {}) as Record<string, unknown>);
}

export async function souAdmin(sb: Sb): Promise<boolean> {
  const { data, error } = await sb.rpc("sou_admin");
  return !error && data === true;
}

export class ErroCobranca extends Error {
  constructor(
    message: string,
    public codigo?: string,
  ) {
    super(message);
  }
}

/** Chama a Edge Function "assinatura" e traduz o erro para uma frase. */
async function chamar<T>(sb: Sb, corpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb.functions.invoke("assinatura", { body: corpo });
  if (error) {
    let msg = "Não foi possível falar com o sistema de pagamento agora.";
    let codigo: string | undefined;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const j = (await ctx.json()) as { erro?: string; codigo?: string };
        if (j.erro) msg = j.erro;
        codigo = j.codigo;
      } catch {
        // mantém a frase padrão
      }
    }
    throw new ErroCobranca(msg, codigo);
  }
  return data as T;
}

export const assinar = (sb: Sb, petshopId: string, dados: { documento: string; email: string; nome?: string }) =>
  chamar<{ ok: true; link: string | null; vencimento?: string; jaAssinado?: boolean }>(sb, { acao: "assinar", petshopId, ...dados });

export const sincronizarAssinatura = (sb: Sb, petshopId: string) => chamar<{ ok: true }>(sb, { acao: "sincronizar", petshopId });

export const cancelarAssinatura = (sb: Sb, petshopId: string) => chamar<{ ok: true }>(sb, { acao: "cancelar", petshopId });

export async function aceitarTermos(sb: Sb, petshopId: string, versao: string) {
  const { error } = await sb.rpc("aceitar_termos", { p_petshop: petshopId, p_versao: versao });
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Painel do administrador
// ---------------------------------------------------------------------------

export interface PetshopAdmin {
  id: string;
  nome: string;
  whatsapp: string | null;
  criadoEm: string;
  termos: string | null;
  dono: string | null;
  email: string | null;
  status: InfoAssinatura["status"];
  valor: number;
  testeAte: string | null;
  pagoAte: string | null;
  liberadoAte: string | null;
  assinada: boolean;
  liberado: boolean;
  equipe: number;
  clientes: number;
  pets: number;
  atendimentos30d: number;
  ultimoAtendimento: string | null;
}

export async function listarPetshopsAdmin(sb: Sb): Promise<PetshopAdmin[]> {
  const { data, error } = await sb.rpc("admin_petshops");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((p) => ({
    id: String(p.id),
    nome: String(p.nome),
    whatsapp: (p.whatsapp as string | null) ?? null,
    criadoEm: String(p.criado_em),
    termos: (p.termos as string | null) ?? null,
    dono: (p.dono as string | null) ?? null,
    email: (p.email as string | null) ?? null,
    status: (p.status as InfoAssinatura["status"]) ?? "trial",
    valor: Number(p.valor ?? 0),
    testeAte: (p.teste_ate as string | null) ?? null,
    pagoAte: (p.pago_ate as string | null) ?? null,
    liberadoAte: (p.liberado_ate as string | null) ?? null,
    assinada: p.assinada === true,
    liberado: p.liberado !== false,
    equipe: Number(p.equipe ?? 0),
    clientes: Number(p.clientes ?? 0),
    pets: Number(p.pets ?? 0),
    atendimentos30d: Number(p.atendimentos_30d ?? 0),
    ultimoAtendimento: (p.ultimo_atendimento as string | null) ?? null,
  }));
}

export type AcaoAdmin = "estender_teste" | "liberar" | "bloquear" | "desbloquear" | "valor";

export async function ajustarAssinaturaAdmin(sb: Sb, petshopId: string, acao: AcaoAdmin, valor?: number) {
  const { error } = await sb.rpc("admin_ajustar_assinatura", { p_petshop: petshopId, p_acao: acao, p_valor: valor ?? null });
  if (error) throw new Error(error.message);
}
