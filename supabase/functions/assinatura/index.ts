// Edge Function "assinatura": o dono do pet shop assina, consulta e cancela a mensalidade.
// Ações (POST JSON): { acao: "assinar", petshopId, documento, email, nome? }
//                    { acao: "sincronizar", petshopId }
//                    { acao: "cancelar", petshopId }
// Autorização no código (verify_jwt desligado, como pedem as chaves novas do Supabase):
// o token do usuário é conferido no Auth e só o dono do pet shop passa.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  Asaas,
  ErroAsaas,
  ambienteDaChave,
  celularAsaas,
  cobrancaPaga,
  dataSP,
  documentoValido,
  faturaEmAberto,
  linhaDaCobranca,
  primeiroVencimento,
  somenteDigitos,
} from "./asaas.ts";

const MARCA = Deno.env.get("MARCA_NOME") ?? "APP PET";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const responder = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json" } });
const erro = (mensagem: string, status = 400, codigo?: string) => responder({ erro: mensagem, codigo }, status);

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

type Assinatura = {
  petshop_id: string;
  status: string;
  valor: number;
  teste_ate: string | null;
  pago_ate: string | null;
  documento: string | null;
  email_cobranca: string | null;
  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
};

async function salvarCobrancas(admin: SupabaseClient, asaas: Asaas, a: Assinatura) {
  if (!a.asaas_subscription_id) return [];
  const cobrancas = await asaas.cobrancasDaAssinatura(a.asaas_subscription_id);
  if (cobrancas.length) {
    const { error } = await admin.from("assinatura_pagamentos").upsert(cobrancas.map((c) => linhaDaCobranca(a.petshop_id, c)));
    if (error) throw error;
  }
  await admin.rpc("assinatura_recalcular", { p_petshop: a.petshop_id });
  if (cobrancas.some((c) => cobrancaPaga(c.status)) && ["trial", "inadimplente"].includes(a.status)) {
    await admin.from("assinaturas").update({ status: "ativa", atualizado_em: new Date().toISOString() }).eq("petshop_id", a.petshop_id);
  }
  return cobrancas;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return erro("Método não permitido", 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, chaveDeServico(), { auth: { persistSession: false } });
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: quem } = token ? await admin.auth.getUser(token) : { data: { user: null } };
  if (!quem?.user) return erro("Entre na sua conta de novo para continuar.", 401);

  let corpo: { acao?: string; petshopId?: string; documento?: string; email?: string; nome?: string };
  try {
    corpo = await req.json();
  } catch {
    return erro("Pedido inválido.");
  }
  const ps = corpo.petshopId ?? "";
  const { data: dono } = await admin
    .from("membros")
    .select("id")
    .eq("petshop_id", ps)
    .eq("user_id", quem.user.id)
    .eq("papel", "dono")
    .eq("ativo", true)
    .maybeSingle();
  if (!dono) return erro("Só o dono do pet shop cuida da assinatura.", 403);

  const chave = Deno.env.get("ASAAS_API_KEY");
  if (!chave) {
    return erro("O pagamento online ainda não está ligado. Fale com o suporte para assinar por Pix.", 503, "sem_gateway");
  }
  const asaas = new Asaas(chave, ambienteDaChave(chave, Deno.env.get("ASAAS_AMBIENTE")));

  const { data: a, error: errA } = await admin.from("assinaturas").select("*").eq("petshop_id", ps).single<Assinatura>();
  if (errA || !a) return erro("Assinatura não encontrada.", 404);

  try {
    if (corpo.acao === "sincronizar") {
      const cobrancas = await salvarCobrancas(admin, asaas, a);
      return responder({ ok: true, cobrancas: cobrancas.length });
    }

    if (corpo.acao === "cancelar") {
      if (a.asaas_subscription_id) await asaas.cancelarAssinatura(a.asaas_subscription_id);
      await admin
        .from("assinatura_pagamentos")
        .update({ status: "DELETED", atualizado_em: new Date().toISOString() })
        .eq("petshop_id", ps)
        .in("status", ["PENDING", "OVERDUE"]);
      await admin
        .from("assinaturas")
        .update({ status: "cancelada", cancelada_em: new Date().toISOString(), atualizado_em: new Date().toISOString() })
        .eq("petshop_id", ps);
      return responder({ ok: true });
    }

    if (corpo.acao !== "assinar") return erro("Ação desconhecida.");

    // Já assinado: devolve a fatura em aberto.
    if (a.asaas_subscription_id && a.status !== "cancelada") {
      const cobrancas = await salvarCobrancas(admin, asaas, a);
      const aberta = faturaEmAberto(cobrancas);
      return responder({ ok: true, link: aberta?.invoiceUrl ?? null, jaAssinado: true });
    }

    const documento = somenteDigitos(corpo.documento ?? "");
    if (!documentoValido(documento)) return erro("Confira o CPF ou CNPJ: os números não batem.");
    const email = (corpo.email ?? "").trim() || quem.user.email || null;

    const { data: petshop } = await admin.from("petshops").select("nome, whatsapp").eq("id", ps).single<{ nome: string; whatsapp: string | null }>();
    const nome = (corpo.nome ?? "").trim() || petshop?.nome || "Pet shop";

    let cliente = a.asaas_customer_id;
    if (cliente) await asaas.atualizarCliente(cliente, { nome, documento, email });
    else cliente = (await asaas.criarCliente({ nome, documento, email, celular: celularAsaas(petshop?.whatsapp), referencia: ps })).id;

    const vencimento = primeiroVencimento(a.teste_ate, a.pago_ate, dataSP());
    const sub = await asaas.criarAssinatura({
      cliente,
      valor: Number(a.valor),
      vencimento,
      descricao: `${MARCA} · assinatura mensal · ${petshop?.nome ?? ""}`.trim(),
      referencia: ps,
    });

    const testeRolando = a.teste_ate && new Date(a.teste_ate) > new Date();
    const { error: errUp } = await admin
      .from("assinaturas")
      .update({
        documento,
        email_cobranca: email,
        asaas_customer_id: cliente,
        asaas_subscription_id: sub.id,
        status: testeRolando ? "trial" : a.pago_ate && a.pago_ate >= dataSP() ? "ativa" : "inadimplente",
        cancelada_em: null,
        atualizado_em: new Date().toISOString(),
      })
      .eq("petshop_id", ps);
    if (errUp) throw errUp;

    const cobrancas = await salvarCobrancas(admin, asaas, { ...a, asaas_subscription_id: sub.id });
    const aberta = faturaEmAberto(cobrancas);
    return responder({ ok: true, link: aberta?.invoiceUrl ?? null, vencimento });
  } catch (e) {
    console.error("assinatura", corpo.acao, e);
    if (e instanceof ErroAsaas) return erro(`O Asaas recusou: ${e.message}`, 502);
    return erro("Não foi possível falar com o sistema de pagamento agora. Tente de novo em alguns minutos.", 500);
  }
});
