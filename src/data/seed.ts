// Dados fictícios para o protótipo. Tudo é relativo ao dia de hoje,
// então a agenda sempre abre com movimento.

import type {
  Atendimento,
  AtendimentoEtapa,
  AtendimentoItem,
  Db,
  Etapa,
  Lancamento,
  MovimentoEstoque,
  Pet,
  PlanoPet,
  PlanoUso,
  Porte,
  Posicao,
  Produto,
  Servico,
  Transporte,
  Tutor,
  Vacina,
  Venda,
} from "@/domain/types";
import { hoje as hojeIso, somaDias } from "@/domain/format";
import { MODELOS_PADRAO } from "@/domain/messages";

function iso(data: string, hora: string): string {
  const [a, m, d] = data.split("-").map(Number);
  const [h, mi] = hora.split(":").map(Number);
  return new Date(a, m - 1, d, h, mi).toISOString();
}

const precos = (p: [number, number], m: [number, number], g: [number, number], gg: [number, number]): Servico["precos"] => ({
  P: { preco: p[0], duracaoMin: p[1] },
  M: { preco: m[0], duracaoMin: m[1] },
  G: { preco: g[0], duracaoMin: g[1] },
  GG: { preco: gg[0], duracaoMin: gg[1] },
});

export const SERVICOS: Servico[] = [
  { id: "s_banho", nome: "Banho", categoria: "banho", precos: precos([50, 45], [60, 60], [80, 60], [100, 75]), comissaoPct: 40, ativo: true },
  { id: "s_banho_tosa", nome: "Banho e tosa", categoria: "tosa", precos: precos([80, 60], [95, 75], [120, 90], [150, 120]), comissaoPct: 40, ativo: true },
  { id: "s_tosa_hig", nome: "Tosa higiênica", categoria: "tosa", precos: precos([40, 30], [45, 30], [55, 45], [65, 45]), comissaoPct: 40, ativo: true },
  { id: "s_hidratacao", nome: "Hidratação", categoria: "estetica", precos: precos([35, 20], [40, 20], [50, 30], [60, 30]), comissaoPct: 30, ativo: true },
  { id: "s_unhas", nome: "Corte de unhas", categoria: "outros", precos: precos([20, 15], [20, 15], [25, 15], [25, 15]), comissaoPct: 30, ativo: true },
  { id: "s_ouvidos", nome: "Limpeza de ouvidos", categoria: "outros", precos: precos([15, 10], [15, 10], [20, 10], [20, 10]), comissaoPct: 30, ativo: true },
];

export function criarSeed(agora: Date = new Date()): Db {
  const T = hojeIso(agora);
  const d = (n: number) => somaDias(T, n);

  const tutores: Tutor[] = [
    ["t_ana", "Ana Souza", "5511991234567"],
    ["t_carlos", "Carlos Lima", "5511988776655"],
    ["t_fernanda", "Fernanda Alves", "5511977665544"],
    ["t_juliana", "Juliana Prado", "5511966554433"],
    ["t_rafael", "Rafael Costa", "5511955443322"],
    ["t_marcos", "Marcos Teixeira", "5511944332211"],
    ["t_patricia", "Patrícia Gomes", "5511933221100"],
    ["t_eduardo", "Eduardo Nunes", "5511922110099"],
    ["t_lucia", "Lúcia Ramos", "5511911009988"],
    ["t_paulo", "Paulo Mendes", "5511900998877"],
    ["t_beatriz", "Beatriz Cardoso", "5511987001122"],
  ].map(([id, nome, whatsapp], i) => ({
    id,
    nome,
    whatsapp,
    endereco: i % 2 === 0 ? "Rua das Acácias, 120 · São Mateus" : undefined,
    consentimentoWhatsapp: true,
    criadoEm: iso(d(-120 + i * 7), "10:00"),
  }));

  // Fotos de banco gratuito (Pexels) em public/fotos/pets, só na demonstração.
  const pet = (p: Partial<Pet> & Pick<Pet, "id" | "tutorId" | "nome" | "raca" | "porte">): Pet => ({
    especie: "cao",
    fotoUrl: `/fotos/pets/${p.id.replace("p_", "")}.webp`,
    ...p,
  });
  const pets: Pet[] = [
    pet({ id: "p_luna", tutorId: "t_ana", nome: "Luna", raca: "Maltês", porte: "P", sexo: "F", pesoKg: 3.4, pelagem: "Longa, branca", temperamento: "Dócil", ultimaVisita: d(-14) }),
    pet({
      id: "p_thor", tutorId: "t_carlos", nome: "Thor", raca: "Golden Retriever", porte: "G", sexo: "M", pesoKg: 32,
      pelagem: "Longa, dourada", temperamento: "Manso", alergias: "perfume", cuidados: "Evitar fragrâncias.",
      observacoes: "Prefere secagem em temperatura morna.", ultimaVisita: d(-10),
    }),
    pet({ id: "p_mel", tutorId: "t_fernanda", nome: "Mel", raca: "Cavalier King Charles", porte: "M", sexo: "F", pesoKg: 7.5, pelagem: "Média, ondulada", temperamento: "Agitada", observacoes: "Pet agitado na secagem.", ultimaVisita: d(-21) }),
    pet({ id: "p_pipoca", tutorId: "t_juliana", nome: "Pipoca", raca: "Poodle", porte: "P", sexo: "F", pesoKg: 4.1, pelagem: "Encaracolada", temperamento: "Brincalhona", ultimaVisita: d(-6) }),
    pet({ id: "p_nina", tutorId: "t_juliana", nome: "Nina", raca: "Spitz Alemão", porte: "P", sexo: "F", pesoKg: 2.9, pelagem: "Dupla, volumosa", temperamento: "Medrosa", cuidados: "Secador em velocidade baixa.", ultimaVisita: d(-28) }),
    pet({ id: "p_max", tutorId: "t_rafael", nome: "Max", raca: "Labrador", porte: "G", sexo: "M", pesoKg: 30, pelagem: "Curta", temperamento: "Agitado", ultimaVisita: d(-30) }),
    pet({ id: "p_bidu", tutorId: "t_marcos", nome: "Bidu", raca: "Sem raça definida", porte: "M", sexo: "M", pesoKg: 12, pelagem: "Curta, caramelo", temperamento: "Manso", ultimaVisita: d(-35) }),
    pet({ id: "p_fred", tutorId: "t_patricia", nome: "Fred", raca: "Bulldog Francês", porte: "M", sexo: "M", pesoKg: 11, pelagem: "Curta", temperamento: "Dócil", cuidados: "Braquicefálico: secagem com pausas.", ultimaVisita: d(-15) }),
    pet({ id: "p_pingo", tutorId: "t_eduardo", nome: "Pingo", raca: "Yorkshire", porte: "P", sexo: "M", pesoKg: 2.6, pelagem: "Longa, sedosa", temperamento: "Dócil", ultimaVisita: d(-1) }),
    pet({ id: "p_amora", tutorId: "t_lucia", nome: "Amora", raca: "Lhasa Apso", porte: "P", sexo: "F", pesoKg: 6, pelagem: "Longa", temperamento: "Dócil", ultimaVisita: d(-52) }),
    pet({ id: "p_simba", tutorId: "t_paulo", nome: "Simba", especie: "gato", raca: "Persa", porte: "P", sexo: "M", pesoKg: 4.8, pelagem: "Longa", temperamento: "Arisco", alergias: "shampoo com corante", ultimaVisita: d(-40) }),
    // Chegou pelo agendamento online: sem foto ainda.
    { id: "p_toby", tutorId: "t_beatriz", nome: "Toby", especie: "cao", raca: "Shih Tzu", porte: "P" },
  ];

  const servico = (id: string) => SERVICOS.find((s) => s.id === id)!;
  const porteDe = (petId: string): Porte => pets.find((p) => p.id === petId)!.porte;
  const itens = (petId: string, ids: string[], cobertoId?: string): AtendimentoItem[] =>
    ids.map((sid) => {
      const s = servico(sid);
      const { preco, duracaoMin } = s.precos[porteDe(petId)];
      return { servicoId: sid, nome: s.nome, preco, duracaoMin, cobertoPorPlano: sid === cobertoId };
    });

  const atendimentos: Atendimento[] = [];
  const lancamentos: Lancamento[] = [];
  const planoUsos: PlanoUso[] = [];
  const etapas: AtendimentoEtapa[] = [];
  const posicoes: Posicao[] = [];

  function atd(o: {
    id: string; petId: string; prof: string; data: string; hora: string; servicos: string[];
    status: Atendimento["status"]; plano?: string; pagoEm?: string; forma?: Lancamento["formaPagamento"];
    transporte?: Transporte; endereco?: string; motorista?: string; origem?: Atendimento["origem"]; sinal?: number;
    /** Etapas já registradas: [etapa, "HH:MM", foto?, nota?] */
    etapas?: [Etapa, string, string?, string?][];
  }) {
    const p = pets.find((x) => x.id === o.petId)!;
    const its = itens(o.petId, o.servicos, o.plano ? o.servicos[0] : undefined);
    const valorTotal = its.filter((i) => !i.cobertoPorPlano).reduce((s, i) => s + i.preco, 0);
    const finalizado = o.status === "finalizado";
    const evs: Atendimento["eventos"] = [{ de: null, para: "agendado", porMembroId: "m_ana", em: iso(somaDias(o.data, -3), "10:00") }];
    if (o.status !== "agendado") {
      const caminho: Atendimento["status"][] =
        o.status === "confirmado" ? ["confirmado"]
        : o.status === "em_atendimento" ? ["confirmado", "em_atendimento"]
        : o.status === "finalizado" ? ["confirmado", "em_atendimento", "finalizado"]
        : [o.status];
      let de: Atendimento["status"] = "agendado";
      caminho.forEach((para, i) => {
        evs.push({ de, para, porMembroId: para === "confirmado" ? "m_ana" : o.prof, em: iso(o.data, i === 0 && para === "confirmado" ? "07:50" : o.hora) });
        de = para;
      });
    }
    atendimentos.push({
      id: o.id, petId: p.id, tutorId: p.tutorId, profissionalId: o.prof, data: o.data, hora: o.hora,
      duracaoMin: its.reduce((s, i) => s + i.duracaoMin, 0), status: o.status, origem: o.origem ?? "balcao",
      sinalValor: o.sinal, sinalPago: o.sinal ? false : undefined,
      itens: its, valorTotal, desconto: 0, planoPetId: o.plano, pago: finalizado && (valorTotal === 0 || !!o.pagoEm),
      eventos: evs,
      token: `demo${o.id.replace(/[^a-z0-9]/gi, "")}`.padEnd(32, "0"),
      transporte: o.transporte ?? "nenhum",
      enderecoTransporte: o.transporte ? o.endereco ?? tutores.find((t) => t.id === p.tutorId)?.endereco ?? "Rua das Acácias, 120 · São Mateus" : undefined,
      motoristaId: o.transporte ? o.motorista ?? "m_diego" : undefined,
    });
    for (const [etapa, hora, foto, nota] of o.etapas ?? []) {
      const deTransporte = ["saiu_para_buscar", "pet_buscado", "saiu_para_entregar", "entregue"].includes(etapa);
      etapas.push({ id: `et_${o.id}_${etapa}`, atendimentoId: o.id, etapa, nota, fotoUrl: foto, porMembroId: deTransporte ? "m_diego" : o.prof, em: iso(o.data, hora) });
    }
    if (finalizado && o.plano) {
      planoUsos.push({ id: `uso_${o.id}`, planoPetId: o.plano, atendimentoId: o.id, em: iso(o.data, o.hora), estornado: false });
    }
    if (finalizado && valorTotal > 0) {
      lancamentos.push({
        id: `lanc_${o.id}`, tipo: "receita", categoria: "Serviços",
        descricao: `${p.nome} · ${its.map((i) => i.nome).join(" + ")}`, valor: valorTotal,
        status: o.pagoEm ? "pago" : "pendente", formaPagamento: o.pagoEm ? o.forma ?? "pix" : undefined,
        competencia: o.data, criadoEm: iso(o.data, o.hora), pagoEm: o.pagoEm, atendimentoId: o.id,
      });
    }
  }

  const planosPet: PlanoPet[] = [
    { id: "pl_thor", modeloId: "pm_4banhos", nome: "Pacote 4 banhos", petId: "p_thor", tutorId: "t_carlos", servicoIds: ["s_banho"], totalUsos: 4, preco: 240, inicio: d(-24), vencimento: d(6), status: "ativo", observacoes: "Secagem morna." },
    { id: "pl_pipoca", modeloId: "pm_4banhos", nome: "Pacote 4 banhos", petId: "p_pipoca", tutorId: "t_juliana", servicoIds: ["s_banho"], totalUsos: 4, preco: 180, inicio: d(-20), vencimento: d(10), status: "ativo" },
    { id: "pl_bidu", modeloId: "pm_4banhos", nome: "Pacote 4 banhos", petId: "p_bidu", tutorId: "t_marcos", servicoIds: ["s_banho"], totalUsos: 4, preco: 240, inicio: T, vencimento: d(30), status: "ativo" },
  ];

  // Histórico
  atd({ id: "a_thor_1", petId: "p_thor", prof: "m_bruno", data: d(-17), hora: "10:00", servicos: ["s_banho"], status: "finalizado", plano: "pl_thor" });
  atd({ id: "a_thor_2", petId: "p_thor", prof: "m_bruno", data: d(-10), hora: "10:00", servicos: ["s_banho"], status: "finalizado", plano: "pl_thor" });
  atd({ id: "a_pipoca_1", petId: "p_pipoca", prof: "m_jessica", data: d(-20), hora: "09:00", servicos: ["s_banho"], status: "finalizado", plano: "pl_pipoca" });
  atd({ id: "a_pipoca_2", petId: "p_pipoca", prof: "m_jessica", data: d(-13), hora: "09:00", servicos: ["s_banho"], status: "finalizado", plano: "pl_pipoca" });
  atd({ id: "a_pipoca_3", petId: "p_pipoca", prof: "m_jessica", data: d(-6), hora: "09:00", servicos: ["s_banho"], status: "finalizado", plano: "pl_pipoca" });
  atd({ id: "a_luna_1", petId: "p_luna", prof: "m_camila", data: d(-14), hora: "09:00", servicos: ["s_banho_tosa"], status: "finalizado", pagoEm: iso(d(-14), "10:10"), forma: "pix" });
  atd({ id: "a_mel_1", petId: "p_mel", prof: "m_camila", data: d(-21), hora: "11:00", servicos: ["s_banho"], status: "finalizado", pagoEm: iso(d(-21), "12:05"), forma: "debito" });
  atd({ id: "a_fred_1", petId: "p_fred", prof: "m_jessica", data: d(-15), hora: "15:00", servicos: ["s_banho_tosa"], status: "finalizado", pagoEm: iso(d(-15), "16:20"), forma: "credito" });
  atd({ id: "a_amora_1", petId: "p_amora", prof: "m_camila", data: d(-52), hora: "14:00", servicos: ["s_banho_tosa"], status: "finalizado", pagoEm: iso(d(-52), "15:10"), forma: "dinheiro" });
  atd({ id: "a_simba_1", petId: "p_simba", prof: "m_camila", data: d(-40), hora: "16:00", servicos: ["s_banho"], status: "finalizado", pagoEm: iso(d(-40), "16:50"), forma: "pix" });
  atd({ id: "a_pingo_1", petId: "p_pingo", prof: "m_camila", data: d(-1), hora: "16:00", servicos: ["s_banho_tosa"], status: "finalizado" });
  // Luna é cliente fiel: com o banho de hoje ela completa o cartão fidelidade (10 selos).
  for (let i = 1; i <= 9; i++) {
    const dia = d(-14 - i * 14);
    atd({ id: `a_luna_h${i}`, petId: "p_luna", prof: i % 2 ? "m_camila" : "m_jessica", data: dia, hora: "09:00", servicos: [i % 3 ? "s_banho" : "s_banho_tosa"], status: "finalizado", pagoEm: iso(dia, "10:05"), forma: i % 2 ? "pix" : "credito" });
  }

  // Hoje
  atd({
    id: "a_max", petId: "p_max", prof: "m_bruno", data: T, hora: "08:00", servicos: ["s_banho_tosa"], status: "finalizado", pagoEm: iso(T, "09:35"), forma: "pix",
    transporte: "entrega", endereco: "Av. Mateo Bei, 2300 · São Mateus",
    etapas: [["chegou", "07:55", undefined, "Chegou animado, já pedindo carinho."], ["banho", "08:10", "/fotos/fila-banho.webp"], ["secagem", "08:40"], ["tosa", "09:00"], ["pronto", "09:30", "/fotos/pets/max.webp", "Cheiroso e de laço novo!"], ["saiu_para_entregar", "09:50"]],
  });
  // O carro do Max está na rua agora: a tutora vê o mapa se mexendo na demonstração.
  posicoes.push({ atendimentoId: "a_max", lat: -23.6015, lng: -46.4737, precisao: 14, em: new Date(agora.getTime() - 20_000).toISOString() });
  atd({ id: "a_nina", petId: "p_nina", prof: "m_jessica", data: T, hora: "08:00", servicos: ["s_banho", "s_hidratacao", "s_unhas", "s_ouvidos"], status: "finalizado", pagoEm: iso(T, "09:40"), forma: "dinheiro" });
  atd({ id: "a_luna", petId: "p_luna", prof: "m_camila", data: T, hora: "09:00", servicos: ["s_banho_tosa"], status: "confirmado" });
  atd({
    id: "a_thor", petId: "p_thor", prof: "m_bruno", data: T, hora: "10:00", servicos: ["s_banho"], status: "em_atendimento", plano: "pl_thor",
    transporte: "busca_e_entrega", endereco: "Rua das Acácias, 120 · São Mateus",
    etapas: [["saiu_para_buscar", "09:20"], ["pet_buscado", "09:38", "/fotos/pets/thor.webp", "Entrou no carro abanando o rabo."], ["chegou", "09:55"], ["banho", "10:08", undefined, "Shampoo sem perfume, como pedido."]],
  });
  atd({ id: "a_pipoca", petId: "p_pipoca", prof: "m_jessica", data: T, hora: "10:00", servicos: ["s_banho"], status: "em_atendimento", plano: "pl_pipoca", etapas: [["chegou", "09:50"], ["banho", "10:05", "/fotos/pets/pipoca.webp"]] });
  atd({ id: "a_mel", petId: "p_mel", prof: "m_camila", data: T, hora: "11:00", servicos: ["s_banho"], status: "agendado" });
  atd({ id: "a_bidu", petId: "p_bidu", prof: "m_bruno", data: T, hora: "14:00", servicos: ["s_banho"], status: "agendado", plano: "pl_bidu" });
  atd({ id: "a_fred", petId: "p_fred", prof: "m_jessica", data: T, hora: "15:30", servicos: ["s_banho_tosa"], status: "agendado", transporte: "busca", endereco: "Rua Dr. Luís Aires, 85 · São Mateus" });

  // Próximos dias
  atd({ id: "a_luna_prox", petId: "p_luna", prof: "m_camila", data: d(1), hora: "09:00", servicos: ["s_banho"], status: "agendado" });
  atd({ id: "a_max_prox", petId: "p_max", prof: "m_bruno", data: d(2), hora: "13:00", servicos: ["s_banho", "s_unhas"], status: "agendado" });
  // Pedido que chegou pela página de agendamento online, com sinal de 20% a conferir.
  atd({ id: "a_toby_online", petId: "p_toby", prof: "m_jessica", data: d(1), hora: "10:00", servicos: ["s_banho", "s_hidratacao"], status: "agendado", origem: "portal", sinal: 17 });

  lancamentos.push(
    { id: "lanc_plano_bidu", tipo: "receita", categoria: "Planos", descricao: "Venda de plano · Bidu", valor: 240, formaPagamento: "pix", status: "pago", competencia: T, criadoEm: iso(T, "08:15"), pagoEm: iso(T, "08:15"), planoPetId: "pl_bidu" },
    { id: "lanc_desp_higiene", tipo: "despesa", categoria: "Produtos", descricao: "Produtos de higiene", valor: 120, formaPagamento: "debito", status: "pago", competencia: T, criadoEm: iso(T, "08:30"), pagoEm: iso(T, "08:30") },
  );

  // Produtos, estoque e vendas
  const produto = (id: string, nome: string, categoria: string, precoVenda: number, custo: number, inicial: number, estoqueMinimo: number, unidade = "un"): Produto => ({
    id, nome, categoria, precoVenda, custo, estoque: inicial, estoqueMinimo, unidade, ativo: true, criadoEm: iso(d(-60), "09:00"),
  });
  const produtos: Produto[] = [
    produto("pr_shampoo", "Shampoo neutro 500 ml", "Higiene", 39.9, 18, 14, 4),
    produto("pr_perfume", "Colônia pet 120 ml", "Higiene", 29.9, 12, 3, 4),
    produto("pr_bifinho", "Bifinho de carne 65 g", "Petiscos", 12.9, 6.5, 30, 10),
    produto("pr_laco", "Laço de cabelo (kit 10)", "Acessórios", 15, 5, 25, 5, "pct"),
    produto("pr_escova", "Escova rasqueadeira", "Acessórios", 34.9, 17, 6, 2),
    produto("pr_antipulgas", "Coleira antipulgas", "Farmácia", 89.9, 52, 5, 2),
    produto("pr_racao", "Ração premium 1 kg", "Alimentação", 32, 21, 12, 5, "pct"),
  ];
  const movimentos: MovimentoEstoque[] = produtos.map((p) => ({
    id: `mov_ini_${p.id}`, produtoId: p.id, tipo: "entrada", quantidade: p.estoque, custoUnitario: p.custo, observacao: "Estoque inicial", porMembroId: "m_ana", em: p.criadoEm,
  }));
  const vendas: Venda[] = [];
  function vender(id: string, quando: string, itens: [string, number][], o: { forma?: Lancamento["formaPagamento"]; tutor?: string; atendimento?: string } = {}) {
    const its = itens.map(([pid, q]) => {
      const p = produtos.find((x) => x.id === pid)!;
      return { produtoId: pid, nome: p.nome, quantidade: q, preco: p.precoVenda };
    });
    const total = Math.round(its.reduce((s, i) => s + i.preco * i.quantidade, 0) * 100) / 100;
    const lancId = `lanc_${id}`;
    lancamentos.push({
      id: lancId, tipo: "receita", categoria: "Produtos", descricao: its.map((i) => (i.quantidade === 1 ? i.nome : `${i.quantidade}× ${i.nome}`)).join(", "),
      valor: total, formaPagamento: o.forma, status: o.forma ? "pago" : "pendente", competencia: quando.slice(0, 10), criadoEm: quando, pagoEm: o.forma ? quando : undefined,
    });
    vendas.push({ id, tutorId: o.tutor, atendimentoId: o.atendimento, itens: its, total, desconto: 0, status: o.forma ? "pago" : "pendente", formaPagamento: o.forma, porMembroId: "m_rita", lancamentoId: lancId, criadoEm: quando });
    for (const i of its) {
      movimentos.push({ id: `mov_${id}_${i.produtoId}`, produtoId: i.produtoId, tipo: "venda", quantidade: -i.quantidade, vendaId: id, porMembroId: "m_rita", em: quando });
      const p = produtos.find((x) => x.id === i.produtoId)!;
      p.estoque -= i.quantidade;
    }
  }
  vender("v_1", iso(d(-14), "10:12"), [["pr_shampoo", 1], ["pr_bifinho", 2]], { forma: "pix", tutor: "t_ana", atendimento: "a_luna_1" });
  vender("v_2", iso(d(-6), "17:40"), [["pr_antipulgas", 1]], { forma: "credito", tutor: "t_juliana" });
  vender("v_3", iso(d(-1), "11:20"), [["pr_racao", 2], ["pr_bifinho", 1]], { forma: "dinheiro" });
  vender("v_4", iso(d(-1), "17:05"), [["pr_laco", 1], ["pr_perfume", 1]], { forma: "pix", tutor: "t_eduardo", atendimento: "a_pingo_1" });

  // Carteira de saúde
  const vacinas: Vacina[] = [
    { id: "vac_thor_v10", petId: "p_thor", tipo: "vacina", nome: "V10 (polivalente)", aplicadaEm: d(-360), proximaEm: d(5) },
    { id: "vac_thor_raiva", petId: "p_thor", tipo: "vacina", nome: "Antirrábica", aplicadaEm: d(-200), proximaEm: d(165) },
    { id: "vac_luna_raiva", petId: "p_luna", tipo: "vacina", nome: "Antirrábica", aplicadaEm: d(-368), proximaEm: d(-3), observacao: "Aplicada na clínica do bairro." },
    { id: "vac_mel_verm", petId: "p_mel", tipo: "vermifugo", nome: "Vermífugo", aplicadaEm: d(-80), proximaEm: d(10) },
    { id: "vac_max_pulgas", petId: "p_max", tipo: "antipulgas", nome: "Antipulgas", aplicadaEm: d(-12), proximaEm: d(18) },
  ];

  return {
    petshop: {
      id: "ps_patinhas",
      nome: "Patinhas Pet Shop",
      slug: "patinhas",
      whatsapp: "5511999990000",
      diasAbertos: [1, 2, 3, 4, 5, 6],
      abre: "08:00",
      fecha: "18:00",
      faltaConsomeUso: false,
      diasClienteSumido: 30,
      endereco: "Rua das Acácias, 300 · São Mateus, São Paulo",
      agendamentoOnline: true,
      pixChave: "pix@patinhas.exemplo.com",
      pixCidade: "São Paulo",
      sinalPct: 20,
      fidelidadeAtiva: true,
      fidelidadeMeta: 10,
      fidelidadeServicoIds: [],
      fidelidadePremio: "1 banho grátis",
    },
    usuarioAtualId: "m_ana",
    membros: [
      { id: "m_ana", nome: "Ana Martins", papel: "dono", comissaoPct: 0, ativo: true, temConta: true },
      { id: "m_bruno", nome: "Bruno Rocha", papel: "banhista", comissaoPct: 0, ativo: true, temConta: true },
      { id: "m_jessica", nome: "Jéssica Lima", papel: "banhista", comissaoPct: 0, ativo: true, temConta: true },
      { id: "m_camila", nome: "Camila Reis", papel: "banhista", comissaoPct: 0, ativo: true },
      { id: "m_rita", nome: "Rita Souza", papel: "recepcao", comissaoPct: 0, ativo: true, temConta: true },
      { id: "m_diego", nome: "Diego Prado", papel: "motorista", comissaoPct: 0, ativo: true, temConta: true },
    ],
    tutores,
    pets,
    servicos: SERVICOS,
    atendimentos,
    planosModelo: [
      { id: "pm_4banhos", nome: "Pacote 4 banhos", servicoIds: ["s_banho"], quantidadeUsos: 4, validadeDias: 30, preco: 240, ativo: true },
      { id: "pm_2banhos", nome: "Pacote 2 banhos", servicoIds: ["s_banho"], quantidadeUsos: 2, validadeDias: 30, preco: 130, ativo: true },
      { id: "pm_4banho_tosa", nome: "Pacote 4 banho e tosa", servicoIds: ["s_banho_tosa"], quantidadeUsos: 4, validadeDias: 45, preco: 340, ativo: true },
    ],
    planosPet,
    planoUsos,
    lancamentos,
    caixas: [],
    mensagemModelos: MODELOS_PADRAO,
    mensagensEnvios: [],
    etapas,
    posicoes,
    acertos: [],
    produtos,
    movimentos,
    vendas,
    vacinas,
    resgates: [],
  };
}
