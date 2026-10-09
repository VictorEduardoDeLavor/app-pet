// Cliente mínimo da API v3 do Asaas e regras puras da assinatura.
// Sem dependências do Deno: roda na Edge Function e nos testes (vitest) com fetch simulado.

export type Ambiente = "sandbox" | "producao";

export const BASE_ASAAS: Record<Ambiente, string> = {
  sandbox: "https://api-sandbox.asaas.com/v3",
  producao: "https://api.asaas.com/v3",
};

/** Chaves de produção começam com $aact_prod_ e as de sandbox com $aact_hmlg_. */
export function ambienteDaChave(chave: string, padrao?: string | null): Ambiente {
  if (padrao === "sandbox" || padrao === "producao") return padrao;
  return chave.includes("_hmlg_") ? "sandbox" : "producao";
}

export class ErroAsaas extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export type CobrancaAsaas = {
  id: string;
  customer?: string;
  subscription?: string;
  value: number;
  dueDate: string;
  status: string;
  billingType?: string;
  invoiceUrl?: string;
  paymentDate?: string | null;
  clientPaymentDate?: string | null;
};

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export class Asaas {
  private base: string;
  constructor(
    private chave: string,
    ambiente: Ambiente,
    private fetcher: Fetch = fetch,
    private agente = "APP-PET/1.0 (Supabase Edge Functions)",
  ) {
    this.base = BASE_ASAAS[ambiente];
  }

  private async pedir<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
    const r = await this.fetcher(this.base + caminho, {
      method: metodo,
      headers: { access_token: this.chave, "Content-Type": "application/json", "User-Agent": this.agente },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    const texto = await r.text();
    let json: unknown = null;
    try {
      json = texto ? JSON.parse(texto) : null;
    } catch {
      json = null;
    }
    if (!r.ok) {
      const erros = (json as { errors?: { description?: string }[] } | null)?.errors;
      const msg = erros?.map((e) => e.description).filter(Boolean).join(" ") || `Asaas respondeu ${r.status}`;
      throw new ErroAsaas(msg, r.status);
    }
    return json as T;
  }

  /**
   * Cliente do Asaas = o pet shop que paga a mensalidade. Sem celular de propósito: as notificações
   * padrão do Asaas mandam SMS e ligação (cobrados por envio); fica só o e-mail com a fatura.
   */
  criarCliente(c: { nome: string; documento: string; email?: string | null; referencia: string }) {
    return this.pedir<{ id: string }>("POST", "/customers", {
      name: c.nome,
      cpfCnpj: c.documento,
      email: c.email || undefined,
      externalReference: c.referencia,
    });
  }

  atualizarCliente(id: string, c: { nome: string; documento: string; email?: string | null }) {
    return this.pedir<{ id: string }>("POST", `/customers/${id}`, { name: c.nome, cpfCnpj: c.documento, email: c.email || undefined });
  }

  criarAssinatura(a: { cliente: string; valor: number; vencimento: string; descricao: string; referencia: string }) {
    return this.pedir<{ id: string }>("POST", "/subscriptions", {
      customer: a.cliente,
      billingType: "UNDEFINED", // o pet shop escolhe Pix, boleto ou cartão na fatura
      value: a.valor,
      nextDueDate: a.vencimento,
      cycle: "MONTHLY",
      description: a.descricao,
      externalReference: a.referencia,
    });
  }

  async cobrancasDaAssinatura(id: string): Promise<CobrancaAsaas[]> {
    const r = await this.pedir<{ data: CobrancaAsaas[] }>("GET", `/subscriptions/${id}/payments?limit=100`);
    return r?.data ?? [];
  }

  /** Novo valor da mensalidade, inclusive nas faturas ainda em aberto. */
  atualizarValorAssinatura(id: string, valor: number) {
    return this.pedir<{ id: string }>("POST", `/subscriptions/${id}`, { value: valor, updatePendingPayments: true });
  }

  /** Dados da conta dona da chave (confere se a chave funciona e de quem é). */
  conta() {
    return this.pedir<{ name?: string; companyName?: string; tradingName?: string; email?: string; cpfCnpj?: string }>("GET", "/myAccount/commercialInfo/");
  }

  async listarWebhooks(): Promise<WebhookAsaas[]> {
    const r = await this.pedir<{ data: WebhookAsaas[] }>("GET", "/webhooks?limit=100");
    return r?.data ?? [];
  }

  /** Cria ou atualiza (pela URL) o webhook que avisa o app de cada pagamento. */
  async conectarWebhook(w: { url: string; email: string; token: string; nome: string }): Promise<{ id: string; criado: boolean }> {
    const corpo = {
      name: w.nome,
      url: w.url,
      email: w.email,
      enabled: true,
      interrupted: false,
      apiVersion: 3,
      authToken: w.token,
      sendType: "SEQUENTIALLY",
      events: EVENTOS_WEBHOOK,
    };
    const existente = (await this.listarWebhooks()).find((x) => x.url === w.url);
    if (existente) {
      await this.pedir("PUT", `/webhooks/${existente.id}`, corpo);
      return { id: existente.id, criado: false };
    }
    const novo = await this.pedir<{ id: string }>("POST", "/webhooks", corpo);
    return { id: novo.id, criado: true };
  }

  async cancelarAssinatura(id: string): Promise<void> {
    try {
      await this.pedir("DELETE", `/subscriptions/${id}`);
    } catch (e) {
      if (!(e instanceof ErroAsaas && e.status === 404)) throw e; // já não existia
    }
  }
}

export type WebhookAsaas = { id: string; name?: string; url: string; enabled?: boolean; interrupted?: boolean; events?: string[] };

/** O que o app precisa ouvir do Asaas: cobranças das assinaturas e o fim de uma assinatura. */
export const EVENTOS_WEBHOOK = [
  "PAYMENT_CREATED",
  "PAYMENT_UPDATED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
  "PAYMENT_OVERDUE",
  "PAYMENT_DELETED",
  "PAYMENT_RESTORED",
  "PAYMENT_REFUNDED",
  "PAYMENT_PARTIALLY_REFUNDED",
  "PAYMENT_RECEIVED_IN_CASH_UNDONE",
  "PAYMENT_CHARGEBACK_REQUESTED",
  "SUBSCRIPTION_INACTIVATED",
  "SUBSCRIPTION_DELETED",
];

/** Token do webhook: 64 caracteres aleatórios (o Asaas pede de 32 a 255, sem espaços). */
export function novoTokenWebhook(): string {
  return (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
}

/** SHA-256 em hexadecimal: o banco guarda só a impressão do token, nunca o token. */
export async function sha256Hex(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Comparação em tempo constante (não revela quantos caracteres bateram). */
export function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** Menor mensalidade que o Asaas aceita cobrar (boleto e Pix). */
export const VALOR_MINIMO = 5;

// ---------------------------------------------------------------------------
// Regras puras
// ---------------------------------------------------------------------------

export const somenteDigitos = (s: string) => (s ?? "").replace(/\D/g, "");

function cpfValido(c: string) {
  if (!/^\d{11}$/.test(c) || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(c[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}

function cnpjValido(c: string) {
  if (!/^\d{14}$/.test(c) || /^(\d)\1{13}$/.test(c)) return false;
  const dv = (n: number) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = pesos.reduce((s, p, i) => s + p * Number(c[i]), 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(12) === Number(c[12]) && dv(13) === Number(c[13]);
}

/** CPF (11 dígitos) ou CNPJ (14 dígitos) com dígitos verificadores corretos. */
export function documentoValido(doc: string): boolean {
  const d = somenteDigitos(doc);
  return d.length === 11 ? cpfValido(d) : d.length === 14 ? cnpjValido(d) : false;
}

/** Data (AAAA-MM-DD) em São Paulo. */
export function dataSP(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
}

/**
 * Primeiro vencimento: no fim do teste grátis (ninguém paga antes de testar), ou no fim do período
 * já pago (quem cancelou e voltou), ou hoje.
 */
export function primeiroVencimento(testeAte: string | null, pagoAte: string | null, hoje: string): string {
  const fimTeste = testeAte ? dataSP(new Date(testeAte)) : hoje;
  return [hoje, fimTeste, pagoAte ?? hoje].sort().at(-1)!;
}

/** Celular no formato do Asaas (DDD + número, sem o 55). */
export function celularAsaas(whatsapp: string | null | undefined): string | null {
  const d = somenteDigitos(whatsapp ?? "");
  if (d.length === 13 && d.startsWith("55")) return d.slice(2);
  if (d.length === 12 && d.startsWith("55")) return d.slice(2);
  return d.length === 10 || d.length === 11 ? d : null;
}

/** Linha de assinatura_pagamentos a partir de uma cobrança do Asaas. */
export function linhaDaCobranca(petshopId: string, c: CobrancaAsaas) {
  return {
    asaas_id: c.id,
    petshop_id: petshopId,
    valor: c.value,
    vencimento: c.dueDate,
    status: c.status,
    forma: c.billingType ?? null,
    link: c.invoiceUrl ?? null,
    pago_em: c.clientPaymentDate || c.paymentDate || null,
    atualizado_em: new Date().toISOString(),
  };
}

const PAGAS = ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"];
export const cobrancaPaga = (status: string) => PAGAS.includes(status);

/** A fatura que o pet shop deve pagar agora: a pendente/vencida mais antiga. */
export function faturaEmAberto(cobrancas: { status: string; vencimento?: string; dueDate?: string; link?: string | null; invoiceUrl?: string }[]) {
  return cobrancas
    .filter((c) => c.status === "PENDING" || c.status === "OVERDUE")
    .sort((a, b) => String(a.vencimento ?? a.dueDate).localeCompare(String(b.vencimento ?? b.dueDate)))[0];
}
