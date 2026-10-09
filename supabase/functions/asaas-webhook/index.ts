// Edge Function "asaas-webhook": recebe os eventos de cobrança e assinatura do Asaas.
// O Asaas manda o token do webhook no header "asaas-access-token". O token é criado pelo botão
// "Conectar o Asaas" do painel do administrador; o banco guarda só a impressão SHA-256 dele
// (plataforma_config). Um segredo ASAAS_WEBHOOK_TOKEN, se existir, também vale.
// Toda a regra fica no banco (asaas_processar_evento): grava o evento uma vez só,
// atualiza as cobranças e recalcula até quando o pet shop está pago.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

function chaveDeServico(): string {
  const novas = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (novas) {
    try {
      const k = JSON.parse(novas)["default"];
      if (k) return k;
    } catch {
      // segue para a chave antiga
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}

function iguais(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function sha256Hex(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// A impressão do token muda só quando o administrador reconecta; guarda por 1 minuto.
let cache: { hash: string; em: number } | null = null;
async function impressaoEsperada(admin: SupabaseClient): Promise<string> {
  if (cache && Date.now() - cache.em < 60_000) return cache.hash;
  const { data } = await admin.from("plataforma_config").select("valor").eq("chave", "asaas_webhook_token_sha256").maybeSingle();
  cache = { hash: (data?.valor as string | undefined) ?? "", em: Date.now() };
  return cache.hash;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const recebido = req.headers.get("asaas-access-token") ?? "";
  if (!recebido) return new Response("token ausente", { status: 401 });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, chaveDeServico(), { auth: { persistSession: false } });
  const segredo = Deno.env.get("ASAAS_WEBHOOK_TOKEN") ?? "";
  let valido = !!segredo && iguais(segredo, recebido);
  if (!valido) {
    const esperado = await impressaoEsperada(admin);
    valido = !!esperado && iguais(esperado, await sha256Hex(recebido));
  }
  if (!valido) return new Response("token inválido", { status: 401 });

  let evento: { id?: string; event?: string } | null = null;
  try {
    evento = await req.json();
  } catch {
    evento = null;
  }
  if (!evento?.id || !evento.event) return new Response("evento inválido", { status: 400 });

  const { data, error } = await admin.rpc("asaas_processar_evento", { p_evento: evento });
  if (error) {
    console.error("asaas-webhook", evento.event, evento.id, error);
    return new Response("erro ao gravar", { status: 500 }); // o Asaas tenta de novo
  }
  // Sinal de vida para o painel do administrador ("último aviso do Asaas").
  const agora = new Date().toISOString();
  await admin.from("plataforma_config").upsert([
    { chave: "asaas_ultimo_evento", valor: agora, atualizado_em: agora },
    { chave: "asaas_ultimo_evento_tipo", valor: `${evento.event} · ${data}`, atualizado_em: agora },
  ]);
  return Response.json({ resultado: data });
});
