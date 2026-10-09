// Edição e exclusão de cadastros e movimentos: tudo o que se cadastra também se corrige.
// Funções puras sobre o Db, com as mesmas travas que o banco (RLS, constraints) aplica no modo nuvem.

import type { Atendimento, Db, FormaPagamento, Lancamento, Membro, MensagemModelo, Petshop, PlanoModelo, Porte, Servico, Tutor } from "./types";
import { ErroRegra, conflitos, montarItens, petshopAberto, porId, saldoPlano, uid } from "./rules";
import { dataDoIso, minutos } from "./format";

const PORTES: Porte[] = ["P", "M", "G", "GG"];
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
export const SLUG_VALIDO = /^[a-z0-9][a-z0-9-]{2,59}$/;

const limpar = (s: string | undefined) => (s ?? "").trim().replace(/\s+/g, " ");

// ---------------------------------------------------------------------------
// Pet shop
// ---------------------------------------------------------------------------

/** "Patinhas Pet Shop" → "patinhas-pet-shop" (endereço da página de agendamento). */
export function slugDoNome(nome: string): string {
  return (
    nome
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 50) || "petshop"
  );
}

export function validarPetshop(atual: Petshop, dados: Partial<Petshop>): Partial<Petshop> {
  const d: Partial<Petshop> = { ...dados };
  if (d.nome !== undefined) {
    d.nome = limpar(d.nome);
    if (d.nome.length < 2) throw new ErroRegra("Informe o nome do pet shop.");
  }
  if (d.whatsapp !== undefined) {
    d.whatsapp = d.whatsapp.replace(/\D/g, "");
    if (d.whatsapp && d.whatsapp.length <= 11) d.whatsapp = "55" + d.whatsapp;
    if (d.whatsapp && !/^55\d{10,11}$/.test(d.whatsapp)) throw new ErroRegra("WhatsApp do pet shop com DDD, ex.: (11) 97520-1421.");
  }
  if (d.endereco !== undefined) d.endereco = limpar(d.endereco) || undefined;
  if (d.slug !== undefined) {
    d.slug = d.slug.trim().toLowerCase();
    if (!SLUG_VALIDO.test(d.slug)) throw new ErroRegra("Endereço da página: só letras minúsculas, números e hífen (3 a 60).");
  }
  const abre = d.abre ?? atual.abre;
  const fecha = d.fecha ?? atual.fecha;
  if (!HORA.test(abre) || !HORA.test(fecha)) throw new ErroRegra("Horário no formato 08:00.");
  if (minutos(fecha) - minutos(abre) < 60) throw new ErroRegra("O horário de fechar precisa ser pelo menos 1 hora depois de abrir.");
  if (d.diasAbertos !== undefined) {
    d.diasAbertos = [...new Set(d.diasAbertos)].filter((x) => x >= 0 && x <= 6).sort();
    if (d.diasAbertos.length === 0) throw new ErroRegra("Marque pelo menos um dia aberto.");
  }
  if (d.diasClienteSumido !== undefined && !(d.diasClienteSumido >= 7 && d.diasClienteSumido <= 365))
    throw new ErroRegra("Cliente sumido: entre 7 e 365 dias.");
  if (d.pixChave !== undefined) d.pixChave = d.pixChave.trim() || undefined;
  if (d.pixCidade !== undefined) d.pixCidade = limpar(d.pixCidade) || undefined;
  if (d.sinalPct !== undefined) {
    d.sinalPct = Math.round(d.sinalPct);
    if (d.sinalPct < 0 || d.sinalPct > 100) throw new ErroRegra("Sinal entre 0 e 100%.");
  }
  const sinal = d.sinalPct ?? atual.sinalPct;
  const chave = "pixChave" in d ? d.pixChave : atual.pixChave;
  if (sinal > 0 && !chave) throw new ErroRegra("Para pedir sinal, informe a chave Pix que recebe o pagamento.");
  if (d.fidelidadeMeta !== undefined && !(d.fidelidadeMeta >= 2 && d.fidelidadeMeta <= 50))
    throw new ErroRegra("Cartão fidelidade: de 2 a 50 selos.");
  if (d.fidelidadePremio !== undefined) {
    d.fidelidadePremio = limpar(d.fidelidadePremio);
    if (!d.fidelidadePremio) throw new ErroRegra("Descreva o prêmio do cartão fidelidade.");
  }
  return d;
}

export function editarPetshop(db: Db, dados: Partial<Petshop>): { db: Db; dados: Partial<Petshop> } {
  const d = validarPetshop(db.petshop, dados);
  return { db: { ...db, petshop: { ...db.petshop, ...d } }, dados: d };
}

// ---------------------------------------------------------------------------
// Equipe
// ---------------------------------------------------------------------------

export function editarMembro(db: Db, id: string, dados: Partial<Pick<Membro, "nome" | "papel" | "comissaoPct" | "semComissao" | "ativo">>): { db: Db; membro: Membro } {
  const m = porId(db.membros, id);
  if (!m) throw new ErroRegra("Pessoa não encontrada.");
  const novo: Membro = { ...m, ...dados };
  novo.nome = limpar(novo.nome);
  if (novo.nome.length < 2) throw new ErroRegra("Informe o nome.");
  if (!(novo.comissaoPct >= 0 && novo.comissaoPct <= 100)) throw new ErroRegra("Comissão entre 0 e 100%.");
  const deixaDeSerDono = m.papel === "dono" && (novo.papel !== "dono" || !novo.ativo);
  if (deixaDeSerDono && db.membros.filter((x) => x.papel === "dono" && x.ativo && x.id !== id).length === 0)
    throw new ErroRegra("O pet shop precisa de pelo menos um dono ativo.");
  if (id === db.usuarioAtualId && !novo.ativo) throw new ErroRegra("Você não pode desativar a si mesmo.");
  if (id === db.usuarioAtualId && m.papel === "dono" && novo.papel !== "dono") throw new ErroRegra("Peça a outro dono para mudar o seu papel.");
  if (!novo.ativo) {
    const futuros = db.atendimentos.filter((a) => a.profissionalId === id && ["agendado", "confirmado", "em_atendimento"].includes(a.status));
    if (futuros.length > 0) throw new ErroRegra(`${novo.nome} tem ${futuros.length} atendimento(s) em aberto. Passe para outra pessoa antes de desativar.`);
  }
  return { db: { ...db, membros: db.membros.map((x) => (x.id === id ? novo : x)) }, membro: novo };
}

// ---------------------------------------------------------------------------
// Clientes e pets
// ---------------------------------------------------------------------------

export function editarTutor(db: Db, id: string, dados: Partial<Pick<Tutor, "nome" | "whatsapp" | "email" | "endereco" | "consentimentoWhatsapp">>): { db: Db; tutor: Tutor } {
  const t = porId(db.tutores, id);
  if (!t) throw new ErroRegra("Cliente não encontrado.");
  const novo: Tutor = { ...t, ...dados };
  novo.nome = limpar(novo.nome);
  if (novo.nome.length < 2) throw new ErroRegra("Informe o nome do tutor.");
  let zap = novo.whatsapp.replace(/\D/g, "");
  if (zap.length === 10 || zap.length === 11) zap = "55" + zap;
  if (!/^\d{12,13}$/.test(zap)) throw new ErroRegra("Informe o WhatsApp com DDD.");
  if (db.tutores.some((x) => x.id !== id && x.whatsapp === zap)) throw new ErroRegra("Já existe outro cliente com este WhatsApp.");
  novo.whatsapp = zap;
  novo.email = limpar(novo.email).toLowerCase() || undefined;
  if (novo.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(novo.email)) throw new ErroRegra("E-mail inválido.");
  novo.endereco = limpar(novo.endereco) || undefined;
  return { db: { ...db, tutores: db.tutores.map((x) => (x.id === id ? novo : x)) }, tutor: novo };
}

const COM_HISTORICO: Atendimento["status"][] = ["finalizado", "em_atendimento"];

/** Motivo para não excluir (ou null se pode). Cadastro com histórico financeiro não some: edite em vez de excluir. */
export function bloqueioExcluirPet(db: Db, petId: string): string | null {
  if (db.atendimentos.some((a) => a.petId === petId && COM_HISTORICO.includes(a.status))) return "Este pet já tem atendimentos realizados. O histórico precisa ficar guardado.";
  if (db.planosPet.some((p) => p.petId === petId)) return "Este pet tem plano vendido. O histórico precisa ficar guardado.";
  return null;
}

export function bloqueioExcluirTutor(db: Db, tutorId: string): string | null {
  for (const p of db.pets.filter((x) => x.tutorId === tutorId)) {
    const b = bloqueioExcluirPet(db, p.id);
    if (b) return b.replace("Este pet", p.nome);
  }
  if (db.vendas.some((v) => v.tutorId === tutorId && v.status !== "cancelada")) return "Este cliente tem compras registradas.";
  return null;
}

/** Remove o pet e o que é só dele (agendamentos em aberto, cancelados, vacinas). */
export function excluirPet(db: Db, petId: string): { db: Db; atendimentosRemovidos: number } {
  const b = bloqueioExcluirPet(db, petId);
  if (b) throw new ErroRegra(b);
  const atds = new Set(db.atendimentos.filter((a) => a.petId === petId).map((a) => a.id));
  return {
    db: {
      ...db,
      pets: db.pets.filter((p) => p.id !== petId),
      atendimentos: db.atendimentos.filter((a) => !atds.has(a.id)),
      etapas: db.etapas.filter((e) => !atds.has(e.atendimentoId)),
      vacinas: db.vacinas.filter((v) => v.petId !== petId),
      resgates: db.resgates.filter((r) => r.petId !== petId),
    },
    atendimentosRemovidos: atds.size,
  };
}

export function excluirTutor(db: Db, tutorId: string): Db {
  const b = bloqueioExcluirTutor(db, tutorId);
  if (b) throw new ErroRegra(b);
  let novo = db;
  for (const p of db.pets.filter((x) => x.tutorId === tutorId)) novo = excluirPet(novo, p.id).db;
  return {
    ...novo,
    tutores: novo.tutores.filter((t) => t.id !== tutorId),
    atendimentos: novo.atendimentos.filter((a) => a.tutorId !== tutorId),
    mensagensEnvios: novo.mensagensEnvios.filter((e) => e.tutorId !== tutorId),
  };
}

// ---------------------------------------------------------------------------
// Serviços e pacotes
// ---------------------------------------------------------------------------

export function validarServico(db: Db, s: Servico): Servico {
  const nome = limpar(s.nome);
  if (nome.length < 2) throw new ErroRegra("Informe o nome do serviço.");
  if (db.servicos.some((x) => x.id !== s.id && x.nome.toLowerCase() === nome.toLowerCase())) throw new ErroRegra("Já existe um serviço com este nome.");
  if (!(s.comissaoPct >= 0 && s.comissaoPct <= 100)) throw new ErroRegra("Comissão entre 0 e 100%.");
  for (const p of PORTES) {
    const v = s.precos[p];
    if (!v || !Number.isFinite(v.preco) || v.preco < 0) throw new ErroRegra(`Preço do porte ${p} inválido.`);
    if (!Number.isFinite(v.duracaoMin) || v.duracaoMin < 5 || v.duracaoMin > 480) throw new ErroRegra(`Duração do porte ${p}: de 5 a 480 minutos.`);
  }
  if (s.ativo && PORTES.every((p) => s.precos[p].preco === 0) && s.categoria !== "outros")
    throw new ErroRegra("Informe o preço de pelo menos um porte.");
  return { ...s, nome, precos: Object.fromEntries(PORTES.map((p) => [p, { preco: Math.round(s.precos[p].preco * 100) / 100, duracaoMin: Math.round(s.precos[p].duracaoMin) }])) as Servico["precos"] };
}

export function salvarServico(db: Db, s: Servico): { db: Db; servico: Servico; novo: boolean } {
  const servico = validarServico(db, s);
  const novo = !porId(db.servicos, s.id);
  if (!novo && !servico.ativo) {
    const emPacote = db.planosModelo.filter((m) => m.ativo && m.servicoIds.includes(servico.id));
    if (emPacote.length) throw new ErroRegra(`Este serviço está no pacote “${emPacote[0].nome}”. Desative o pacote antes.`);
  }
  return {
    db: { ...db, servicos: novo ? [...db.servicos, servico] : db.servicos.map((x) => (x.id === servico.id ? servico : x)) },
    servico,
    novo,
  };
}

export function servicoEmBranco(): Servico {
  const base = { preco: 0, duracaoMin: 30 };
  return { id: uid(), nome: "", categoria: "banho", precos: { P: { ...base }, M: { ...base }, G: { ...base }, GG: { ...base } }, comissaoPct: 0, ativo: true };
}

export function salvarPacote(db: Db, m: PlanoModelo): { db: Db; pacote: PlanoModelo; novo: boolean } {
  const nome = limpar(m.nome);
  if (nome.length < 2) throw new ErroRegra("Informe o nome do pacote.");
  const servicoIds = [...new Set(m.servicoIds)].filter((id) => porId(db.servicos, id));
  if (servicoIds.length === 0) throw new ErroRegra("Escolha o serviço que o pacote cobre.");
  if (!(Number.isInteger(m.quantidadeUsos) && m.quantidadeUsos >= 1 && m.quantidadeUsos <= 100)) throw new ErroRegra("Quantidade de usos: de 1 a 100.");
  if (!(Number.isInteger(m.validadeDias) && m.validadeDias >= 1 && m.validadeDias <= 730)) throw new ErroRegra("Validade: de 1 a 730 dias.");
  if (!(m.preco > 0)) throw new ErroRegra("Informe o preço do pacote.");
  const pacote: PlanoModelo = { ...m, nome, servicoIds, preco: Math.round(m.preco * 100) / 100 };
  const novo = !porId(db.planosModelo, m.id);
  return {
    db: { ...db, planosModelo: novo ? [...db.planosModelo, pacote] : db.planosModelo.map((x) => (x.id === pacote.id ? pacote : x)) },
    pacote,
    novo,
  };
}

// ---------------------------------------------------------------------------
// Planos vendidos
// ---------------------------------------------------------------------------

export interface CancelarPlanoInput {
  planoId: string;
  /** Valor devolvido ao cliente (vira despesa paga hoje). 0 = sem devolução. */
  devolucao: number;
  formaPagamento?: FormaPagamento;
  motivo?: string;
}

export function cancelarPlano(db: Db, input: CancelarPlanoInput, agora: Date): { db: Db; despesa?: Lancamento } {
  const plano = porId(db.planosPet, input.planoId);
  if (!plano) throw new ErroRegra("Plano não encontrado.");
  if (plano.status === "cancelado") throw new ErroRegra("Este plano já está cancelado.");
  if (input.devolucao < 0 || input.devolucao > plano.preco) throw new ErroRegra("A devolução não pode passar do valor pago.");
  if (input.devolucao > 0 && !input.formaPagamento) throw new ErroRegra("Escolha como o valor foi devolvido.");
  const abertos = db.atendimentos.filter((a) => a.planoPetId === plano.id && ["agendado", "confirmado"].includes(a.status));
  const pet = porId(db.pets, plano.petId);
  const motivo = limpar(input.motivo);
  const obs = [plano.observacoes, `Cancelado em ${dataDoIso(agora.toISOString()).split("-").reverse().join("/")}${motivo ? `: ${motivo}` : ""}`].filter(Boolean).join(" · ");
  let novo: Db = {
    ...db,
    planosPet: db.planosPet.map((p) => (p.id === plano.id ? { ...p, status: "cancelado", observacoes: obs } : p)),
    // Agendamentos que usariam o plano passam a ser cobrados normalmente.
    atendimentos: db.atendimentos.map((a) =>
      abertos.some((x) => x.id === a.id)
        ? { ...a, planoPetId: undefined, itens: a.itens.map((i) => ({ ...i, cobertoPorPlano: false })), valorTotal: Math.max(0, a.itens.reduce((s, i) => s + i.preco, 0) - a.desconto) }
        : a,
    ),
  };
  let despesa: Lancamento | undefined;
  if (input.devolucao > 0) {
    despesa = {
      id: uid(),
      tipo: "despesa",
      categoria: "Devoluções",
      descricao: `Devolução de plano · ${pet?.nome ?? plano.nome}`,
      valor: Math.round(input.devolucao * 100) / 100,
      formaPagamento: input.formaPagamento,
      status: "pago",
      competencia: dataDoIso(agora.toISOString()),
      criadoEm: agora.toISOString(),
      pagoEm: agora.toISOString(),
      planoPetId: plano.id,
    };
    novo = { ...novo, lancamentos: [...novo.lancamentos, despesa] };
  }
  return { db: novo, despesa };
}

export function editarObservacoesPlano(db: Db, planoId: string, observacoes: string): Db {
  if (!porId(db.planosPet, planoId)) throw new ErroRegra("Plano não encontrado.");
  return { ...db, planosPet: db.planosPet.map((p) => (p.id === planoId ? { ...p, observacoes: limpar(observacoes) || undefined } : p)) };
}

/** Desfaz um uso: o saldo volta e, se o plano tinha zerado, ele volta a ficar ativo. */
export function desfazerUso(db: Db, usoId: string): Db {
  const uso = db.planoUsos.find((u) => u.id === usoId);
  if (!uso) throw new ErroRegra("Uso não encontrado.");
  if (uso.estornado) throw new ErroRegra("Este uso já foi desfeito.");
  const novo = { ...db, planoUsos: db.planoUsos.map((u) => (u.id === usoId ? { ...u, estornado: true } : u)) };
  return {
    ...novo,
    planosPet: novo.planosPet.map((p) => (p.id === uso.planoPetId && p.status === "finalizado" && saldoPlano(novo, p.id) > 0 ? { ...p, status: "ativo" } : p)),
  };
}

// ---------------------------------------------------------------------------
// Atendimentos: reagendar e mudar serviços
// ---------------------------------------------------------------------------

export interface EdicaoAtendimento {
  data?: string;
  hora?: string;
  profissionalId?: string;
  servicoIds?: string[];
  /** Desconto em reais sobre o que é cobrado. */
  desconto?: number;
  observacoes?: string;
}

export function editarAtendimento(db: Db, id: string, e: EdicaoAtendimento): { db: Db; atendimento: Atendimento; itensMudaram: boolean } {
  const atd = porId(db.atendimentos, id);
  if (!atd) throw new ErroRegra("Atendimento não encontrado.");
  const aberto = ["agendado", "confirmado"].includes(atd.status);
  if (!aberto && atd.status !== "em_atendimento") throw new ErroRegra("Atendimento encerrado não pode ser alterado.");
  const data = e.data ?? atd.data;
  const hora = e.hora ?? atd.hora;
  const profissionalId = e.profissionalId ?? atd.profissionalId;
  const mudouQuando = data !== atd.data || hora !== atd.hora || profissionalId !== atd.profissionalId;
  if (mudouQuando && !aberto) throw new ErroRegra("Depois de iniciado, o horário não muda mais.");
  if (!HORA.test(hora)) throw new ErroRegra("Escolha o horário.");
  const prof = porId(db.membros, profissionalId);
  if (!prof || !prof.ativo) throw new ErroRegra("Escolha o profissional.");
  if (mudouQuando && !petshopAberto(db, data)) throw new ErroRegra("O pet shop não abre neste dia.");

  const servicoIds = e.servicoIds ?? atd.itens.map((i) => i.servicoId);
  const mesmos = servicoIds.length === atd.itens.length && servicoIds.every((s, i) => s === atd.itens[i].servicoId);
  // Itens são refeitos quando os serviços mudam ou quando a nova data muda a cobertura do plano.
  let itens = atd.itens;
  let planoPetId = atd.planoPetId;
  let itensMudaram = false;
  if (!mesmos || data !== atd.data) {
    const m = montarItens(db, atd.petId, servicoIds, data);
    const coberturaIgual = m.planoPetId === atd.planoPetId;
    if (!mesmos || !coberturaIgual) {
      itens = m.itens;
      planoPetId = m.planoPetId;
      itensMudaram = true;
    }
  }
  const duracaoMin = itens.reduce((s, i) => s + i.duracaoMin, 0);
  const ini = minutos(hora);
  if ((mudouQuando || itensMudaram) && (ini < minutos(db.petshop.abre) || ini + duracaoMin > minutos(db.petshop.fecha)))
    throw new ErroRegra("Horário fora do funcionamento do pet shop.");
  if (mudouQuando || itensMudaram) {
    const choque = conflitos(db, { profissionalId, data, hora, duracaoMin, ignorarId: atd.id });
    if (choque.length) {
      const outro = porId(db.pets, choque[0].petId);
      throw new ErroRegra(`Conflito: ${prof.nome} já atende ${outro?.nome ?? "outro pet"} às ${choque[0].hora}.`);
    }
  }
  const bruto = itens.filter((i) => !i.cobertoPorPlano).reduce((s, i) => s + i.preco, 0);
  const desconto = Math.round((e.desconto ?? atd.desconto) * 100) / 100;
  if (desconto < 0) throw new ErroRegra("Desconto inválido.");
  if (desconto > bruto) throw new ErroRegra("O desconto não pode passar do valor dos serviços.");
  const atualizado: Atendimento = {
    ...atd,
    data,
    hora,
    profissionalId,
    itens,
    duracaoMin,
    planoPetId,
    desconto,
    valorTotal: Math.round((bruto - desconto) * 100) / 100,
    observacoes: e.observacoes !== undefined ? limpar(e.observacoes) || undefined : atd.observacoes,
  };
  return { db: { ...db, atendimentos: db.atendimentos.map((a) => (a.id === id ? atualizado : a)) }, atendimento: atualizado, itensMudaram };
}

/** Sinal do agendamento online conferido no extrato: entra no caixa como receita paga. */
export function registrarSinal(db: Db, atendimentoId: string, forma: FormaPagamento, agora: Date): { db: Db; lancamento: Lancamento } {
  const atd = porId(db.atendimentos, atendimentoId);
  if (!atd) throw new ErroRegra("Atendimento não encontrado.");
  if (!atd.sinalValor || atd.sinalValor <= 0) throw new ErroRegra("Este agendamento não tem sinal.");
  if (atd.sinalPago) throw new ErroRegra("O sinal já foi registrado.");
  if (["cancelado", "faltou", "finalizado"].includes(atd.status)) throw new ErroRegra("Atendimento encerrado.");
  const pet = porId(db.pets, atd.petId);
  const lancamento: Lancamento = {
    id: uid(),
    tipo: "receita",
    categoria: "Sinal",
    descricao: `Sinal · ${pet?.nome ?? "agendamento online"}`,
    valor: atd.sinalValor,
    formaPagamento: forma,
    status: "pago",
    competencia: atd.data,
    criadoEm: agora.toISOString(),
    pagoEm: agora.toISOString(),
    atendimentoId: atd.id,
  };
  return {
    db: {
      ...db,
      atendimentos: db.atendimentos.map((a) => (a.id === atd.id ? { ...a, sinalPago: true } : a)),
      lancamentos: [...db.lancamentos, lancamento],
    },
    lancamento,
  };
}

// ---------------------------------------------------------------------------
// Financeiro: receita avulsa, estorno e exclusão
// ---------------------------------------------------------------------------

export interface ReceitaInput {
  descricao: string;
  categoria: string;
  valor: number;
  /** Sem forma = fica a receber. */
  formaPagamento?: FormaPagamento;
}

export function lancarReceita(db: Db, input: ReceitaInput, agora: Date): { db: Db; lancamento: Lancamento } {
  const descricao = limpar(input.descricao);
  if (!descricao) throw new ErroRegra("Descreva a receita.");
  if (!(input.valor > 0)) throw new ErroRegra("Informe o valor.");
  const pago = !!input.formaPagamento;
  const lancamento: Lancamento = {
    id: uid(),
    tipo: "receita",
    categoria: limpar(input.categoria) || "Outros",
    descricao,
    valor: Math.round(input.valor * 100) / 100,
    formaPagamento: input.formaPagamento,
    status: pago ? "pago" : "pendente",
    competencia: dataDoIso(agora.toISOString()),
    criadoEm: agora.toISOString(),
    pagoEm: pago ? agora.toISOString() : undefined,
  };
  return { db: { ...db, lancamentos: [...db.lancamentos, lancamento] }, lancamento };
}

function caixaDoPagamentoFechado(db: Db, l: Lancamento): boolean {
  return !!l.pagoEm && db.caixas.some((c) => c.data === dataDoIso(l.pagoEm!));
}

/** O lançamento nasceu de outra coisa (venda, comissão, plano, sinal) e só muda por lá. */
export function origemDoLancamento(db: Db, l: Lancamento): string | null {
  if (db.vendas.some((v) => v.lancamentoId === l.id)) return "venda de produtos";
  if (db.acertos.some((a) => a.lancamentoId === l.id)) return "pagamento de comissões";
  if (l.planoPetId) return "plano";
  if (l.categoria === "Sinal") return "sinal do agendamento";
  return null;
}

/** Recebido por engano: volta para "a receber". */
export function estornarPagamento(db: Db, lancamentoId: string): Db {
  const l = porId(db.lancamentos, lancamentoId);
  if (!l) throw new ErroRegra("Lançamento não encontrado.");
  if (l.tipo !== "receita" || l.status !== "pago") throw new ErroRegra("Só um recebimento pago pode ser desfeito.");
  const origem = origemDoLancamento(db, l);
  if (origem) throw new ErroRegra(`Este valor veio de ${origem}: desfaça por lá.`);
  if (caixaDoPagamentoFechado(db, l)) throw new ErroRegra("O caixa desse dia já foi fechado.");
  return {
    ...db,
    lancamentos: db.lancamentos.map((x) => (x.id === l.id ? { ...x, status: "pendente", formaPagamento: undefined, pagoEm: undefined } : x)),
    atendimentos: l.atendimentoId ? db.atendimentos.map((a) => (a.id === l.atendimentoId ? { ...a, pago: false } : a)) : db.atendimentos,
  };
}

/** Só some o que foi lançado à mão (despesa ou receita avulsa) e cujo caixa ainda está aberto. */
export function bloqueioExcluirLancamento(db: Db, l: Lancamento): string | null {
  if (l.atendimentoId) return "Valor de atendimento: estorne o recebimento em vez de excluir.";
  const origem = origemDoLancamento(db, l);
  if (origem) return `Este valor veio de ${origem}: desfaça por lá.`;
  if (caixaDoPagamentoFechado(db, l)) return "O caixa desse dia já foi fechado.";
  return null;
}

export function excluirLancamento(db: Db, lancamentoId: string): Db {
  const l = porId(db.lancamentos, lancamentoId);
  if (!l) throw new ErroRegra("Lançamento não encontrado.");
  const b = bloqueioExcluirLancamento(db, l);
  if (b) throw new ErroRegra(b);
  return { ...db, lancamentos: db.lancamentos.filter((x) => x.id !== l.id) };
}

// ---------------------------------------------------------------------------
// Mensagens e fotos
// ---------------------------------------------------------------------------

export function editarModelo(db: Db, id: string, dados: Partial<Pick<MensagemModelo, "titulo" | "texto" | "ativo">>): { db: Db; modelo: MensagemModelo } {
  const m = porId(db.mensagemModelos, id);
  if (!m) throw new ErroRegra("Modelo não encontrado.");
  const novo = { ...m, ...dados };
  novo.titulo = limpar(novo.titulo);
  novo.texto = novo.texto.trim();
  if (!novo.titulo) throw new ErroRegra("Dê um título à mensagem.");
  if (novo.texto.length < 5) throw new ErroRegra("Escreva o texto da mensagem.");
  return { db: { ...db, mensagemModelos: db.mensagemModelos.map((x) => (x.id === id ? novo : x)) }, modelo: novo };
}

/** Tira a foto de uma etapa ou a etapa inteira (as de transporte só perdem a foto, para não quebrar a rota). */
export function removerEtapa(db: Db, etapaId: string, soFoto: boolean): Db {
  const e = db.etapas.find((x) => x.id === etapaId);
  if (!e) throw new ErroRegra("Etapa não encontrada.");
  const transporte = ["saiu_para_buscar", "pet_buscado", "saiu_para_entregar", "entregue"].includes(e.etapa);
  if (!soFoto && transporte) throw new ErroRegra("Etapas do leva e traz não podem ser apagadas; tire só a foto.");
  if (soFoto && !e.fotoUrl) throw new ErroRegra("Esta etapa não tem foto.");
  return {
    ...db,
    etapas: soFoto ? db.etapas.map((x) => (x.id === etapaId ? { ...x, fotoUrl: undefined } : x)) : db.etapas.filter((x) => x.id !== etapaId),
  };
}
