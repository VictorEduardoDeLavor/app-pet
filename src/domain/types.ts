// Tipos de domínio do APP PET.
// Espelham as tabelas do Supabase (supabase/migrations/0001_init.sql).
// No protótipo os dados vivem no navegador; na integração, cada tipo vira uma tabela.

export type Porte = "P" | "M" | "G" | "GG";
export type Especie = "cao" | "gato";
export type Papel = "dono" | "recepcao" | "banhista";

export type StatusAtendimento =
  | "agendado"
  | "confirmado"
  | "em_atendimento"
  | "finalizado"
  | "cancelado"
  | "faltou";

export type FormaPagamento = "dinheiro" | "debito" | "credito" | "pix" | "transferencia";
export type StatusPlano = "ativo" | "finalizado" | "vencido" | "cancelado";
export type GatilhoMensagem =
  | "confirmacao"
  | "lembrete"
  | "pet_pronto"
  | "feedback"
  | "renovacao_plano"
  | "cliente_sumido";

export interface Petshop {
  id: string;
  nome: string;
  slug: string;
  whatsapp: string;
  /** Dias da semana abertos: 0 = domingo ... 6 = sábado */
  diasAbertos: number[];
  abre: string; // "08:00"
  fecha: string; // "18:00"
  faltaConsomeUso: boolean;
  diasClienteSumido: number;
}

export interface Membro {
  id: string;
  nome: string;
  papel: Papel;
  comissaoPct: number;
  ativo: boolean;
  /** Já entra no app com login próprio. */
  temConta?: boolean;
  /** Convite pendente (só o dono vê). */
  convite?: { codigo: string; expiraEm: string };
}

export interface Tutor {
  id: string;
  nome: string;
  whatsapp: string; // só dígitos, com DDI: 5511988776655
  email?: string;
  endereco?: string;
  consentimentoWhatsapp: boolean;
  criadoEm: string; // ISO
}

export interface Pet {
  id: string;
  tutorId: string;
  nome: string;
  especie: Especie;
  raca: string;
  porte: Porte;
  sexo?: "M" | "F";
  pesoKg?: number;
  pelagem?: string;
  temperamento?: string;
  alergias?: string;
  cuidados?: string;
  observacoes?: string;
  fotoUrl?: string;
  ultimaVisita?: string; // YYYY-MM-DD
}

export interface PrecoPorte {
  preco: number;
  duracaoMin: number;
}

export interface Servico {
  id: string;
  nome: string;
  categoria: "banho" | "tosa" | "estetica" | "outros";
  precos: Record<Porte, PrecoPorte>;
  comissaoPct: number;
  ativo: boolean;
}

export interface AtendimentoItem {
  servicoId: string;
  nome: string;
  preco: number;
  duracaoMin: number;
  cobertoPorPlano: boolean;
}

export interface AtendimentoEvento {
  de: StatusAtendimento | null;
  para: StatusAtendimento;
  porMembroId: string;
  em: string; // ISO
}

export interface Atendimento {
  id: string;
  petId: string;
  tutorId: string;
  profissionalId: string;
  data: string; // YYYY-MM-DD
  hora: string; // HH:MM
  duracaoMin: number;
  status: StatusAtendimento;
  origem: "balcao" | "portal";
  itens: AtendimentoItem[];
  valorTotal: number; // soma do que será cobrado (itens não cobertos − desconto)
  desconto: number;
  planoPetId?: string;
  pago: boolean;
  observacoes?: string;
  eventos: AtendimentoEvento[];
}

export interface PlanoModelo {
  id: string;
  nome: string;
  servicoIds: string[];
  quantidadeUsos: number;
  validadeDias: number;
  preco: number;
}

export interface PlanoPet {
  id: string;
  modeloId: string;
  nome: string;
  petId: string;
  tutorId: string;
  servicoIds: string[];
  totalUsos: number;
  preco: number;
  inicio: string; // YYYY-MM-DD
  vencimento: string; // YYYY-MM-DD
  status: StatusPlano;
  observacoes?: string;
}

export interface PlanoUso {
  id: string;
  planoPetId: string;
  atendimentoId?: string;
  em: string; // ISO
  estornado: boolean;
}

export interface Lancamento {
  id: string;
  tipo: "receita" | "despesa";
  categoria: string;
  descricao: string;
  valor: number;
  formaPagamento?: FormaPagamento;
  status: "pendente" | "pago";
  competencia: string; // YYYY-MM-DD
  criadoEm: string; // ISO
  pagoEm?: string; // ISO
  atendimentoId?: string;
  planoPetId?: string;
}

export interface Caixa {
  id: string;
  data: string; // YYYY-MM-DD
  saldoInicial: number;
  entradas: number;
  saidas: number;
  saldoFinal: number;
  fechadoPorId: string;
  fechadoEm: string; // ISO
}

export interface MensagemModelo {
  id: string;
  gatilho: GatilhoMensagem;
  titulo: string;
  texto: string;
  ativo: boolean;
}

export interface MensagemEnvio {
  id: string;
  modeloId: string;
  tutorId: string;
  atendimentoId?: string;
  canal: "manual" | "api";
  enviadoEm: string; // ISO
}

export interface Db {
  petshop: Petshop;
  usuarioAtualId: string;
  membros: Membro[];
  tutores: Tutor[];
  pets: Pet[];
  servicos: Servico[];
  atendimentos: Atendimento[];
  planosModelo: PlanoModelo[];
  planosPet: PlanoPet[];
  planoUsos: PlanoUso[];
  lancamentos: Lancamento[];
  caixas: Caixa[];
  mensagemModelos: MensagemModelo[];
  mensagensEnvios: MensagemEnvio[];
}
