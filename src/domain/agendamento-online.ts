// Agendamento online: a página pública do pet shop (/agendar/{slug}) onde o tutor escolhe
// serviços, dia e horário. Os mesmos cálculos servem para a demonstração (Db local) e para o banco
// (resposta da função agenda_publica). O banco revalida tudo em agendar_online().

import type { Db, Porte, Servico } from "./types";
import { ErroRegra, criarAtendimento, criarPet, criarTutor, profissionais } from "./rules";
import { diaDaSemana, hoje, horaDeMinutos, minutos, somaDias } from "./format";

export interface ServicoPublico {
  id: string;
  nome: string;
  categoria: Servico["categoria"];
  precos: Partial<Record<Porte, { preco: number; duracao: number }>>;
}

export interface AgendaPublica {
  petshop: {
    nome: string;
    whatsapp?: string;
    endereco?: string;
    diasAbertos: number[];
    abre: string;
    fecha: string;
    sinalPct: number;
  };
  servicos: ServicoPublico[];
  /** Quem pode atender (banhistas e o dono). */
  equipe: string[];
  /** Horários ocupados: profissional, data e minutos de início e fim. */
  ocupados: { p: string; data: string; ini: number; fim: number }[];
}

export interface PedidoOnline {
  nome: string;
  whatsapp: string;
  pet: string;
  especie: "cao" | "gato";
  raca?: string;
  porte: Porte;
  servicos: string[];
  data: string;
  hora: string;
  observacoes?: string;
  aceite: boolean;
}

export interface Confirmacao {
  token: string;
  data: string;
  hora: string;
  total: number;
  sinal: number;
  pixChave?: string;
  pixCidade?: string;
  petshop: string;
  whatsapp?: string;
}

/** A mesma agenda pública, montada a partir dos dados de exemplo (modo demonstração). */
export function agendaDoDb(db: Db, de: string = hoje(), dias = 21): AgendaPublica {
  const ate = somaDias(de, dias);
  return {
    petshop: {
      nome: db.petshop.nome,
      whatsapp: db.petshop.whatsapp || undefined,
      endereco: db.petshop.endereco,
      diasAbertos: db.petshop.diasAbertos,
      abre: db.petshop.abre,
      fecha: db.petshop.fecha,
      sinalPct: db.petshop.pixChave ? db.petshop.sinalPct : 0,
    },
    servicos: db.servicos
      .filter((s) => s.ativo)
      .map((s) => ({
        id: s.id,
        nome: s.nome,
        categoria: s.categoria,
        precos: Object.fromEntries(Object.entries(s.precos).map(([p, v]) => [p, { preco: v.preco, duracao: v.duracaoMin }])),
      })),
    equipe: profissionais(db).map((m) => m.id),
    ocupados: db.atendimentos
      .filter((a) => a.data >= de && a.data <= ate && !["cancelado", "faltou"].includes(a.status))
      .map((a) => ({ p: a.profissionalId, data: a.data, ini: minutos(a.hora), fim: minutos(a.hora) + a.duracaoMin })),
  };
}

export function resumoDoPedido(agenda: AgendaPublica, porte: Porte, servicoIds: string[]): { total: number; duracao: number; sinal: number } {
  let total = 0;
  let duracao = 0;
  for (const id of servicoIds) {
    const p = agenda.servicos.find((s) => s.id === id)?.precos[porte];
    if (!p) continue;
    total += p.preco;
    duracao += p.duracao;
  }
  total = Math.round(total * 100) / 100;
  return { total, duracao, sinal: Math.round(total * agenda.petshop.sinalPct) / 100 };
}

/** Próximos dias em que o pet shop abre. */
export function diasDoCalendario(agenda: AgendaPublica, de: string, quantos = 14): string[] {
  const dias: string[] = [];
  for (let i = 0; dias.length < quantos && i < 60; i++) {
    const d = somaDias(de, i);
    if (agenda.petshop.diasAbertos.includes(diaDaSemana(d))) dias.push(d);
  }
  return dias;
}

/**
 * Horários de 30 em 30 min em que pelo menos uma pessoa da equipe está livre pelo tempo todo do serviço,
 * com no mínimo 30 min de antecedência (mesma regra do banco).
 */
export function horariosOnline(agenda: AgendaPublica, data: string, duracao: number, agora: Date = new Date()): string[] {
  if (!agenda.petshop.diasAbertos.includes(diaDaSemana(data)) || duracao <= 0) return [];
  const abre = minutos(agenda.petshop.abre);
  const fecha = minutos(agenda.petshop.fecha);
  const hojeStr = hoje(agora);
  if (data < hojeStr) return [];
  const minimo = data === hojeStr ? agora.getHours() * 60 + agora.getMinutes() + 30 : -1;
  const livres: string[] = [];
  for (let m = abre; m + duracao <= fecha; m += 30) {
    if (m < minimo) continue;
    const alguemLivre = agenda.equipe.some((p) => !agenda.ocupados.some((o) => o.p === p && o.data === data && m < o.fim && o.ini < m + duracao));
    if (alguemLivre) livres.push(horaDeMinutos(m));
  }
  return livres;
}

export function validarPedido(p: PedidoOnline): void {
  if (p.nome.trim().length < 2) throw new ErroRegra("Informe seu nome.");
  let zap = p.whatsapp.replace(/\D/g, "");
  if (zap.length === 10 || zap.length === 11) zap = "55" + zap;
  if (!/^55\d{10,11}$/.test(zap)) throw new ErroRegra("Informe um WhatsApp com DDD.");
  if (!p.pet.trim()) throw new ErroRegra("Informe o nome do pet.");
  if (p.servicos.length === 0) throw new ErroRegra("Escolha pelo menos um serviço.");
  if (!p.data || !p.hora) throw new ErroRegra("Escolha o dia e o horário.");
  if (!p.aceite) throw new ErroRegra("Para agendar, autorize o contato pelo WhatsApp.");
}

const titulo = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, a, b) => a + b.toUpperCase());

/** Demonstração: faz no Db local o que agendar_online() faz no banco. */
export function agendarNoDb(db: Db, p: PedidoOnline, agora: Date): { db: Db; confirmacao: Confirmacao } {
  validarPedido(p);
  if (!db.petshop.agendamentoOnline) throw new ErroRegra("O agendamento online deste pet shop está desligado.");
  const agenda = agendaDoDb(db, hoje(agora), 60);
  const { duracao, total, sinal } = resumoDoPedido(agenda, p.porte, p.servicos);
  if (!horariosOnline(agenda, p.data, duracao, agora).includes(p.hora)) throw new ErroRegra("Esse horário acabou de ser ocupado. Escolha outro.");
  const ini = minutos(p.hora);
  const livres = profissionais(db)
    .sort((a, b) => Number(a.papel === "dono") - Number(b.papel === "dono"))
    .filter((m) => !agenda.ocupados.some((o) => o.p === m.id && o.data === p.data && ini < o.fim && o.ini < ini + duracao));
  if (!livres.length) throw new ErroRegra("Esse horário acabou de ser ocupado. Escolha outro.");

  let zap = p.whatsapp.replace(/\D/g, "");
  if (zap.length <= 11) zap = "55" + zap;
  let novo = db;
  let tutor = novo.tutores.find((t) => t.whatsapp === zap);
  if (!tutor) {
    const r = criarTutor(novo, { nome: titulo(p.nome), whatsapp: zap, consentimentoWhatsapp: true }, agora);
    novo = r.db;
    tutor = r.tutor;
  }
  let pet = novo.pets.find((x) => x.tutorId === tutor!.id && x.nome.toLowerCase() === p.pet.trim().toLowerCase());
  if (!pet) {
    const r = criarPet(novo, { tutorId: tutor.id, nome: titulo(p.pet), especie: p.especie, raca: p.raca?.trim() || "", porte: p.porte });
    novo = r.db;
    pet = r.pet;
  }
  const r = criarAtendimento(
    novo,
    { petId: pet.id, servicoIds: p.servicos, profissionalId: livres[0].id, data: p.data, hora: p.hora, origem: "portal", observacoes: p.observacoes?.trim() || undefined, sinalValor: sinal },
    agora,
  );
  return {
    db: r.db,
    confirmacao: {
      token: r.atendimento.token,
      data: p.data,
      hora: p.hora,
      total,
      sinal,
      pixChave: sinal > 0 ? db.petshop.pixChave : undefined,
      pixCidade: db.petshop.pixCidade,
      petshop: db.petshop.nome,
      whatsapp: db.petshop.whatsapp || undefined,
    },
  };
}

/** Agendamentos feitos pela página que a equipe ainda não confirmou. */
export function pedidosOnlinePendentes(db: Db, ref: string = hoje()) {
  return db.atendimentos
    .filter((a) => a.origem === "portal" && a.status === "agendado" && a.data >= ref)
    .sort((a, b) => (a.data + a.hora < b.data + b.hora ? -1 : 1));
}
