// Mensagens de WhatsApp: modelos com variáveis e link wa.me.
// MVP: envio manual (abre o WhatsApp com o texto pronto). V2: mesmo modelo disparado pela API.

import type { Atendimento, Db, GatilhoMensagem, MensagemModelo, StatusAtendimento } from "./types";
import { dataCurta, diferencaDias, hoje, moeda, primeiroNome } from "./format";
import { porId, saldoPlano } from "./rules";

export const VARIAVEIS = [
  { chave: "tutor", rotulo: "Tutor" },
  { chave: "pet", rotulo: "Pet" },
  { chave: "servico", rotulo: "Serviço" },
  { chave: "data", rotulo: "Data" },
  { chave: "hora", rotulo: "Horário" },
  { chave: "quando", rotulo: "Hoje/amanhã" },
  { chave: "valor", rotulo: "Valor" },
  { chave: "petshop", rotulo: "Pet shop" },
  { chave: "saldo_plano", rotulo: "Saldo do plano" },
  { chave: "link", rotulo: "Link de acompanhamento" },
] as const;

export type Variaveis = Partial<Record<(typeof VARIAVEIS)[number]["chave"], string>>;

export const MODELOS_PADRAO: MensagemModelo[] = [
  {
    id: "msg_confirmacao",
    gatilho: "confirmacao",
    titulo: "Confirmação de horário",
    texto:
      "Olá, {tutor}! Tudo bem? Passando para confirmar o horário de {pet} no dia {data} às {hora} para {servico}. O valor estimado é {valor}. Podemos confirmar?",
    ativo: true,
  },
  {
    id: "msg_lembrete",
    gatilho: "lembrete",
    titulo: "Lembrete de agendamento",
    texto:
      "Olá, {tutor}! Aqui é da {petshop}. Passando para lembrar que {quando}, às {hora}, {pet} tem {servico} com a gente. Até lá!",
    ativo: true,
  },
  {
    id: "msg_acompanhamento",
    gatilho: "acompanhamento",
    titulo: "Acompanhe seu pet",
    texto:
      "Olá, {tutor}! {pet} está com a gente na {petshop}. Acompanhe cada etapa do banho, com fotos, por este link: {link}",
    ativo: true,
  },
  {
    id: "msg_pet_pronto",
    gatilho: "pet_pronto",
    titulo: "Pet pronto para buscar",
    texto:
      "Olá, {tutor}! {pet} já terminou {servico} e está prontinho esperando por você aqui na {petshop}.",
    ativo: true,
  },
  {
    id: "msg_feedback",
    gatilho: "feedback",
    titulo: "Feedback pós-atendimento",
    texto:
      "Olá, {tutor}! Obrigado por trazer {pet} ontem. Como foi a experiência? Sua opinião ajuda a gente a cuidar ainda melhor.",
    ativo: true,
  },
  {
    id: "msg_renovacao",
    gatilho: "renovacao_plano",
    titulo: "Renovação de plano",
    texto:
      "Olá, {tutor}! O plano de {pet} está acabando: restam {saldo_plano}. Quer renovar para manter o mesmo valor?",
    ativo: true,
  },
  {
    id: "msg_sumido",
    gatilho: "cliente_sumido",
    titulo: "Cliente sumido",
    texto:
      "Olá, {tutor}! Estamos com saudades de {pet} aqui na {petshop}. Já faz um tempinho desde o último banho. Quer agendar um horário esta semana?",
    ativo: true,
  },
];

export function renderMensagem(texto: string, vars: Variaveis): string {
  return texto.replace(/\{(\w+)\}/g, (inteiro, chave: string) => {
    const v = vars[chave as keyof Variaveis];
    return v !== undefined && v !== "" ? v : inteiro;
  });
}

/** "hoje", "amanhã" ou "no dia 08/10/2026", relativo à data de referência. */
export function quando(data: string, ref: string = hoje()): string {
  const dias = diferencaDias(ref, data);
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  return `no dia ${dataCurta(data)}`;
}

/** Link que o tutor abre para acompanhar o atendimento (sem senha). */
export function linkAcompanhamento(atd: Pick<Atendimento, "token">, origem?: string): string {
  const base = origem ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/acompanhar/${atd.token}`;
}

export function variaveisDoAtendimento(db: Db, atd: Atendimento, ref: string = hoje()): Variaveis {
  const tutor = porId(db.tutores, atd.tutorId);
  const pet = porId(db.pets, atd.petId);
  const saldo = atd.planoPetId ? saldoPlano(db, atd.planoPetId) : undefined;
  const valor = atd.valorTotal > 0 ? moeda(atd.valorTotal) : "coberto pelo plano";
  return {
    link: linkAcompanhamento(atd),
    tutor: tutor ? primeiroNome(tutor.nome) : undefined,
    pet: pet?.nome,
    servico: atd.itens.map((i) => i.nome.toLowerCase()).join(" + "),
    data: dataCurta(atd.data),
    hora: atd.hora,
    quando: quando(atd.data, ref),
    valor,
    petshop: db.petshop.nome,
    saldo_plano: saldo !== undefined ? `${saldo} ${saldo === 1 ? "banho" : "banhos"}` : undefined,
  };
}

export function gatilhoSugerido(status: StatusAtendimento): GatilhoMensagem {
  switch (status) {
    case "agendado":
      return "confirmacao";
    case "confirmado":
      return "lembrete";
    case "em_atendimento":
      return "acompanhamento";
    case "finalizado":
      return "pet_pronto";
    default:
      return "cliente_sumido";
  }
}

export function modeloPorGatilho(db: Db, gatilho: GatilhoMensagem): MensagemModelo | undefined {
  return db.mensagemModelos.find((m) => m.gatilho === gatilho);
}

export function linkWhatsapp(numero: string, texto: string): string {
  const digitos = numero.replace(/\D/g, "");
  return `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}`;
}
