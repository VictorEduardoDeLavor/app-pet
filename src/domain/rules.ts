// Regras de negócio do APP PET — funções puras sobre o estado (Db).
// Cada função devolve um novo Db; nada aqui toca em UI ou armazenamento.
// Na integração com o Supabase, as mesmas regras viram triggers/RPCs (ver supabase/migrations).

import type {
  Atendimento,
  AtendimentoItem,
  Caixa,
  Db,
  FormaPagamento,
  Lancamento,
  Membro,
  Pet,
  PlanoPet,
  PlanoUso,
  Servico,
  StatusAtendimento,
  StatusPlano,
  Tutor,
} from "./types";
import { dataDoIso, diferencaDias, diaDaSemana, horaDeMinutos, minutos, somaDias } from "./format";

export class ErroRegra extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroRegra";
  }
}

/** IDs gerados no cliente (UUID) — os mesmos vão para o banco no modo nuvem. */
export function uid(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Consultas básicas
// ---------------------------------------------------------------------------

export function porId<T extends { id: string }>(lista: T[], id: string | undefined): T | undefined {
  if (!id) return undefined;
  return lista.find((x) => x.id === id);
}

export function petsDoTutor(db: Db, tutorId: string): Pet[] {
  return db.pets.filter((p) => p.tutorId === tutorId);
}

export function precoServico(servico: Servico, porte: Pet["porte"]) {
  return servico.precos[porte];
}

// ---------------------------------------------------------------------------
// Planos
// ---------------------------------------------------------------------------

export function usosDoPlano(db: Db, planoId: string): PlanoUso[] {
  return db.planoUsos.filter((u) => u.planoPetId === planoId && !u.estornado);
}

export function saldoPlano(db: Db, planoId: string): number {
  const plano = porId(db.planosPet, planoId);
  if (!plano) return 0;
  return Math.max(0, plano.totalUsos - usosDoPlano(db, planoId).length);
}

/** Status considerando a data: um plano "ativo" com vencimento passado conta como vencido. */
export function statusEfetivoPlano(db: Db, plano: PlanoPet, dataRef: string): StatusPlano {
  if (plano.status !== "ativo") return plano.status;
  if (saldoPlano(db, plano.id) === 0) return "finalizado";
  if (plano.vencimento < dataRef) return "vencido";
  return "ativo";
}

/** Plano utilizável pelo pet na data: ativo, dentro da validade e com saldo. */
export function planoAtivoDoPet(db: Db, petId: string, data: string): PlanoPet | undefined {
  return db.planosPet.find(
    (p) =>
      p.petId === petId &&
      p.inicio <= data &&
      statusEfetivoPlano(db, p, data) === "ativo",
  );
}

export function planosAVencer(db: Db, dataRef: string, dias = 7): PlanoPet[] {
  return db.planosPet.filter((p) => {
    if (statusEfetivoPlano(db, p, dataRef) !== "ativo") return false;
    const faltam = diferencaDias(dataRef, p.vencimento);
    return faltam <= dias || saldoPlano(db, p.id) <= 1;
  });
}

export function darBaixaManual(db: Db, planoId: string, agora: Date): Db {
  const plano = porId(db.planosPet, planoId);
  if (!plano) throw new ErroRegra("Plano não encontrado.");
  if (saldoPlano(db, planoId) <= 0) throw new ErroRegra("Este plano não tem saldo.");
  const uso: PlanoUso = { id: uid(), planoPetId: planoId, em: agora.toISOString(), estornado: false };
  return { ...db, planoUsos: [...db.planoUsos, uso] };
}

export function estornarUso(db: Db, usoId: string): Db {
  return {
    ...db,
    planoUsos: db.planoUsos.map((u) => (u.id === usoId ? { ...u, estornado: true } : u)),
  };
}

export interface VendaPlanoInput {
  modeloId: string;
  petId: string;
  preco: number;
  formaPagamento: FormaPagamento;
  inicio: string;
  observacoes?: string;
}

export function venderPlano(db: Db, input: VendaPlanoInput, agora: Date): { db: Db; plano: PlanoPet } {
  const modelo = porId(db.planosModelo, input.modeloId);
  const pet = porId(db.pets, input.petId);
  if (!modelo) throw new ErroRegra("Escolha um modelo de plano.");
  if (!pet) throw new ErroRegra("Escolha o pet.");
  if (planoAtivoDoPet(db, pet.id, input.inicio))
    throw new ErroRegra(`${pet.nome} já tem um plano ativo.`);
  if (!(input.preco > 0)) throw new ErroRegra("Informe o preço do plano.");

  const plano: PlanoPet = {
    id: uid(),
    modeloId: modelo.id,
    nome: modelo.nome,
    petId: pet.id,
    tutorId: pet.tutorId,
    servicoIds: modelo.servicoIds,
    totalUsos: modelo.quantidadeUsos,
    preco: input.preco,
    inicio: input.inicio,
    vencimento: somaDias(input.inicio, modelo.validadeDias),
    status: "ativo",
    observacoes: input.observacoes,
  };
  const receita: Lancamento = {
    id: uid(),
    tipo: "receita",
    categoria: "Planos",
    descricao: `Venda de plano · ${pet.nome}`,
    valor: input.preco,
    formaPagamento: input.formaPagamento,
    status: "pago",
    competencia: input.inicio,
    criadoEm: agora.toISOString(),
    pagoEm: agora.toISOString(),
    planoPetId: plano.id,
  };
  return {
    db: { ...db, planosPet: [...db.planosPet, plano], lancamentos: [...db.lancamentos, receita] },
    plano,
  };
}

// ---------------------------------------------------------------------------
// Agenda
// ---------------------------------------------------------------------------

const OCUPA_HORARIO: StatusAtendimento[] = ["agendado", "confirmado", "em_atendimento", "finalizado"];

export function montarItens(db: Db, petId: string, servicoIds: string[], data: string) {
  const pet = porId(db.pets, petId);
  if (!pet) throw new ErroRegra("Escolha o pet.");
  if (servicoIds.length === 0) throw new ErroRegra("Escolha pelo menos um serviço.");

  const plano = planoAtivoDoPet(db, petId, data);
  let coberturaUsada = false;

  const itens: AtendimentoItem[] = servicoIds.map((sid) => {
    const servico = porId(db.servicos, sid);
    if (!servico) throw new ErroRegra("Serviço não encontrado.");
    const { preco, duracaoMin } = precoServico(servico, pet.porte);
    // Um atendimento consome no máximo 1 uso do plano.
    const coberto = !!plano && !coberturaUsada && plano.servicoIds.includes(sid);
    if (coberto) coberturaUsada = true;
    return { servicoId: sid, nome: servico.nome, preco, duracaoMin, cobertoPorPlano: coberto };
  });

  const duracaoMin = itens.reduce((s, i) => s + i.duracaoMin, 0);
  const valorSugerido = itens.filter((i) => !i.cobertoPorPlano).reduce((s, i) => s + i.preco, 0);
  return { itens, duracaoMin, valorSugerido, planoPetId: coberturaUsada ? plano?.id : undefined };
}

export function conflitos(
  db: Db,
  q: { profissionalId: string; data: string; hora: string; duracaoMin: number; ignorarId?: string },
): Atendimento[] {
  const ini = minutos(q.hora);
  const fim = ini + q.duracaoMin;
  return db.atendimentos.filter((a) => {
    if (a.id === q.ignorarId) return false;
    if (a.profissionalId !== q.profissionalId || a.data !== q.data) return false;
    if (!OCUPA_HORARIO.includes(a.status)) return false;
    const aIni = minutos(a.hora);
    const aFim = aIni + a.duracaoMin;
    return ini < aFim && aIni < fim;
  });
}

export function petshopAberto(db: Db, data: string): boolean {
  return db.petshop.diasAbertos.includes(diaDaSemana(data));
}

/** Horários de 30 em 30 minutos em que o profissional está livre. */
export function horariosLivres(db: Db, profissionalId: string, data: string, duracaoMin: number): string[] {
  if (!petshopAberto(db, data)) return [];
  const abre = minutos(db.petshop.abre);
  const fecha = minutos(db.petshop.fecha);
  const livres: string[] = [];
  for (let m = abre; m + Math.max(duracaoMin, 30) <= fecha; m += 30) {
    const hora = horaDeMinutos(m);
    if (conflitos(db, { profissionalId, data, hora, duracaoMin: Math.max(duracaoMin, 30) }).length === 0)
      livres.push(hora);
  }
  return livres;
}

export interface NovoAtendimentoInput {
  petId: string;
  servicoIds: string[];
  profissionalId: string;
  data: string;
  hora: string;
  valorTotal?: number; // se ausente, usa o sugerido
  observacoes?: string;
  origem?: "balcao" | "portal";
}

export function criarAtendimento(
  db: Db,
  input: NovoAtendimentoInput,
  agora: Date,
): { db: Db; atendimento: Atendimento } {
  const pet = porId(db.pets, input.petId);
  if (!pet) throw new ErroRegra("Escolha o pet.");
  if (!porId(db.membros, input.profissionalId)) throw new ErroRegra("Escolha o profissional.");
  if (!input.data || !input.hora) throw new ErroRegra("Escolha data e horário.");
  if (!petshopAberto(db, input.data)) throw new ErroRegra("O pet shop não abre neste dia.");

  const { itens, duracaoMin, valorSugerido, planoPetId } = montarItens(db, pet.id, input.servicoIds, input.data);
  const ini = minutos(input.hora);
  if (ini < minutos(db.petshop.abre) || ini + duracaoMin > minutos(db.petshop.fecha))
    throw new ErroRegra("Horário fora do funcionamento do pet shop.");

  const choque = conflitos(db, { profissionalId: input.profissionalId, data: input.data, hora: input.hora, duracaoMin });
  if (choque.length > 0) {
    const outro = porId(db.pets, choque[0].petId);
    throw new ErroRegra(`Conflito: o profissional já atende ${outro?.nome ?? "outro pet"} às ${choque[0].hora}.`);
  }

  const valorTotal = input.valorTotal ?? valorSugerido;
  const atendimento: Atendimento = {
    id: uid(),
    petId: pet.id,
    tutorId: pet.tutorId,
    profissionalId: input.profissionalId,
    data: input.data,
    hora: input.hora,
    duracaoMin,
    status: "agendado",
    origem: input.origem ?? "balcao",
    itens,
    valorTotal,
    desconto: Math.max(0, valorSugerido - valorTotal),
    planoPetId,
    pago: false,
    observacoes: input.observacoes,
    eventos: [{ de: null, para: "agendado", porMembroId: db.usuarioAtualId, em: agora.toISOString() }],
  };
  return { db: { ...db, atendimentos: [...db.atendimentos, atendimento] }, atendimento };
}

export function reatribuir(db: Db, atendimentoId: string, profissionalId: string): Db {
  const atd = porId(db.atendimentos, atendimentoId);
  if (!atd) throw new ErroRegra("Atendimento não encontrado.");
  if (!["agendado", "confirmado", "em_atendimento"].includes(atd.status))
    throw new ErroRegra("Só dá para trocar o profissional antes de finalizar.");
  const choque = conflitos(db, { profissionalId, data: atd.data, hora: atd.hora, duracaoMin: atd.duracaoMin, ignorarId: atd.id });
  if (choque.length > 0) {
    const outro = porId(db.pets, choque[0].petId);
    throw new ErroRegra(`Conflito: este profissional já atende ${outro?.nome ?? "outro pet"} às ${choque[0].hora}.`);
  }
  return { ...db, atendimentos: db.atendimentos.map((a) => (a.id === atd.id ? { ...a, profissionalId } : a)) };
}

export const TRANSICOES: Record<StatusAtendimento, StatusAtendimento[]> = {
  agendado: ["confirmado", "em_atendimento", "cancelado", "faltou"],
  confirmado: ["em_atendimento", "cancelado", "faltou"],
  em_atendimento: ["finalizado"],
  finalizado: [],
  cancelado: [],
  faltou: [],
};

export function podeMudar(de: StatusAtendimento, para: StatusAtendimento): boolean {
  return TRANSICOES[de].includes(para);
}

export interface EfeitosStatus {
  usoRegistrado?: PlanoUso;
  receitaCriada?: Lancamento;
  planoEncerrado?: boolean;
}

export function mudarStatus(
  db: Db,
  atendimentoId: string,
  para: StatusAtendimento,
  membroId: string,
  agora: Date,
): { db: Db; efeitos: EfeitosStatus } {
  const atd = porId(db.atendimentos, atendimentoId);
  if (!atd) throw new ErroRegra("Atendimento não encontrado.");
  if (!podeMudar(atd.status, para))
    throw new ErroRegra(`Não é possível passar de ${NOME_STATUS[atd.status]} para ${NOME_STATUS[para]}.`);

  const evento = { de: atd.status, para, porMembroId: membroId, em: agora.toISOString() };
  let atualizado: Atendimento = { ...atd, status: para, eventos: [...atd.eventos, evento] };
  let novo: Db = db;
  const efeitos: EfeitosStatus = {};

  const consomeUso =
    !!atd.planoPetId &&
    (para === "finalizado" || (para === "faltou" && db.petshop.faltaConsomeUso));

  if (consomeUso && atd.planoPetId) {
    if (saldoPlano(db, atd.planoPetId) > 0) {
      const uso: PlanoUso = {
        id: uid(),
        planoPetId: atd.planoPetId,
        atendimentoId: atd.id,
        em: agora.toISOString(),
        estornado: false,
      };
      novo = { ...novo, planoUsos: [...novo.planoUsos, uso] };
      efeitos.usoRegistrado = uso;
      if (saldoPlano(novo, atd.planoPetId) === 0) {
        novo = {
          ...novo,
          planosPet: novo.planosPet.map((p) => (p.id === atd.planoPetId ? { ...p, status: "finalizado" } : p)),
        };
        efeitos.planoEncerrado = true;
      }
    } else {
      // Plano zerou entre o agendamento e a finalização: cobra os itens normalmente.
      atualizado = {
        ...atualizado,
        itens: atualizado.itens.map((i) => ({ ...i, cobertoPorPlano: false })),
        valorTotal: atualizado.itens.reduce((s, i) => s + i.preco, 0) - atualizado.desconto,
        planoPetId: undefined,
      };
    }
  }

  if (para === "finalizado") {
    if (atualizado.valorTotal > 0) {
      const pet = porId(db.pets, atd.petId);
      const receita: Lancamento = {
        id: uid(),
        tipo: "receita",
        categoria: "Serviços",
        descricao: `${pet?.nome ?? "Pet"} · ${atualizado.itens.map((i) => i.nome).join(" + ")}`,
        valor: atualizado.valorTotal,
        status: "pendente",
        competencia: atd.data,
        criadoEm: agora.toISOString(),
        atendimentoId: atd.id,
      };
      novo = { ...novo, lancamentos: [...novo.lancamentos, receita] };
      efeitos.receitaCriada = receita;
    } else {
      atualizado = { ...atualizado, pago: true };
    }
    novo = {
      ...novo,
      pets: novo.pets.map((p) => (p.id === atd.petId ? { ...p, ultimaVisita: atd.data } : p)),
    };
  }

  novo = { ...novo, atendimentos: novo.atendimentos.map((a) => (a.id === atd.id ? atualizado : a)) };
  return { db: novo, efeitos };
}

export const NOME_STATUS: Record<StatusAtendimento, string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  em_atendimento: "Em atendimento",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
  faltou: "Faltou",
};

// ---------------------------------------------------------------------------
// Financeiro
// ---------------------------------------------------------------------------

export function pagarLancamento(db: Db, lancamentoId: string, forma: FormaPagamento, agora: Date): Db {
  const lanc = porId(db.lancamentos, lancamentoId);
  if (!lanc) throw new ErroRegra("Lançamento não encontrado.");
  if (lanc.status === "pago") throw new ErroRegra("Este lançamento já está pago.");
  return {
    ...db,
    lancamentos: db.lancamentos.map((l) =>
      l.id === lancamentoId ? { ...l, status: "pago", formaPagamento: forma, pagoEm: agora.toISOString() } : l,
    ),
    atendimentos: lanc.atendimentoId
      ? db.atendimentos.map((a) => (a.id === lanc.atendimentoId ? { ...a, pago: true } : a))
      : db.atendimentos,
  };
}

export function receitaPendenteDoAtendimento(db: Db, atendimentoId: string): Lancamento | undefined {
  return db.lancamentos.find((l) => l.atendimentoId === atendimentoId && l.tipo === "receita" && l.status === "pendente");
}

export interface DespesaInput {
  descricao: string;
  categoria: string;
  valor: number;
  formaPagamento: FormaPagamento;
}

export function lancarDespesa(db: Db, input: DespesaInput, agora: Date): Db {
  if (!input.descricao.trim()) throw new ErroRegra("Descreva a despesa.");
  if (!(input.valor > 0)) throw new ErroRegra("Informe o valor.");
  const desp: Lancamento = {
    id: uid(),
    tipo: "despesa",
    categoria: input.categoria || "Outros",
    descricao: input.descricao.trim(),
    valor: input.valor,
    formaPagamento: input.formaPagamento,
    status: "pago",
    competencia: dataDoIso(agora.toISOString()),
    criadoEm: agora.toISOString(),
    pagoEm: agora.toISOString(),
  };
  return { ...db, lancamentos: [...db.lancamentos, desp] };
}

export function caixaFechado(db: Db, data: string): Caixa | undefined {
  return db.caixas.find((c) => c.data === data);
}

export function resumoCaixa(db: Db, data: string) {
  const pagosNoDia = db.lancamentos
    .filter((l) => l.status === "pago" && l.pagoEm && dataDoIso(l.pagoEm) === data)
    .sort((a, b) => (a.pagoEm! < b.pagoEm! ? -1 : 1));
  const entradas = pagosNoDia.filter((l) => l.tipo === "receita").reduce((s, l) => s + l.valor, 0);
  const saidas = pagosNoDia.filter((l) => l.tipo === "despesa").reduce((s, l) => s + l.valor, 0);
  const pendentes = db.lancamentos
    .filter((l) => l.tipo === "receita" && l.status === "pendente" && l.competencia <= data)
    .sort((a, b) => (a.criadoEm < b.criadoEm ? -1 : 1));
  const aReceber = pendentes.reduce((s, l) => s + l.valor, 0);
  const saldoInicial = 0;
  return {
    saldoInicial,
    entradas,
    saidas,
    saldo: saldoInicial + entradas - saidas,
    movimentos: pagosNoDia,
    pendentes,
    aReceber,
    fechado: caixaFechado(db, data),
  };
}

export function fecharCaixa(db: Db, data: string, membroId: string, agora: Date): Db {
  if (caixaFechado(db, data)) throw new ErroRegra("O caixa deste dia já foi fechado.");
  const r = resumoCaixa(db, data);
  const caixa: Caixa = {
    id: uid(),
    data,
    saldoInicial: r.saldoInicial,
    entradas: r.entradas,
    saidas: r.saidas,
    saldoFinal: r.saldo,
    fechadoPorId: membroId,
    fechadoEm: agora.toISOString(),
  };
  return { ...db, caixas: [...db.caixas, caixa] };
}

// ---------------------------------------------------------------------------
// Cadastros
// ---------------------------------------------------------------------------

export function criarTutor(
  db: Db,
  input: { nome: string; whatsapp: string; endereco?: string; consentimentoWhatsapp?: boolean },
  agora: Date,
): { db: Db; tutor: Tutor } {
  const nome = input.nome.trim();
  const whatsapp = input.whatsapp.replace(/\D/g, "");
  if (nome.length < 2) throw new ErroRegra("Informe o nome do tutor.");
  if (whatsapp.length < 12) throw new ErroRegra("Informe o WhatsApp com DDD.");
  if (db.tutores.some((t) => t.whatsapp === whatsapp)) throw new ErroRegra("Já existe um tutor com este WhatsApp.");
  const tutor: Tutor = {
    id: uid(),
    nome,
    whatsapp,
    endereco: input.endereco?.trim() || undefined,
    consentimentoWhatsapp: input.consentimentoWhatsapp ?? true,
    criadoEm: agora.toISOString(),
  };
  return { db: { ...db, tutores: [...db.tutores, tutor] }, tutor };
}

export function criarPet(db: Db, input: Omit<Pet, "id">): { db: Db; pet: Pet } {
  if (!porId(db.tutores, input.tutorId)) throw new ErroRegra("Escolha o tutor.");
  if (input.nome.trim().length < 1) throw new ErroRegra("Informe o nome do pet.");
  const pet: Pet = { ...input, nome: input.nome.trim(), id: uid() };
  return { db: { ...db, pets: [...db.pets, pet] }, pet };
}

export function criarMembro(
  db: Db,
  input: { nome: string; papel: Membro["papel"]; comissaoPct: number },
): { db: Db; membro: Membro } {
  const nome = input.nome.trim();
  if (nome.length < 2) throw new ErroRegra("Informe o nome.");
  if (input.comissaoPct < 0 || input.comissaoPct > 100) throw new ErroRegra("Comissão entre 0 e 100%.");
  const membro: Membro = { id: uid(), nome, papel: input.papel, comissaoPct: input.comissaoPct, ativo: true };
  return { db: { ...db, membros: [...db.membros, membro] }, membro };
}

/** Quem pode receber atendimentos: banhistas e o dono (autônomo também atende). */
export function profissionais(db: Db): Membro[] {
  return db.membros.filter((m) => m.ativo && m.papel !== "recepcao");
}

export function atualizarPet(db: Db, pet: Pet): Db {
  return { ...db, pets: db.pets.map((p) => (p.id === pet.id ? pet : p)) };
}

// ---------------------------------------------------------------------------
// Indicadores e relacionamento
// ---------------------------------------------------------------------------

export function atendimentosDoDia(db: Db, data: string): Atendimento[] {
  return db.atendimentos
    .filter((a) => a.data === data)
    .sort((a, b) => (a.hora < b.hora ? -1 : a.hora > b.hora ? 1 : 0));
}

export function kpisDoDia(db: Db, data: string) {
  const doDia = atendimentosDoDia(db, data).filter((a) => a.status !== "cancelado");
  return {
    agendamentos: doDia.length,
    emAtendimento: doDia.filter((a) => a.status === "em_atendimento").length,
    caixa: resumoCaixa(db, data).saldo,
  };
}

/** Tutores cujos pets não vêm há mais de N dias e não têm nada agendado. */
export function clientesSumidos(db: Db, dataRef: string) {
  const limite = db.petshop.diasClienteSumido;
  return db.tutores
    .map((t) => {
      const pets = petsDoTutor(db, t.id);
      const visitas = pets.map((p) => p.ultimaVisita).filter(Boolean) as string[];
      const ultima = visitas.sort().at(-1);
      const temFuturo = db.atendimentos.some(
        (a) => a.tutorId === t.id && a.data >= dataRef && ["agendado", "confirmado", "em_atendimento"].includes(a.status),
      );
      return { tutor: t, pets, ultima, dias: ultima ? diferencaDias(ultima, dataRef) : undefined, temFuturo };
    })
    .filter((x) => x.ultima && x.dias! > limite && !x.temFuturo)
    .sort((a, b) => b.dias! - a.dias!);
}

// ---------------------------------------------------------------------------
// Fila do profissional (banhista / tosador)
// ---------------------------------------------------------------------------

export interface Fila {
  agora: Atendimento[];
  proximos: Atendimento[];
  concluidos: Atendimento[];
  ausentes: Atendimento[];
}

/** O dia de um profissional: o que está na mesa, o que vem e o que já saiu. Cancelados não entram. */
export function filaDoProfissional(db: Db, membroId: string, data: string): Fila {
  const meus = atendimentosDoDia(db, data).filter((a) => a.profissionalId === membroId);
  return {
    agora: meus.filter((a) => a.status === "em_atendimento"),
    proximos: meus.filter((a) => a.status === "agendado" || a.status === "confirmado"),
    concluidos: meus.filter((a) => a.status === "finalizado"),
    ausentes: meus.filter((a) => a.status === "faltou"),
  };
}

/** % de comissão de um item: a da pessoa, quando definida; senão a do serviço (tabela de Serviços). */
export function pctComissao(db: Db, membroId: string, servicoId: string): number {
  const proprio = porId(db.membros, membroId)?.comissaoPct ?? 0;
  return proprio > 0 ? proprio : (porId(db.servicos, servicoId)?.comissaoPct ?? 0);
}

/**
 * Comissão de um atendimento finalizado, sobre o preço de tabela de cada item,
 * inclusive itens cobertos por plano (o trabalho foi feito). Mesma conta do trigger no banco.
 */
export function comissaoDoAtendimento(db: Db, atd: Atendimento): number {
  if (atd.status !== "finalizado") return 0;
  const centavos = atd.itens.reduce((s, i) => s + Math.round(i.preco * pctComissao(db, atd.profissionalId, i.servicoId)), 0);
  return centavos / 100;
}

export function resumoProfissional(db: Db, membroId: string, data: string) {
  const f = filaDoProfissional(db, membroId, data);
  return {
    total: f.agora.length + f.proximos.length + f.concluidos.length,
    concluidos: f.concluidos.length,
    comissao: f.concluidos.reduce((s, a) => s + comissaoDoAtendimento(db, a), 0),
  };
}

/** Quando o banho começou de fato (evento "em atendimento"). */
export function inicioDoAtendimento(atd: Atendimento): string | undefined {
  return atd.eventos.findLast((e) => e.para === "em_atendimento")?.em;
}

/**
 * Pets finalizados no dia esperando o tutor: ninguém mandou o "pet pronto" e o serviço ainda não foi pago
 * (pagamento registrado = tutor já passou no balcão).
 */
export function prontosParaAvisar(db: Db, data: string): Atendimento[] {
  const modelosPronto = new Set(db.mensagemModelos.filter((m) => m.gatilho === "pet_pronto").map((m) => m.id));
  const avisados = new Set(db.mensagensEnvios.filter((e) => e.atendimentoId && modelosPronto.has(e.modeloId)).map((e) => e.atendimentoId));
  const pagos = new Set(db.lancamentos.filter((l) => l.atendimentoId && l.status === "pago").map((l) => l.atendimentoId));
  return atendimentosDoDia(db, data).filter((a) => a.status === "finalizado" && !avisados.has(a.id) && !pagos.has(a.id));
}
