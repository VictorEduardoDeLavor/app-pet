import { describe, expect, it } from "vitest";
import { infoDoBanco, liberadoPorDatas, situacao, somarDias, type InfoAssinatura } from "./assinatura";

const agora = new Date("2026-10-09T12:00:00-03:00");
const base: InfoAssinatura = { liberado: true, status: "trial", testeAte: null, pagoAte: null, liberadoAte: null, valor: 49, dono: true, termosVersao: null, pagamentos: [] };
const s = (a: Partial<InfoAssinatura>) => situacao({ ...base, ...a }, agora);
const lib = (a: Partial<InfoAssinatura>) => liberadoPorDatas({ ...base, ...a }, agora);

describe("assinatura do pet shop", () => {
  it("teste grátis conta os dias e avisa nos 3 últimos", () => {
    const t = s({ testeAte: "2026-10-23T12:00:00-03:00" });
    expect(t).toMatchObject({ fase: "teste", diasTeste: 14, tom: "info", titulo: "Teste grátis: faltam 14 dias" });
    expect(t.texto).toContain("R$ 49/mês");
    expect(s({ testeAte: "2026-10-11T12:00:00-03:00" })).toMatchObject({ diasTeste: 2, tom: "aviso" });
    expect(s({ testeAte: "2026-10-09T20:00:00-03:00" }).titulo).toBe("Último dia do teste grátis");
    expect(s({ testeAte: "2026-10-23T12:00:00-03:00", assinada: true, pagamentos: [{ id: "p", valor: 49, vencimento: "2026-10-23", status: "PENDING", forma: null, link: "x", pagoEm: null }] }).texto).toContain("vence em 23/10");
  });

  it("teste acabou sem pagar: bloqueia; pagamento libera com 3 dias de tolerância", () => {
    expect(s({ testeAte: "2026-10-01T12:00:00-03:00" }).fase).toBe("teste_acabou");
    expect(lib({ testeAte: "2026-10-01T12:00:00-03:00" })).toBe(false);
    expect(s({ status: "ativa", pagoAte: "2026-11-01" })).toMatchObject({ fase: "ativa", tom: "ok" });
    expect(s({ status: "inadimplente", pagoAte: "2026-10-07" })).toMatchObject({ fase: "pendente", usaAte: "2026-10-10" });
    expect(lib({ pagoAte: "2026-10-06" })).toBe(true); // 06 + 3 = 09 (hoje)
    expect(lib({ pagoAte: "2026-10-05" })).toBe(false);
    expect(s({ status: "inadimplente", pagoAte: "2026-10-05" }).fase).toBe("atrasada");
  });

  it("cancelada usa até o fim do pago; bloqueada e liberada pelo suporte", () => {
    expect(s({ status: "cancelada", pagoAte: "2026-10-30" })).toMatchObject({ fase: "cancelada_em_uso", usaAte: "2026-10-30" });
    expect(s({ status: "cancelada", pagoAte: "2026-09-30" }).fase).toBe("cancelada");
    expect(s({ status: "bloqueada", pagoAte: "2026-12-30" }).fase).toBe("bloqueada");
    expect(lib({ status: "bloqueada", pagoAte: "2026-12-30" })).toBe(false);
    expect(s({ liberadoAte: "2026-10-20" })).toMatchObject({ fase: "liberada" });
    expect(lib({ liberadoAte: "2026-10-20" })).toBe(true);
  });

  it("lê a resposta do banco", () => {
    const i = infoDoBanco({
      liberado: false, status: "trial", teste_ate: "2026-10-01T00:00:00Z", pago_ate: null, valor: 49, dono: true, termos_versao: "2026-10", assinada: true,
      pagamentos: [{ id: "pay_1", valor: 49, vencimento: "2026-10-01", status: "OVERDUE", forma: "UNDEFINED", link: "https://x", pago_em: null }],
    });
    expect(i).toMatchObject({ liberado: false, status: "trial", dono: true, termosVersao: "2026-10", assinada: true });
    expect(i.pagamentos![0]).toEqual({ id: "pay_1", valor: 49, vencimento: "2026-10-01", status: "OVERDUE", forma: "UNDEFINED", link: "https://x", pagoEm: null });
    expect(infoDoBanco({ liberado: true, dono: false, status: "ativa", valor: 49 }).pagamentos).toBeUndefined();
    expect(somarDias("2026-12-30", 3)).toBe("2027-01-02");
  });
});
