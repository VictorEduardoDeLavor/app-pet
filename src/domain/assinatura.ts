// Assinatura do pet shop no SaaS: teste grátis, mensalidade, tolerância e bloqueio.
// Espelha assinatura_liberada() do banco (0010). O banco decide o acesso; aqui só escolhemos o texto.

export type StatusAssinatura = "trial" | "ativa" | "inadimplente" | "cancelada" | "bloqueada";

export interface PagamentoAssinatura {
  id: string;
  valor: number;
  vencimento: string; // AAAA-MM-DD
  status: string; // status do Asaas: PENDING, OVERDUE, CONFIRMED, RECEIVED...
  forma: string | null;
  link: string | null;
  pagoEm: string | null;
}

export interface InfoAssinatura {
  liberado: boolean;
  status: StatusAssinatura;
  testeAte: string | null; // ISO
  pagoAte: string | null; // AAAA-MM-DD
  liberadoAte: string | null; // AAAA-MM-DD
  valor: number;
  dono: boolean;
  termosVersao: string | null;
  // Só para o dono:
  documento?: string | null;
  emailCobranca?: string | null;
  assinada?: boolean;
  canceladaEm?: string | null;
  pagamentos?: PagamentoAssinatura[];
  /** Modo demonstração: nada é cobrado. */
  demo?: boolean;
}

export type Fase =
  | "teste"
  | "teste_acabou"
  | "ativa"
  | "pendente"
  | "atrasada"
  | "cancelada"
  | "cancelada_em_uso"
  | "liberada"
  | "bloqueada";

export interface Situacao {
  fase: Fase;
  titulo: string;
  texto: string;
  tom: "ok" | "aviso" | "erro" | "info";
  diasTeste?: number;
  /** Até quando dá para usar sem pagar nada (AAAA-MM-DD). */
  usaAte?: string;
}

export const TOLERANCIA_DIAS = 3;

const DIA = 86_400_000;

export function dataSP(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
}

export function somarDias(data: string, dias: number): string {
  const [a, m, d] = data.split("-").map(Number);
  const x = new Date(Date.UTC(a, m - 1, d + dias));
  return x.toISOString().slice(0, 10);
}

/** "23/10" a partir de "2026-10-23" ou de um ISO. */
export function diaMes(data: string): string {
  const d = data.length > 10 ? dataSP(new Date(data)) : data;
  return `${d.slice(8, 10)}/${d.slice(5, 7)}`;
}

export const PAGAS = ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"];

export const NOME_STATUS_PAGAMENTO: Record<string, string> = {
  PENDING: "Em aberto",
  OVERDUE: "Vencida",
  CONFIRMED: "Paga",
  RECEIVED: "Paga",
  RECEIVED_IN_CASH: "Paga",
  REFUNDED: "Estornada",
  REFUND_REQUESTED: "Estorno pedido",
  CHARGEBACK_REQUESTED: "Contestada",
  AWAITING_RISK_ANALYSIS: "Em análise",
};

export const NOME_FORMA: Record<string, string> = {
  PIX: "Pix",
  BOLETO: "Boleto",
  CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD: "Cartão de débito",
  UNDEFINED: "Pix, boleto ou cartão",
};

/** Mesma conta do banco: liberado no teste, com mensalidade paga (+3 dias) ou liberação manual. */
export function liberadoPorDatas(a: Pick<InfoAssinatura, "status" | "testeAte" | "pagoAte" | "liberadoAte">, agora = new Date()): boolean {
  if (a.status === "bloqueada") return false;
  const hoje = dataSP(agora);
  if (a.testeAte && new Date(a.testeAte).getTime() >= agora.getTime()) return true;
  if (a.pagoAte && somarDias(a.pagoAte, TOLERANCIA_DIAS) >= hoje) return true;
  return !!a.liberadoAte && a.liberadoAte >= hoje;
}

export function faturaEmAberto(a: InfoAssinatura): PagamentoAssinatura | undefined {
  return (a.pagamentos ?? [])
    .filter((p) => p.status === "PENDING" || p.status === "OVERDUE")
    .sort((x, y) => x.vencimento.localeCompare(y.vencimento))[0];
}

export function situacao(a: InfoAssinatura, agora = new Date()): Situacao {
  const hoje = dataSP(agora);
  const preco = `R$ ${a.valor.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}/mês`;
  const emTeste = !!a.testeAte && new Date(a.testeAte).getTime() >= agora.getTime();
  const diasTeste = emTeste ? Math.max(1, Math.ceil((new Date(a.testeAte!).getTime() - agora.getTime()) / DIA)) : 0;
  const pagoEmDia = !!a.pagoAte && a.pagoAte >= hoje;
  const naTolerancia = !!a.pagoAte && !pagoEmDia && somarDias(a.pagoAte, TOLERANCIA_DIAS) >= hoje;
  const liberadoManual = !!a.liberadoAte && a.liberadoAte >= hoje;
  const aberta = faturaEmAberto(a);

  if (a.status === "bloqueada") {
    return { fase: "bloqueada", tom: "erro", titulo: "Acesso suspenso", texto: "O acesso deste pet shop foi suspenso pelo suporte. Fale com a gente para resolver." };
  }

  if (a.status === "cancelada") {
    if (pagoEmDia || naTolerancia) {
      return {
        fase: "cancelada_em_uso",
        tom: "info",
        titulo: "Assinatura cancelada",
        texto: `Nada mais será cobrado. Você continua usando até ${diaMes(a.pagoAte!)} e pode assinar de novo quando quiser.`,
        usaAte: a.pagoAte!,
      };
    }
    if (!emTeste && !liberadoManual) {
      return { fase: "cancelada", tom: "erro", titulo: "Assinatura cancelada", texto: `Assine de novo por ${preco} para voltar a usar. Clientes, pets e histórico continuam guardados.` };
    }
  }

  if (pagoEmDia) {
    return {
      fase: "ativa",
      tom: "ok",
      titulo: "Assinatura ativa",
      texto: aberta
        ? `Pago até ${diaMes(a.pagoAte!)}. A próxima fatura (${diaMes(aberta.vencimento)}) já está disponível.`
        : `Pago até ${diaMes(a.pagoAte!)}. A próxima fatura aparece aqui e chega por e-mail.`,
      usaAte: a.pagoAte!,
    };
  }

  if (emTeste) {
    const titulo = diasTeste <= 1 ? "Último dia do teste grátis" : `Teste grátis: faltam ${diasTeste} dias`;
    const texto = a.assinada
      ? `Assinatura feita. A primeira mensalidade (${preco}) vence em ${diaMes(aberta?.vencimento ?? a.testeAte!)}; pague por Pix, boleto ou cartão.`
      : `Tudo liberado até ${diaMes(a.testeAte!)}. Para continuar depois, assine por ${preco}, sem fidelidade.`;
    return { fase: "teste", tom: diasTeste <= 3 && !a.assinada ? "aviso" : "info", titulo, texto, diasTeste, usaAte: dataSP(new Date(a.testeAte!)) };
  }

  if (naTolerancia) {
    const limite = somarDias(a.pagoAte!, TOLERANCIA_DIAS);
    return { fase: "pendente", tom: "aviso", titulo: "Mensalidade em aberto", texto: `Pague até ${diaMes(limite)} para não ter o acesso suspenso.`, usaAte: limite };
  }

  if (liberadoManual) {
    return { fase: "liberada", tom: "info", titulo: "Acesso liberado pelo suporte", texto: `Liberado até ${diaMes(a.liberadoAte!)}.`, usaAte: a.liberadoAte! };
  }

  if (a.pagoAte) {
    return {
      fase: "atrasada",
      tom: "erro",
      titulo: "Acesso suspenso por falta de pagamento",
      texto: "Pague a fatura em aberto: no Pix o acesso volta em instantes; no boleto, quando o banco confirmar. Nada foi apagado.",
    };
  }

  return {
    fase: "teste_acabou",
    tom: "erro",
    titulo: "Seu teste grátis acabou",
    texto: a.assinada
      ? "Pague a primeira mensalidade para continuar. No Pix o acesso volta em instantes. Clientes, pets e histórico estão guardados."
      : `Assine por ${preco} para continuar usando. Clientes, pets e histórico estão guardados.`,
  };
}

/** Converte a resposta do RPC minha_assinatura. */
export function infoDoBanco(j: Record<string, unknown>): InfoAssinatura {
  const pagamentos = Array.isArray(j.pagamentos)
    ? (j.pagamentos as Record<string, unknown>[]).map((p) => ({
        id: String(p.id),
        valor: Number(p.valor ?? 0),
        vencimento: String(p.vencimento),
        status: String(p.status),
        forma: (p.forma as string | null) ?? null,
        link: (p.link as string | null) ?? null,
        pagoEm: (p.pago_em as string | null) ?? null,
      }))
    : undefined;
  return {
    liberado: j.liberado !== false,
    status: (j.status as StatusAssinatura) ?? "ativa",
    testeAte: (j.teste_ate as string | null) ?? null,
    pagoAte: (j.pago_ate as string | null) ?? null,
    liberadoAte: (j.liberado_ate as string | null) ?? null,
    valor: Number(j.valor ?? 49),
    dono: j.dono === true,
    termosVersao: (j.termos_versao as string | null) ?? null,
    documento: (j.documento as string | null) ?? null,
    emailCobranca: (j.email_cobranca as string | null) ?? null,
    assinada: j.assinada === true,
    canceladaEm: (j.cancelada_em as string | null) ?? null,
    pagamentos,
  };
}

/** Assinatura de exemplo do modo demonstração: teste com 9 dias pela frente. */
export function assinaturaDemo(agora = new Date(), preco = 49): InfoAssinatura {
  return {
    liberado: true,
    status: "trial",
    testeAte: new Date(agora.getTime() + 9 * DIA).toISOString(),
    pagoAte: null,
    liberadoAte: null,
    valor: preco,
    dono: true,
    termosVersao: null,
    assinada: false,
    pagamentos: [],
    demo: true,
  };
}

export function formatarDocumento(doc: string): string {
  const d = doc.replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return doc;
}
