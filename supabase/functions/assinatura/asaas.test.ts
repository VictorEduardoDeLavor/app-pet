import { describe, expect, it } from "vitest";
import { Asaas, ErroAsaas, ambienteDaChave, celularAsaas, documentoValido, faturaEmAberto, linhaDaCobranca, primeiroVencimento } from "./asaas";

type Chamada = { url: string; init?: RequestInit };

function falso(respostas: [number, unknown][]) {
  const chamadas: Chamada[] = [];
  const f = async (url: string, init?: RequestInit) => {
    chamadas.push({ url, init });
    const [status, corpo] = respostas.shift() ?? [200, {}];
    return new Response(corpo === undefined ? "" : JSON.stringify(corpo), { status });
  };
  return { f, chamadas };
}

describe("Asaas", () => {
  it("cria cliente e assinatura mensal com a chave no header e o pet shop como referência", async () => {
    const { f, chamadas } = falso([
      [200, { id: "cus_1" }],
      [200, { id: "sub_1" }],
      [200, { data: [{ id: "pay_1", value: 49, dueDate: "2026-10-23", status: "PENDING", billingType: "UNDEFINED", invoiceUrl: "https://sandbox.asaas.com/i/1" }] }],
    ]);
    const api = new Asaas("$aact_hmlg_x", "sandbox", f);
    const c = await api.criarCliente({ nome: "Patinhas", documento: "52998224725", email: "ana@pet.com", celular: "11988887777", referencia: "ps-1" });
    const s = await api.criarAssinatura({ cliente: c.id, valor: 49, vencimento: "2026-10-23", descricao: "APP PET", referencia: "ps-1" });
    const cobrancas = await api.cobrancasDaAssinatura(s.id);

    expect(chamadas[0].url).toBe("https://api-sandbox.asaas.com/v3/customers");
    expect((chamadas[0].init!.headers as Record<string, string>).access_token).toBe("$aact_hmlg_x");
    expect(JSON.parse(String(chamadas[0].init!.body))).toMatchObject({ name: "Patinhas", cpfCnpj: "52998224725", externalReference: "ps-1" });
    expect(JSON.parse(String(chamadas[1].init!.body))).toEqual({
      customer: "cus_1", billingType: "UNDEFINED", value: 49, nextDueDate: "2026-10-23", cycle: "MONTHLY", description: "APP PET", externalReference: "ps-1",
    });
    expect(chamadas[2].url).toBe("https://api-sandbox.asaas.com/v3/subscriptions/sub_1/payments?limit=100");
    expect(linhaDaCobranca("ps-1", cobrancas[0])).toMatchObject({ asaas_id: "pay_1", petshop_id: "ps-1", valor: 49, status: "PENDING", link: "https://sandbox.asaas.com/i/1", pago_em: null });
  });

  it("traduz o erro do Asaas e ignora cancelar o que já não existe", async () => {
    const { f } = falso([
      [400, { errors: [{ code: "invalid_cpfCnpj", description: "O CPF/CNPJ informado é inválido." }] }],
      [404, { errors: [{ description: "not found" }] }],
      [401, undefined],
    ]);
    const api = new Asaas("k", "producao", f);
    await expect(api.criarCliente({ nome: "X", documento: "1", referencia: "r" })).rejects.toThrow("O CPF/CNPJ informado é inválido.");
    await expect(api.cancelarAssinatura("sub_x")).resolves.toBeUndefined();
    await expect(api.cancelarAssinatura("sub_y")).rejects.toBeInstanceOf(ErroAsaas);
  });

  it("ambiente pela chave, CPF/CNPJ, celular e vencimento", () => {
    expect(ambienteDaChave("$aact_hmlg_000")).toBe("sandbox");
    expect(ambienteDaChave("$aact_prod_000")).toBe("producao");
    expect(ambienteDaChave("$aact_prod_000", "sandbox")).toBe("sandbox");

    expect(documentoValido("529.982.247-25")).toBe(true);
    expect(documentoValido("529.982.247-24")).toBe(false);
    expect(documentoValido("111.111.111-11")).toBe(false);
    expect(documentoValido("11.222.333/0001-81")).toBe(true);
    expect(documentoValido("11.222.333/0001-80")).toBe(false);
    expect(documentoValido("123")).toBe(false);

    expect(celularAsaas("5511988887777")).toBe("11988887777");
    expect(celularAsaas("551133334444")).toBe("1133334444");
    expect(celularAsaas(null)).toBeNull();

    // Teste rolando: primeira cobrança no fim do teste.
    expect(primeiroVencimento("2026-10-23T15:00:00Z", null, "2026-10-09")).toBe("2026-10-23");
    // Teste acabou: vence hoje.
    expect(primeiroVencimento("2026-10-01T15:00:00Z", null, "2026-10-09")).toBe("2026-10-09");
    // Cancelou com mês pago e voltou: cobra no fim do pago.
    expect(primeiroVencimento("2026-09-01T15:00:00Z", "2026-11-05", "2026-10-09")).toBe("2026-11-05");
  });

  it("fatura em aberto é a pendente ou vencida mais antiga", () => {
    const f = faturaEmAberto([
      { status: "RECEIVED", vencimento: "2026-09-01", link: "a" },
      { status: "PENDING", vencimento: "2026-11-01", link: "c" },
      { status: "OVERDUE", vencimento: "2026-10-01", link: "b" },
    ]);
    expect(f?.link).toBe("b");
    expect(faturaEmAberto([{ status: "RECEIVED", vencimento: "2026-09-01" }])).toBeUndefined();
  });
});
