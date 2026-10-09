// Tipos de domínio do APP PET.
// Espelham as tabelas do Supabase (supabase/migrations/0001_init.sql).
// No protótipo os dados vivem no navegador; na integração, cada tipo vira uma tabela.

export type Porte = "P" | "M" | "G" | "GG";
export type Especie = "cao" | "gato";
export type Papel = "dono" | "recepcao" | "banhista" | "motorista";

/** Leva e traz: o que o pet shop faz pelo tutor neste atendimento. */
export type Transporte = "nenhum" | "busca" | "entrega" | "busca_e_entrega";

/**
 * Momentos do dia do pet que o tutor acompanha pelo link (com foto opcional).
 * Os de transporte são registrados pelo motorista; os demais, pela equipe do banho.
 */
export type Etapa =
  | "saiu_para_buscar"
  | "pet_buscado"
  | "chegou"
  | "banho"
  | "secagem"
  | "tosa"
  | "pronto"
  | "saiu_para_entregar"
  | "entregue";

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
  | "acompanhamento"
  | "pet_pronto"
  | "feedback"
  | "renovacao_plano"
  | "cliente_sumido"
  | "vacina";

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
  endereco?: string;
  /** Página pública /agendar/{slug} ligada. */
  agendamentoOnline: boolean;
  /** Chave Pix para o sinal do agendamento online (CPF/CNPJ, celular, e-mail ou aleatória). */
  pixChave?: string;
  pixCidade?: string;
  /** % do total pedido como sinal no agendamento online (0 = sem sinal). */
  sinalPct: number;
  /** Cartão fidelidade: a cada N atendimentos que contam, um prêmio. */
  fidelidadeAtiva: boolean;
  fidelidadeMeta: number;
  /** Serviços que contam selo. Vazio = banho e tosa. */
  fidelidadeServicoIds: string[];
  fidelidadePremio: string;
}

export interface Membro {
  id: string;
  nome: string;
  papel: Papel;
  comissaoPct: number;
  /** Não recebe comissão (ex.: o dono que também atende). */
  semComissao?: boolean;
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
  nascimento?: string; // YYYY-MM-DD
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

/** Um momento registrado pela equipe (com foto opcional) que aparece na linha do tempo do tutor. */
export interface AtendimentoEtapa {
  id: string;
  atendimentoId: string;
  etapa: Etapa;
  nota?: string;
  fotoUrl?: string;
  porMembroId: string;
  em: string; // ISO
}

/** Última posição conhecida do carro do leva e traz. */
export interface Posicao {
  atendimentoId: string;
  lat: number;
  lng: number;
  precisao?: number; // metros
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
  /** Chave do link de acompanhamento do tutor (/acompanhar/{token}). */
  token: string;
  transporte: Transporte;
  enderecoTransporte?: string;
  motoristaId?: string;
  /** Sinal pedido no agendamento online e se a equipe já conferiu o Pix. */
  sinalValor?: number;
  sinalPago?: boolean;
}

/** Pagamento de comissões a uma pessoa da equipe, fechando um período. */
export interface ComissaoAcerto {
  id: string;
  membroId: string;
  de: string; // YYYY-MM-DD
  ate: string; // YYYY-MM-DD
  valor: number;
  formaPagamento: FormaPagamento;
  lancamentoId?: string;
  criadoEm: string; // ISO
}

export interface PlanoModelo {
  id: string;
  nome: string;
  servicoIds: string[];
  quantidadeUsos: number;
  validadeDias: number;
  preco: number;
  ativo: boolean;
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

// ---------------------------------------------------------------------------
// Produtos e estoque
// ---------------------------------------------------------------------------

export interface Produto {
  id: string;
  nome: string;
  categoria: string;
  precoVenda: number;
  custo?: number;
  /** Saldo atual (soma dos movimentos). */
  estoque: number;
  estoqueMinimo: number;
  unidade: string; // un, kg, L, pct
  ativo: boolean;
  criadoEm: string; // ISO
}

export type TipoMovimento = "entrada" | "venda" | "ajuste" | "estorno";

export interface MovimentoEstoque {
  id: string;
  produtoId: string;
  tipo: TipoMovimento;
  /** Positivo entra, negativo sai. */
  quantidade: number;
  custoUnitario?: number;
  vendaId?: string;
  observacao?: string;
  porMembroId?: string;
  em: string; // ISO
}

export interface VendaItem {
  produtoId?: string;
  nome: string;
  quantidade: number;
  preco: number; // unitário
}

export interface Venda {
  id: string;
  tutorId?: string;
  atendimentoId?: string;
  itens: VendaItem[];
  total: number; // já com desconto
  desconto: number;
  status: "pago" | "pendente" | "cancelada";
  formaPagamento?: FormaPagamento;
  porMembroId?: string;
  lancamentoId?: string;
  criadoEm: string; // ISO
}

// ---------------------------------------------------------------------------
// Carteira de saúde e fidelidade
// ---------------------------------------------------------------------------

export type TipoVacina = "vacina" | "vermifugo" | "antipulgas" | "outro";

export interface Vacina {
  id: string;
  petId: string;
  tipo: TipoVacina;
  nome: string;
  aplicadaEm?: string; // YYYY-MM-DD
  proximaEm?: string; // YYYY-MM-DD
  observacao?: string;
}

export interface ResgateFidelidade {
  id: string;
  petId: string;
  atendimentoId?: string;
  valor: number;
  em: string; // ISO
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
  etapas: AtendimentoEtapa[];
  /** Última posição por atendimento com leva e traz em andamento. */
  posicoes: Posicao[];
  acertos: ComissaoAcerto[];
  produtos: Produto[];
  movimentos: MovimentoEstoque[];
  vendas: Venda[];
  vacinas: Vacina[];
  resgates: ResgateFidelidade[];
}
