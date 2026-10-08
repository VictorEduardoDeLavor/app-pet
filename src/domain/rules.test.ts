import { describe, expect, it } from "vitest";
import { criarSeed } from "@/data/seed";
import {
  ErroRegra,
  conflitos,
  criarAtendimento,
  darBaixaManual,
  fecharCaixa,
  horariosLivres,
  kpisDoDia,
  lancarDespesa,
  mudarStatus,
  pagarLancamento,
  planoAtivoDoPet,
  planosAVencer,
  receitaPendenteDoAtendimento,
  resumoCaixa,
  saldoPlano,
  statusEfetivoPlano,
  venderPlano,
  clientesSumidos,
  criarMembro,
  profissionais,
  filaDoProfissional,
  resumoProfissional,
  comissaoDoAtendimento,
  prontosParaAvisar,
  inicioDoAtendimento,
} from "./rules";
import { inicioDoPapel, rotaPermitida, transicoesDoPapel } from "./permissoes";
import { linkWhatsapp, renderMensagem, variaveisDoAtendimento } from "./messages";
import { hoje, somaDias, telefone } from "./format";

// Terça-feira, 6 de outubro de 2026, 12:00
const AGORA = new Date(2026, 9, 6, 12, 0);
const T = hoje(AGORA);
const novoDb = () => criarSeed(AGORA);

describe("seed reproduz o mockup", () => {
  it("tem 8 agendamentos hoje, 2 em atendimento e caixa de R$ 360", () => {
    const k = kpisDoDia(novoDb(), T);
    expect(k).toEqual({ agendamentos: 8, emAtendimento: 2, caixa: 360 });
  });

  it("caixa: entradas 480, saídas 120, a receber 80", () => {
    const r = resumoCaixa(novoDb(), T);
    expect(r.entradas).toBe(480);
    expect(r.saidas).toBe(120);
    expect(r.aReceber).toBe(80);
  });

  it("2 planos a vencer (Thor por data, Pipoca por saldo)", () => {
    const ids = planosAVencer(novoDb(), T).map((p) => p.id).sort();
    expect(ids).toEqual(["pl_pipoca", "pl_thor"]);
  });

  it("Thor tem 2 de 4 banhos disponíveis", () => {
    expect(saldoPlano(novoDb(), "pl_thor")).toBe(2);
  });
});

describe("agendamento", () => {
  it("bloqueia conflito no mesmo profissional", () => {
    const db = novoDb();
    expect(() =>
      criarAtendimento(db, { petId: "p_luna", servicoIds: ["s_banho"], profissionalId: "m_bruno", data: T, hora: "10:30" }, AGORA),
    ).toThrow(/Conflito/);
  });

  it("permite o mesmo horário com outro profissional", () => {
    const db = novoDb();
    const { atendimento } = criarAtendimento(
      db,
      { petId: "p_luna", servicoIds: ["s_banho"], profissionalId: "m_camila", data: T, hora: "16:00" },
      AGORA,
    );
    expect(atendimento.duracaoMin).toBe(45);
    expect(atendimento.valorTotal).toBe(50);
  });

  it("preço e duração seguem o porte do pet", () => {
    const db = novoDb();
    const { atendimento } = criarAtendimento(
      db,
      { petId: "p_max", servicoIds: ["s_banho_tosa", "s_unhas"], profissionalId: "m_camila", data: somaDias(T, 1), hora: "13:00" },
      AGORA,
    );
    expect(atendimento.valorTotal).toBe(120 + 25);
    expect(atendimento.duracaoMin).toBe(90 + 15);
  });

  it("serviço coberto por plano ativo não é cobrado", () => {
    const db = novoDb();
    const { atendimento } = criarAtendimento(
      db,
      { petId: "p_thor", servicoIds: ["s_banho", "s_unhas"], profissionalId: "m_camila", data: somaDias(T, 1), hora: "10:00" },
      AGORA,
    );
    expect(atendimento.planoPetId).toBe("pl_thor");
    expect(atendimento.itens.find((i) => i.servicoId === "s_banho")?.cobertoPorPlano).toBe(true);
    expect(atendimento.valorTotal).toBe(25);
  });

  it("recusa domingo e horário fora do expediente", () => {
    const db = novoDb();
    const domingo = somaDias(T, 5); // 11/10/2026 é domingo
    expect(() =>
      criarAtendimento(db, { petId: "p_luna", servicoIds: ["s_banho"], profissionalId: "m_camila", data: domingo, hora: "10:00" }, AGORA),
    ).toThrow(ErroRegra);
    expect(() =>
      criarAtendimento(db, { petId: "p_luna", servicoIds: ["s_banho"], profissionalId: "m_camila", data: T, hora: "17:30" }, AGORA),
    ).toThrow(/fora do funcionamento/);
  });

  it("horários livres excluem os ocupados", () => {
    const livres = horariosLivres(novoDb(), "m_bruno", T, 60);
    expect(livres).not.toContain("10:00");
    expect(livres).not.toContain("14:00");
    expect(livres).toContain("12:00");
    expect(conflitos(novoDb(), { profissionalId: "m_bruno", data: T, hora: "12:00", duracaoMin: 60 })).toHaveLength(0);
  });
});

describe("ciclo de status", () => {
  it("finalizar atendimento coberto dá baixa de 1 uso e não cria receita", () => {
    const { db, efeitos } = mudarStatus(novoDb(), "a_thor", "finalizado", "m_bruno", AGORA);
    expect(efeitos.usoRegistrado).toBeDefined();
    expect(efeitos.receitaCriada).toBeUndefined();
    expect(saldoPlano(db, "pl_thor")).toBe(1);
    expect(db.atendimentos.find((a) => a.id === "a_thor")?.pago).toBe(true);
    expect(db.pets.find((p) => p.id === "p_thor")?.ultimaVisita).toBe(T);
  });

  it("último uso encerra o plano", () => {
    const { db, efeitos } = mudarStatus(novoDb(), "a_pipoca", "finalizado", "m_jessica", AGORA);
    expect(efeitos.planoEncerrado).toBe(true);
    expect(saldoPlano(db, "pl_pipoca")).toBe(0);
    expect(planoAtivoDoPet(db, "p_pipoca", T)).toBeUndefined();
  });

  it("finalizar sem plano cria receita pendente; pagar leva ao caixa", () => {
    let db = novoDb();
    db = mudarStatus(db, "a_luna", "em_atendimento", "m_camila", AGORA).db;
    const r = mudarStatus(db, "a_luna", "finalizado", "m_camila", AGORA);
    expect(r.efeitos.receitaCriada?.valor).toBe(80);
    expect(r.efeitos.receitaCriada?.status).toBe("pendente");
    expect(resumoCaixa(r.db, T).aReceber).toBe(160);

    const pend = receitaPendenteDoAtendimento(r.db, "a_luna")!;
    const pago = pagarLancamento(r.db, pend.id, "pix", AGORA);
    expect(resumoCaixa(pago, T).entradas).toBe(560);
    expect(pago.atendimentos.find((a) => a.id === "a_luna")?.pago).toBe(true);
  });

  it("não pula etapas nem volta de finalizado", () => {
    expect(() => mudarStatus(novoDb(), "a_mel", "finalizado", "m_ana", AGORA)).toThrow(/Não é possível/);
    expect(() => mudarStatus(novoDb(), "a_max", "cancelado", "m_ana", AGORA)).toThrow(ErroRegra);
  });

  it("falta só consome uso quando o pet shop configura", () => {
    const semConsumo = mudarStatus(novoDb(), "a_bidu", "faltou", "m_ana", AGORA).db;
    expect(saldoPlano(semConsumo, "pl_bidu")).toBe(4);
    const base = novoDb();
    const comConsumo = mudarStatus({ ...base, petshop: { ...base.petshop, faltaConsomeUso: true } }, "a_bidu", "faltou", "m_ana", AGORA).db;
    expect(saldoPlano(comConsumo, "pl_bidu")).toBe(3);
  });

  it("toda troca grava evento com autor", () => {
    const { db } = mudarStatus(novoDb(), "a_mel", "confirmado", "m_ana", AGORA);
    const evs = db.atendimentos.find((a) => a.id === "a_mel")!.eventos;
    expect(evs.at(-1)).toMatchObject({ de: "agendado", para: "confirmado", porMembroId: "m_ana" });
  });
});

describe("planos e financeiro", () => {
  it("vender plano cria receita paga e bloqueia segundo plano ativo", () => {
    const { db, plano } = venderPlano(novoDb(), { modeloId: "pm_2banhos", petId: "p_mel", preco: 130, formaPagamento: "pix", inicio: T }, AGORA);
    expect(plano.vencimento).toBe(somaDias(T, 30));
    expect(resumoCaixa(db, T).entradas).toBe(480 + 130);
    expect(() => venderPlano(db, { modeloId: "pm_2banhos", petId: "p_mel", preco: 130, formaPagamento: "pix", inicio: T }, AGORA)).toThrow(/já tem um plano/);
  });

  it("baixa manual reduz saldo e recusa plano zerado", () => {
    let db = darBaixaManual(novoDb(), "pl_pipoca", AGORA);
    expect(saldoPlano(db, "pl_pipoca")).toBe(0);
    expect(statusEfetivoPlano(db, db.planosPet.find((p) => p.id === "pl_pipoca")!, T)).toBe("finalizado");
    expect(() => (db = darBaixaManual(db, "pl_pipoca", AGORA))).toThrow(/não tem saldo/);
  });

  it("despesa entra nas saídas e caixa fecha uma vez", () => {
    let db = lancarDespesa(novoDb(), { descricao: "Toalhas", categoria: "Materiais", valor: 60, formaPagamento: "pix" }, AGORA);
    expect(resumoCaixa(db, T).saidas).toBe(180);
    db = fecharCaixa(db, T, "m_ana", AGORA);
    expect(db.caixas[0].saldoFinal).toBe(300);
    expect(() => fecharCaixa(db, T, "m_ana", AGORA)).toThrow(/já foi fechado/);
  });

  it("clientes sumidos: Amora (52 dias) e Simba (40 dias)", () => {
    const nomes = clientesSumidos(novoDb(), T).map((c) => c.pets[0].nome);
    expect(nomes).toEqual(["Amora", "Simba"]);
  });

  it("pet em atendimento hoje não conta como sumido", () => {
    const db = novoDb();
    const comBidu = mudarStatus(db, "a_bidu", "em_atendimento", "m_bruno", AGORA).db;
    expect(clientesSumidos(comBidu, T).map((c) => c.pets[0].nome)).toEqual(["Amora", "Simba"]);
  });
});

describe("equipe", () => {
  it("cadastra profissional e dono entra na lista de quem atende", () => {
    const { db, membro } = criarMembro(novoDb(), { nome: "Paula", papel: "banhista", comissaoPct: 35 });
    expect(membro.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(profissionais(db).map((m) => m.nome)).toContain("Paula");
    expect(profissionais(db).map((m) => m.nome)).toContain("Ana Martins");
    expect(() => criarMembro(db, { nome: "x", papel: "banhista", comissaoPct: 10 })).toThrow(/nome/);
  });
});

describe("mensagens", () => {
  it("monta confirmação com dados reais e link do WhatsApp", () => {
    const db = novoDb();
    const atd = db.atendimentos.find((a) => a.id === "a_luna")!;
    const texto = renderMensagem(db.mensagemModelos[0].texto, variaveisDoAtendimento(db, atd, T));
    expect(texto).toBe(
      "Olá, Ana! Tudo bem? Passando para confirmar o horário de Luna no dia 06/10/2026 às 09:00 para banho e tosa. O valor estimado é R$ 80,00. Podemos confirmar?",
    );
    const lembrete = renderMensagem(db.mensagemModelos[1].texto, variaveisDoAtendimento(db, atd, T));
    expect(lembrete).toContain("lembrar que hoje, às 09:00, Luna tem banho e tosa");
    const amanha = db.atendimentos.find((a) => a.id === "a_luna_prox")!;
    expect(renderMensagem(db.mensagemModelos[1].texto, variaveisDoAtendimento(db, amanha, T))).toContain("lembrar que amanhã, às 09:00");
    expect(linkWhatsapp("5511991234567", "Oi Ana")).toBe("https://wa.me/5511991234567?text=Oi%20Ana");
    expect(telefone("5511988776655")).toBe("(11) 98877-6655");
  });
});

describe("fila do banhista", () => {
  it("Bruno: Thor na mesa, Bidu a seguir, Max pronto; comissão pela tabela de serviços", () => {
    const db = novoDb();
    const f = filaDoProfissional(db, "m_bruno", T);
    expect(f.agora.map((a) => a.id)).toEqual(["a_thor"]);
    expect(f.proximos.map((a) => a.id)).toEqual(["a_bidu"]);
    expect(f.concluidos.map((a) => a.id)).toEqual(["a_max"]);
    // Banho e tosa porte G: R$ 120 x 40%
    expect(resumoProfissional(db, "m_bruno", T)).toEqual({ total: 3, concluidos: 1, comissao: 48 });
    expect(inicioDoAtendimento(f.agora[0])).toBe(new Date(2026, 9, 6, 10, 0).toISOString());
  });

  it("comissão soma % diferentes por serviço e conta item coberto por plano", () => {
    const db = novoDb();
    // Nina (P): banho 50 x 40% + hidratação 35 x 30% + unhas 20 x 30% + ouvidos 15 x 30%
    expect(comissaoDoAtendimento(db, db.atendimentos.find((a) => a.id === "a_nina")!)).toBe(41);
    const fim = mudarStatus(db, "a_thor", "finalizado", "m_bruno", AGORA).db;
    expect(resumoProfissional(fim, "m_bruno", T).comissao).toBe(80); // + banho G 80 x 40%, mesmo pelo plano
  });

  it("% própria da pessoa vale para todos os serviços dela", () => {
    const db = novoDb();
    const comPct = { ...db, membros: db.membros.map((m) => (m.id === "m_bruno" ? { ...m, comissaoPct: 50 } : m)) };
    expect(resumoProfissional(comPct, "m_bruno", T).comissao).toBe(60);
  });

  it("pet finalizado aparece para a recepção avisar até mandar o 'pet pronto' ou receber", () => {
    const db = novoDb();
    expect(prontosParaAvisar(db, T)).toEqual([]); // Max e Nina já pagaram
    const fim = mudarStatus(db, "a_thor", "finalizado", "m_bruno", AGORA).db;
    expect(prontosParaAvisar(fim, T).map((a) => a.id)).toEqual(["a_thor"]);
    const avisado = {
      ...fim,
      mensagensEnvios: [{ id: "e1", modeloId: "msg_pet_pronto", tutorId: "t_carlos", atendimentoId: "a_thor", canal: "manual" as const, enviadoEm: AGORA.toISOString() }],
    };
    expect(prontosParaAvisar(avisado, T)).toEqual([]);
  });
});

describe("permissões por papel", () => {
  it("banhista só vê a própria fila, a ficha do pet e o atendimento", () => {
    expect(inicioDoPapel("banhista")).toBe("/fila");
    for (const rota of ["/fila", "/pets/p_thor", "/atendimentos/a_thor", "/mais"]) expect(rotaPermitida("banhista", rota)).toBe(true);
    for (const rota of ["/", "/agenda", "/financeiro", "/clientes/t_ana", "/equipe", "/mensagens"]) expect(rotaPermitida("banhista", rota)).toBe(false);
  });

  it("recepção opera tudo menos equipe; dono vê tudo", () => {
    expect(rotaPermitida("recepcao", "/financeiro")).toBe(true);
    expect(rotaPermitida("recepcao", "/equipe")).toBe(false);
    expect(rotaPermitida("dono", "/equipe")).toBe(true);
    expect(rotaPermitida("dono", "/fila")).toBe(true);
  });

  it("banhista só inicia e finaliza; não cancela nem marca falta", () => {
    expect(transicoesDoPapel("banhista", "agendado")).toEqual(["em_atendimento"]);
    expect(transicoesDoPapel("banhista", "em_atendimento")).toEqual(["finalizado"]);
    expect(transicoesDoPapel("dono", "agendado")).toContain("cancelado");
  });
});
