// Edge Function "asaas-webhook": recebe os eventos de cobrança e assinatura do Asaas.
// O Asaas manda o token configurado no painel no header "asaas-access-token".
// Toda a regra fica no banco (asaas_processar_evento): grava o evento uma vez só,
// atualiza as cobranças e recalcula até quando o pet shop está pago.

import { createClient } from "npm:@supabase/supabase-js@2";

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

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const esperado = Deno.env.get("ASAAS_WEBHOOK_TOKEN") ?? "";
  const recebido = req.headers.get("asaas-access-token") ?? "";
  if (!esperado || !iguais(esperado, recebido)) return new Response("token inválido", { status: 401 });

  let evento: { id?: string; event?: string } | null = null;
  try {
    evento = await req.json();
  } catch {
    evento = null;
  }
  if (!evento?.id || !evento.event) return new Response("evento inválido", { status: 400 });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, chaveDeServico(), { auth: { persistSession: false } });
  const { data, error } = await admin.rpc("asaas_processar_evento", { p_evento: evento });
  if (error) {
    console.error("asaas-webhook", evento.event, evento.id, error);
    return new Response("erro ao gravar", { status: 500 }); // o Asaas tenta de novo
  }
  return Response.json({ resultado: data });
});
