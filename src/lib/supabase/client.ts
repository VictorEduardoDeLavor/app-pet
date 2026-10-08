"use client";

// Cliente Supabase do navegador (sessão em cookies, fluxo PKCE).
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CHAVE = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** O app só oferece login quando o projeto Supabase está configurado. */
export const temSupabase = Boolean(URL && CHAVE);

let cliente: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!temSupabase) throw new Error("Supabase não configurado");
  if (!cliente) cliente = createBrowserClient(URL!, CHAVE!);
  return cliente;
}

export const CHAVE_DEMO = "app-pet:demo";
/** Código de convite guardado entre o link e o fim do cadastro (confirmação de e-mail no meio). */
export const CHAVE_CONVITE = "app-pet:convite";
