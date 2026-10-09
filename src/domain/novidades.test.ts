import { describe, expect, it } from "vitest";
import { criarSeed } from "@/data/seed";
import { comissaoDoAtendimento, fecharCaixa, mudarStatus, pagarLancamento, porId, venderPlano } from "./rules";
import * as E from "./edicao";
import * as P from "./produtos";
import * as V from "./vacinas";
import * as F from "./fidelidade";
import { brCode, crc16, normalizarChavePix } from "./pix";
import { csvLancamentos, periodoAnterior, periodoDoMes, relatorio, variacao } from "./relatorios";
import { agendaDoDb, agendarNoDb, diasDoCalendario, horariosOnline, pedidosOnlinePendentes, resumoDoPedido } from "./agendamento-online";
import { renderMensagem, modeloPorGatilho, variaveisDaVacina } from "./messages";
import { diaDaSemana, hoje, somaDias } from "./format";

// Terça-feira, 6 de outubro de 2026, 12:00
const AGORA = new Date(2026, 9, 6, 12, 0);
const T = hoje(AGORA);
const d = (n: number) => somaDias(T, n);
const novoDb = () => criarSeed(AGORA);

describe("correções", () => {
  it("pessoa 'sem comissão' não recebe, mesmo com % própria ou do serviço", () => {
    const db = novoDb();
    const atd = porId(db.atendimentos, "a_max")!;
    expect(comissaoDoAtendimento(db, atd)).toBeGreaterThan(0);
    const sem = E.editarMembro(db, "m_bruno", { semComissao: true, comissaoPct: 50 }).db;
    expect(comissaoDoAtendimento(sem, atd)).toBe(0);
  });

  it("plano vencido não trava a venda de um novo e passa a constar como vencido", () => {
    const db = novoDb();
    const r = venderPlano(db, { modeloId: "pm_4banhos", petId: "p_thor", preco: 240, formaPagamento: "pix", inicio: d(10) }, AGORA);
    expect(porId(r.db.planosPet, "pl_thor")!.status).toBe("vencido");
    expect(r.db.planosPet.filter((p) => p.petId === "p_thor" && p.status === "ativo")).toHaveLength(1);
  });

  it("pacote desativado não é vendido", () => {
    const db = E.salvarPacote(novoDb(), { ...porId(novoDb().planosModelo, "pm_2banhos")!, ativo: false }).db;
    expect(() => venderPlano(db, { modeloId: "pm_2banhos", petId: "p_mel", preco: 130, formaPagamento: "pix", inicio: T }, AGORA)).toThrow(/desativado/);
  });
});

describe("edição de cadastros", () => {
  it("pet shop: valida horário, dias, sinal sem chave e endereço da página", () => {
    const db = novoDb();
    expect(() => E.editarPetshop(db, { abre: "18:00", fecha: "08:00" })).toThrow(/fechar/);
    expect(() => E.editarPetshop(db, { diasAbertos: [] })).toThrow(/dia aberto/);
    expect(() => E.editarPetshop(db, { pixChave: "", sinalPct: 30 })).toThrow(/chave Pix/);
    expect(() => E.editarPetshop(db, { slug: "Meu Pet!" })).toThrow(/minúsculas/);
    const r = E.editarPetshop(db, { nome: "  Patinhas  Centro ", whatsapp: "(11) 97520-1421", diasAbertos: [6, 0, 1, 1], slug: "patinhas-centro" });
    expect(r.db.petshop).toMatchObject({ nome: "Patinhas Centro", whatsapp: "5511975201421", diasAbertos: [0, 1, 6], slug: "patinhas-centro" });
    expect(E.slugDoNome("Spike Banho & Tosa")).toBe("spike-banho-tosa");
  });

  it("equipe: não desativa o único dono nem quem tem atendimento em aberto", () => {
    const db = novoDb();
    expect(() => E.editarMembro(db, "m_ana", { ativo: false })).toThrow(/dono ativo/);
    expect(() => E.editarMembro(db, "m_camila", { ativo: false })).toThrow(/em aberto/);
    const r = E.editarMembro(db, "m_rita", { nome: "Rita S.", papel: "banhista", comissaoPct: 35 });
    expect(r.membro).toMatchObject({ nome: "Rita S.", papel: "banhista", comissaoPct: 35 });
  });

  it("cliente: edita com WhatsApp único; só exclui quem não tem histórico", () => {
    const db = novoDb();
    expect(() => E.editarTutor(db, "t_ana", { whatsapp: "5511988776655" })).toThrow(/outro cliente/);
    expect(E.editarTutor(db, "t_ana", { whatsapp: "(11) 90000-1111", email: "ANA@X.COM" }).tutor).toMatchObject({ whatsapp: "5511900001111", email: "ana@x.com" });
    expect(E.bloqueioExcluirTutor(db, "t_ana")).toMatch(/Luna/);
    expect(E.bloqueioExcluirPet(db, "p_toby")).toBeNull();
    const semToby = E.excluirTutor(db, "t_beatriz");
    expect(semToby.tutores.some((t) => t.id === "t_beatriz")).toBe(false);
    expect(semToby.pets.some((p) => p.id === "p_toby")).toBe(false);
    expect(semToby.atendimentos.some((a) => a.id === "a_toby_online")).toBe(false);
    expect(() => E.excluirPet(db, "p_thor")).toThrow(/histórico/);
  });

  it("serviços e pacotes: criar, validar e não desativar serviço usado em pacote", () => {
    const db = novoDb();
    const novo = { ...E.servicoEmBranco(), nome: "Banho de ozônio", categoria: "estetica" as const };
    novo.precos.P.preco = 30;
    const r = E.salvarServico(db, novo);
    expect(r.novo).toBe(true);
    expect(() => E.salvarServico(r.db, { ...novo, id: "outro", nome: "banho de ozônio" })).toThrow(/mesmo nome|Já existe/);
    expect(() => E.salvarServico(db, { ...porId(db.servicos, "s_banho")!, ativo: false })).toThrow(/pacote/);
    expect(() => E.salvarPacote(db, { id: "x", nome: "Vazio", servicoIds: [], quantidadeUsos: 4, validadeDias: 30, preco: 100, ativo: true })).toThrow(/serviço/);
    expect(E.salvarPacote(db, { id: "x", nome: "Pacote 8 banhos", servicoIds: ["s_banho"], quantidadeUsos: 8, validadeDias: 60, preco: 420, ativo: true }).novo).toBe(true);
  });

  it("cancelar plano: devolução vira despesa e o agendamento coberto passa a ser cobrado", () => {
    const db = novoDb();
    expect(porId(db.atendimentos, "a_bidu")!.valorTotal).toBe(0);
    const r = E.cancelarPlano(db, { planoId: "pl_bidu", devolucao: 100, formaPagamento: "pix", motivo: "mudou de cidade" }, AGORA);
    expect(porId(r.db.planosPet, "pl_bidu")!.status).toBe("cancelado");
    expect(r.despesa).toMatchObject({ tipo: "despesa", valor: 100, categoria: "Devoluções" });
    const bidu = porId(r.db.atendimentos, "a_bidu")!;
    expect(bidu.planoPetId).toBeUndefined();
    expect(bidu.valorTotal).toBe(60);
    expect(() => E.cancelarPlano(db, { planoId: "pl_bidu", devolucao: 999, formaPagamento: "pix" }, AGORA)).toThrow(/devolução/);
  });

  it("desfazer uso: saldo volta e plano encerrado reabre", () => {
    const db = novoDb();
    const usos = db.planoUsos.filter((u) => u.planoPetId === "pl_pipoca");
    const novo = E.desfazerUso(db, usos[0].id);
    expect(novo.planoUsos.find((u) => u.id === usos[0].id)!.estornado).toBe(true);
    expect(() => E.desfazerUso(novo, usos[0].id)).toThrow(/já foi desfeito/);
  });
});

describe("atendimento: reagendar, serviços, sinal", () => {
  it("reagenda com checagem de conflito e refaz o valor quando muda o serviço", () => {
    const db = novoDb();
    expect(() => E.editarAtendimento(db, "a_mel", { hora: "10:00", profissionalId: "m_bruno" })).toThrow(/Conflito/);
    const r = E.editarAtendimento(db, "a_mel", { hora: "16:00", servicoIds: ["s_banho", "s_hidratacao"], desconto: 10, observacoes: "Trazer laço" });
    expect(r.itensMudaram).toBe(true);
    expect(r.atendimento).toMatchObject({ hora: "16:00", desconto: 10, valorTotal: 90, duracaoMin: 80, observacoes: "Trazer laço" });
    expect(() => E.editarAtendimento(db, "a_mel", { desconto: 500 })).toThrow(/desconto/);
    expect(() => E.editarAtendimento(db, "a_thor", { hora: "15:00" })).toThrow(/iniciado/);
    expect(() => E.editarAtendimento(db, "a_max", { observacoes: "x" })).toThrow(/encerrado/);
    expect(() => E.editarAtendimento(db, "a_mel", { data: d(5) })).toThrow(/não abre/); // domingo
  });

  it("sinal do agendamento online entra no caixa e é descontado ao finalizar", () => {
    let db = novoDb();
    const toby = porId(db.atendimentos, "a_toby_online")!;
    expect(toby).toMatchObject({ origem: "portal", sinalValor: 17, sinalPago: false, valorTotal: 85 });
    const s = E.registrarSinal(db, toby.id, "pix", AGORA);
    expect(s.lancamento).toMatchObject({ categoria: "Sinal", valor: 17, status: "pago", atendimentoId: toby.id });
    db = s.db;
    expect(() => E.registrarSinal(db, toby.id, "pix", AGORA)).toThrow(/já foi/);
    db = mudarStatus(db, toby.id, "em_atendimento", "m_jessica", AGORA).db;
    const f = mudarStatus(db, toby.id, "finalizado", "m_jessica", AGORA);
    expect(f.efeitos.receitaCriada!.valor).toBe(68);
  });
});

describe("financeiro: receita avulsa, estorno e exclusão", () => {
  it("estorna recebimento, mas não depois do caixa fechado", () => {
    let db = novoDb();
    const luna = db.lancamentos.find((l) => l.atendimentoId === "a_luna_1")!;
    db = E.estornarPagamento(db, luna.id);
    expect(porId(db.lancamentos, luna.id)).toMatchObject({ status: "pendente", pagoEm: undefined });
    expect(porId(db.atendimentos, "a_luna_1")!.pago).toBe(false);
    const nina = db.lancamentos.find((l) => l.atendimentoId === "a_nina")!;
    const fechado = fecharCaixa(db, T, "m_ana", AGORA);
    expect(() => E.estornarPagamento(fechado, nina.id)).toThrow(/caixa/);
    expect(() => E.estornarPagamento(db, "lanc_plano_bidu")).toThrow(/plano/);
  });

  it("exclui só lançamento manual; receita avulsa pode ficar a receber", () => {
    const db = novoDb();
    expect(E.excluirLancamento(db, "lanc_desp_higiene").lancamentos.some((l) => l.id === "lanc_desp_higiene")).toBe(false);
    expect(() => E.excluirLancamento(db, db.lancamentos.find((l) => l.atendimentoId === "a_nina")!.id)).toThrow(/estorne/);
    const r = E.lancarReceita(db, { descricao: "Hospedagem fim de semana", categoria: "Hotel", valor: 150 }, AGORA);
    expect(r.lancamento).toMatchObject({ status: "pendente", valor: 150, categoria: "Hotel" });
  });

  it("modelo de mensagem: título, texto e liga/desliga", () => {
    const db = novoDb();
    const m = modeloPorGatilho(db, "feedback")!;
    expect(E.editarModelo(db, m.id, { ativo: false, titulo: "Pesquisa" }).modelo).toMatchObject({ ativo: false, titulo: "Pesquisa" });
    expect(() => E.editarModelo(db, m.id, { texto: "" })).toThrow(/texto/);
  });

  it("etapa: tira só a foto ou a etapa inteira; transporte só perde a foto", () => {
    const db = novoDb();
    const comFoto = db.etapas.find((e) => e.id === "et_a_max_pronto")!;
    expect(E.removerEtapa(db, comFoto.id, true).etapas.find((e) => e.id === comFoto.id)!.fotoUrl).toBeUndefined();
    expect(E.removerEtapa(db, comFoto.id, false).etapas.some((e) => e.id === comFoto.id)).toBe(false);
    expect(() => E.removerEtapa(db, "et_a_thor_pet_buscado", false)).toThrow(/leva e traz/);
  });
});

describe("produtos e estoque", () => {
  it("venda no balcão baixa o estoque e lança a receita; acima do estoque é bloqueada", () => {
    const db = novoDb();
    const antes = porId(db.produtos, "pr_shampoo")!.estoque;
    const r = P.registrarVenda(db, { itens: [{ produtoId: "pr_shampoo", quantidade: 2 }, { produtoId: "pr_bifinho", quantidade: 1 }], desconto: 2.7, formaPagamento: "pix" }, AGORA);
    expect(r.venda.total).toBe(90);
    expect(r.lancamento).toMatchObject({ categoria: "Produtos", valor: 90, status: "pago" });
    expect(porId(r.db.produtos, "pr_shampoo")!.estoque).toBe(antes - 2);
    expect(() => P.registrarVenda(db, { itens: [{ produtoId: "pr_perfume", quantidade: 50 }], formaPagamento: "pix" }, AGORA)).toThrow(/Estoque/);
    expect(() => P.registrarVenda(db, { itens: [{ produtoId: "pr_bifinho", quantidade: 1 }] }, AGORA)).toThrow(/cliente/);
  });

  it("venda a receber vira paga ao receber; cancelar devolve o estoque", () => {
    let db = novoDb();
    const r = P.registrarVenda(db, { itens: [{ produtoId: "pr_escova", quantidade: 1 }], atendimentoId: "a_luna" }, AGORA);
    expect(r.venda).toMatchObject({ status: "pendente", tutorId: "t_ana" });
    db = pagarLancamento(r.db, r.lancamento!.id, "dinheiro", AGORA);
    expect(porId(db.vendas, r.venda.id)!.status).toBe("pago");
    const c = P.cancelarVenda(db, r.venda.id, AGORA);
    expect(c.despesa).toMatchObject({ valor: 34.9, categoria: "Devoluções" });
    expect(porId(c.db.produtos, "pr_escova")!.estoque).toBe(porId(novoDb().produtos, "pr_escova")!.estoque);

    const pend = P.registrarVenda(novoDb(), { itens: [{ produtoId: "pr_bifinho", quantidade: 1 }], tutorId: "t_carlos" }, AGORA);
    const c2 = P.cancelarVenda(pend.db, pend.venda.id, AGORA);
    expect(c2.removerLancamento).toBe(pend.lancamento!.id);
    expect(c2.db.lancamentos.some((l) => l.id === pend.lancamento!.id)).toBe(false);
  });

  it("entrada com compra no caixa, ajuste por contagem, estoque mínimo e cadastro com estoque inicial", () => {
    const db = novoDb();
    expect(P.produtosAbaixoDoMinimo(db).map((p) => p.id)).toContain("pr_perfume");
    const e = P.entradaEstoque(db, { produtoId: "pr_perfume", quantidade: 10, custoUnitario: 11, despesaForma: "pix" }, AGORA);
    expect(porId(e.db.produtos, "pr_perfume")).toMatchObject({ estoque: 12, custo: 11 });
    expect(e.despesa).toMatchObject({ valor: 110, tipo: "despesa" });
    const a = P.ajustarEstoque(e.db, { produtoId: "pr_perfume", saldoReal: 11 }, AGORA);
    expect(a.movimento.quantidade).toBe(-1);
    expect(() => P.ajustarEstoque(a.db, { produtoId: "pr_perfume", saldoReal: 11 }, AGORA)).toThrow(/já é/);
    const novo = P.salvarProduto(db, { ...P.produtoEmBranco(), nome: "Gravatinha", precoVenda: 8 }, AGORA, 20);
    expect(novo.produto.estoque).toBe(20);
    expect(novo.movimento?.tipo).toBe("entrada");
    expect(P.margem({ precoVenda: 40, custo: 18 })).toBe(55);
  });
});

describe("vacinas", () => {
  it("lista as vencidas e as que vencem em 15 dias, mais urgentes primeiro", () => {
    const db = novoDb();
    expect(V.vacinasVencendo(db, T).map((v) => v.id)).toEqual(["vac_luna_raiva", "vac_thor_v10", "vac_mel_verm"]);
    expect(V.situacao(porId(db.vacinas, "vac_max_pulgas")!, T)).toBe("em_dia");
    expect(V.textoVencimento(d(1), T)).toBe("amanhã");
    expect(V.textoVencimento(d(-3), T)).toBe("desde 03/10");
  });

  it("nova dose substitui a antiga no aviso e o lembrete usa as variáveis da vacina", () => {
    let db = novoDb();
    db = V.salvarVacina(db, { petId: "p_luna", tipo: "vacina", nome: "Antirrábica", aplicadaEm: T, proximaEm: d(365) }).db;
    expect(V.vacinasVencendo(db, T).map((v) => v.petId)).not.toContain("p_luna");
    expect(() => V.salvarVacina(db, { petId: "p_luna", tipo: "vacina", nome: "V10", aplicadaEm: T, proximaEm: d(-1) })).toThrow(/antes/);
    const v = porId(db.vacinas, "vac_thor_v10")!;
    const texto = renderMensagem(modeloPorGatilho(db, "vacina")!.texto, variaveisDaVacina(db, v, T));
    expect(texto).toBe("Olá, Carlos! A V10 (polivalente) de Thor vence em 11/10. Mantenha a carteirinha em dia: é importante para a saúde dele e para o banho aqui na Patinhas Pet Shop.");
    expect(V.proximaSugerida("Antirrábica", T)).toBe(d(365));
  });
});

describe("fidelidade", () => {
  it("Luna completou o cartão; o prêmio vira desconto e zera os selos", () => {
    let db = novoDb();
    expect(F.selos(db, "p_luna")).toBe(10);
    expect(F.cartao(db, "p_luna")).toMatchObject({ completo: true, meta: 10 });
    expect(F.petsComPremio(db).map((x) => x.petId)).toEqual(["p_luna"]);
    const r = F.resgatar(db, "a_luna", AGORA);
    expect(r.resgate.valor).toBe(80);
    expect(r.atendimento).toMatchObject({ valorTotal: 0, desconto: 80 });
    db = r.db;
    expect(F.selos(db, "p_luna")).toBe(0);
    expect(() => F.resgatar(db, "a_luna", AGORA)).toThrow(/já foi usado/);

    const desfeito = F.desfazerResgate(db, "a_luna");
    expect(porId(desfeito.db.atendimentos, "a_luna")!.valorTotal).toBe(80);
    expect(F.selos(desfeito.db, "p_luna")).toBe(10);

    // Cancelou: o prêmio volta para o cartão.
    const cancelado = mudarStatus(db, "a_luna", "cancelado", "m_ana", AGORA).db;
    expect(F.selos(cancelado, "p_luna")).toBe(10);

    // Finalizou com o prêmio: nada a receber, e o atendimento do prêmio não vira selo.
    db = mudarStatus(db, "a_luna", "em_atendimento", "m_camila", AGORA).db;
    const fin = mudarStatus(db, "a_luna", "finalizado", "m_camila", AGORA);
    expect(fin.efeitos.receitaCriada).toBeUndefined();
    expect(porId(fin.db.atendimentos, "a_luna")!.pago).toBe(true);
    expect(F.selos(fin.db, "p_luna")).toBe(0);
  });

  it("cartão incompleto ou desligado não resgata; plano não conta selo", () => {
    const db = novoDb();
    expect(() => F.resgatar(db, "a_mel", AGORA)).toThrow(/completo/);
    expect(F.selos(db, "p_thor")).toBe(0); // banhos do plano
    const off = E.editarPetshop(db, { fidelidadeAtiva: false }).db;
    expect(() => F.resgatar(off, "a_luna", AGORA)).toThrow(/desligado/);
  });
});

describe("Pix copia e cola", () => {
  it("reproduz o exemplo do Banco Central (CRC 1D3D)", () => {
    const codigo = brCode({ chave: "123e4567-e12b-12d1-a456-426655440000", nome: "Fulano de Tal", cidade: "BRASILIA" });
    expect(codigo).toBe("00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D");
  });

  it("com valor, nome com acento e identificador; o CRC confere", () => {
    const c = brCode({ chave: "(11) 97520-1421", nome: "Spike Banho & Tosa São Paulo Centro", cidade: "São Paulo", valor: 17, txid: "SINAL-ab12" });
    expect(c).toContain("0114+5511975201421");
    expect(c).toContain("540517.00");
    expect(c).toContain("5925Spike Banho Tosa Sao Paul6009Sao Paulo");
    expect(c).toContain("0509SINALab12");
    expect(crc16(c.slice(0, -4))).toBe(c.slice(-4));
  });

  it("reconhece o tipo da chave", () => {
    expect(normalizarChavePix("529.982.247-25")).toEqual({ tipo: "cpf", chave: "52998224725" });
    expect(normalizarChavePix("11.222.333/0001-81")).toEqual({ tipo: "cnpj", chave: "11222333000181" });
    expect(normalizarChavePix("Loja@Pet.com")).toEqual({ tipo: "email", chave: "loja@pet.com" });
    expect(normalizarChavePix("+55 11 97520-1421")).toEqual({ tipo: "celular", chave: "+5511975201421" });
    expect(normalizarChavePix("123")).toBeNull();
  });
});

describe("relatórios", () => {
  it("dia de hoje: recebido, gasto, atendimentos e ticket médio", () => {
    const r = relatorio(novoDb(), { de: T, ate: T });
    expect(r.recebido).toBe(480);
    expect(r.gasto).toBe(120);
    expect(r.atendimentos).toBe(2);
    expect(r.ticketMedio).toBe(r.faturamentoServicos / 2);
    expect(r.porCategoriaReceita.map((x) => x.nome)).toContain("Planos");
    expect(r.equipe.map((x) => x.membroId).sort()).toEqual(["m_bruno", "m_jessica"]);
  });

  it("mês: produtos, clientes e comparação com o período anterior", () => {
    const db = novoDb();
    const mes = periodoDoMes(T);
    expect(mes).toEqual({ de: "2026-10-01", ate: "2026-10-31" });
    expect(periodoDoMes(T, -1)).toEqual({ de: "2026-09-01", ate: "2026-09-30" });
    expect(periodoAnterior({ de: "2026-10-01", ate: "2026-10-07" })).toEqual({ de: "2026-09-24", ate: "2026-09-30" });
    const r = relatorio(db, { de: d(-30), ate: T });
    expect(r.produtos.length).toBeGreaterThan(0);
    expect(r.clientes[0].valor).toBeGreaterThan(0);
    expect(variacao(120, 100)).toBe(20);
    expect(variacao(10, 0)).toBeUndefined();
    const csv = csvLancamentos(db, { de: T, ate: T });
    expect(csv.split("\r\n")[0]).toContain("Data;Tipo;Categoria");
  });
});

describe("agendamento online", () => {
  it("calendário só com dias abertos e horários com antecedência e equipe livre", () => {
    const db = novoDb();
    const agenda = agendaDoDb(db, T);
    expect(agenda.petshop.sinalPct).toBe(20);
    const dias = diasDoCalendario(agenda, T, 7);
    expect(dias.every((x) => diaDaSemana(x) !== 0)).toBe(true);
    const hojeSlots = horariosOnline(agenda, T, 60, AGORA);
    expect(hojeSlots[0]).toBe("12:30");
    expect(horariosOnline(agenda, d(5), 60, AGORA)).toEqual([]); // domingo
    expect(resumoDoPedido(agenda, "P", ["s_banho", "s_hidratacao"])).toEqual({ total: 85, duracao: 65, sinal: 17 });
  });

  it("pedido cria tutor e pet, escolhe banhista livre e pede sinal", () => {
    const db = novoDb();
    const r = agendarNoDb(
      db,
      { nome: "joana ribeiro", whatsapp: "(11) 96666-5555", pet: "fifi", especie: "cao", porte: "P", servicos: ["s_banho"], data: d(1), hora: "14:00", aceite: true },
      AGORA,
    );
    expect(r.confirmacao).toMatchObject({ total: 50, sinal: 10, pixChave: "pix@patinhas.exemplo.com" });
    const atd = r.db.atendimentos.find((a) => a.token === r.confirmacao.token)!;
    expect(atd).toMatchObject({ origem: "portal", status: "agendado", sinalValor: 10 });
    expect(porId(r.db.membros, atd.profissionalId)!.papel).toBe("banhista");
    expect(porId(r.db.tutores, atd.tutorId)!.nome).toBe("Joana Ribeiro");
    expect(pedidosOnlinePendentes(r.db, T).map((a) => a.id)).toContain(atd.id);
    expect(() => agendarNoDb(db, { nome: "x", whatsapp: "1", pet: "", especie: "cao", porte: "P", servicos: [], data: "", hora: "", aceite: false }, AGORA)).toThrow();
    const desligado = E.editarPetshop(db, { agendamentoOnline: false }).db;
    expect(() => agendarNoDb(desligado, { nome: "Joana", whatsapp: "11966665555", pet: "Fifi", especie: "cao", porte: "P", servicos: ["s_banho"], data: d(1), hora: "14:00", aceite: true }, AGORA)).toThrow(/desligado/);
  });
});
