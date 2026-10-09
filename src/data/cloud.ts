"use client";

// Adaptador do modo nuvem: carrega o Db do Supabase e grava cada ação.
// As telas não sabem de onde vêm os dados: leem o mesmo Db do modo demonstração.

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Atendimento,
  AtendimentoEtapa,
  Caixa,
  ComissaoAcerto,
  Db,
  FormaPagamento,
  Lancamento,
  Membro,
  MensagemEnvio,
  MensagemModelo,
  Pet,
  Petshop,
  PlanoModelo,
  PlanoPet,
  PlanoUso,
  Porte,
  Posicao,
  Produto,
  MovimentoEstoque,
  ResgateFidelidade,
  Servico,
  Tutor,
  Vacina,
  Venda,
} from "@/domain/types";
import { ErroRegra } from "@/domain/rules";
import { MODELOS_PADRAO } from "@/domain/messages";
import { apagarFoto, caminhoDaUrl, urlPublica } from "@/lib/fotos";
import { SERVICOS } from "./seed";

type Sb = SupabaseClient;
type Linha = Record<string, unknown>;

export const FUSO_PADRAO = "America/Sao_Paulo";
let fuso = FUSO_PADRAO;

const u = <T,>(v: T | null | undefined): T | undefined => (v === null ? undefined : v);
const n = (v: unknown) => Number(v ?? 0);

/** URL pública de uma foto guardada no Storage (ou undefined quando não há foto). */
export function fotoUrl(sb: Sb, path: unknown): string | undefined {
  if (!path) return undefined;
  return urlPublica(sb, String(path));
}

// ---------------------------------------------------------------------------
// Datas no fuso do pet shop
// ---------------------------------------------------------------------------

export function partesNoFuso(iso: string, tz = fuso): { data: string; hora: string } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return { data: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
}

/** "2026-10-06" + "09:00" no fuso → "2026-10-06T09:00:00-03:00" */
export function isoNoFuso(data: string, hora: string, tz = fuso): string {
  const nome = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" })
    .formatToParts(new Date(`${data}T12:00:00Z`))
    .find((x) => x.type === "timeZoneName")?.value;
  const offset = nome && nome !== "GMT" ? nome.replace("GMT", "") : "+00:00";
  return `${data}T${hora}:00${offset}`;
}

// ---------------------------------------------------------------------------
// Erros do banco em português
// ---------------------------------------------------------------------------

export function traduzirErro(e: unknown): ErroRegra {
  const err = e as { code?: string; message?: string };
  const msg = err?.message ?? String(e);
  if (err?.code === "23P01" || msg.includes("atendimentos_sem_conflito"))
    return new ErroRegra("Conflito de horário: este profissional já tem um atendimento nesse período.");
  if (msg.includes("planos_pet_um_ativo")) return new ErroRegra("Este pet já tem um plano ativo.");
  if (msg.includes("petshops_slug_key")) return new ErroRegra("Esse endereço de página já é usado por outro pet shop. Escolha outro.");
  if (msg.includes("petshops_slug_formato")) return new ErroRegra("Endereço da página: só letras minúsculas, números e hífen.");
  if (msg.includes("tutores_petshop_id_whatsapp_key")) return new ErroRegra("Já existe outro cliente com este WhatsApp.");
  if (err?.code === "23505") return new ErroRegra("Já existe um cadastro com esses dados.");
  if (err?.code === "42501" || msg.includes("row-level security")) return new ErroRegra("Sem permissão para esta ação.");
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) return new ErroRegra("Sem conexão. Verifique a internet.");
  return new ErroRegra(msg);
}

async function ok<T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw traduzirErro(error);
  return data;
}

// ---------------------------------------------------------------------------
// Carregar
// ---------------------------------------------------------------------------

export type Carga = { tipo: "ok"; db: Db; petshopId: string } | { tipo: "sem-petshop" };

export async function carregar(sb: Sb, userId: string): Promise<Carga> {
  const meus = await ok(sb.from("membros").select("*").eq("user_id", userId).eq("ativo", true).limit(1));
  if (!meus?.length) return { tipo: "sem-petshop" };
  const eu = meus[0] as Linha;
  const ps = eu.petshop_id as string;

  const t = (tabela: string) => ok(sb.from(tabela).select("*").eq("petshop_id", ps));
  const [
    [petshop],
    membros,
    tutores,
    pets,
    servicos,
    precos,
    atendimentos,
    itens,
    eventos,
    modelos,
    planos,
    usos,
    lancamentos,
    caixas,
    msgModelos,
    envios,
    convites,
    etapas,
    posicoes,
    acertos,
    produtos,
    movimentos,
    vendas,
    vendaItens,
    vacinas,
    resgates,
  ] = (await Promise.all([
    ok(sb.from("petshops").select("*").eq("id", ps)),
    t("membros"),
    t("tutores"),
    t("pets"),
    t("servicos"),
    t("servico_precos"),
    t("atendimentos"),
    t("atendimento_itens"),
    t("atendimento_eventos"),
    t("planos_modelo"),
    t("planos_pet"),
    t("plano_usos"),
    t("lancamentos"),
    t("caixas"),
    t("mensagem_modelos"),
    t("mensagens_envios"),
    t("convites"), // RLS: só o dono recebe linhas
    t("atendimento_etapas"),
    // Só a posição mais recente das últimas 24 h interessa (o resto é histórico do GPS).
    ok(sb.from("rota_posicoes").select("*").eq("petshop_id", ps).gte("em", new Date(Date.now() - 864e5).toISOString()).order("em", { ascending: false }).limit(500)),
    t("comissao_acertos"), // RLS: dono vê todos; cada pessoa vê os seus
    t("produtos"),
    // Estoque e vendas: só dono e recepção recebem linhas (RLS). Histórico de estoque: os 3.000 mais recentes.
    ok(sb.from("estoque_movimentos").select("*").eq("petshop_id", ps).order("em", { ascending: false }).limit(3000)),
    t("vendas"),
    t("venda_itens"),
    t("pet_vacinas"),
    t("fidelidade_resgates"),
  ])) as Linha[][];

  fuso = (petshop.fuso as string) || FUSO_PADRAO;

  const db: Db = {
    petshop: {
      id: petshop.id as string,
      nome: petshop.nome as string,
      slug: petshop.slug as string,
      whatsapp: (petshop.whatsapp as string) ?? "",
      diasAbertos: (petshop.dias_abertos as number[]) ?? [1, 2, 3, 4, 5, 6],
      abre: String(petshop.abre).slice(0, 5),
      fecha: String(petshop.fecha).slice(0, 5),
      faltaConsomeUso: !!petshop.falta_consome_uso,
      diasClienteSumido: n(petshop.dias_cliente_sumido) || 30,
      endereco: u(petshop.endereco as string),
      agendamentoOnline: !!petshop.agendamento_online,
      pixChave: u(petshop.pix_chave as string),
      pixCidade: u(petshop.pix_cidade as string),
      sinalPct: n(petshop.sinal_pct),
      fidelidadeAtiva: !!petshop.fidelidade_ativa,
      fidelidadeMeta: n(petshop.fidelidade_meta) || 10,
      fidelidadeServicoIds: (petshop.fidelidade_servico_ids as string[]) ?? [],
      fidelidadePremio: (petshop.fidelidade_premio as string) || "1 banho grátis",
    },
    usuarioAtualId: eu.id as string,
    membros: membros.map((m): Membro => {
      const conv = convites.find((c) => c.membro_id === m.id);
      return {
        id: m.id as string,
        nome: m.nome as string,
        papel: m.papel as Membro["papel"],
        comissaoPct: n(m.comissao_pct),
        semComissao: !!m.sem_comissao,
        ativo: !!m.ativo,
        temConta: !!m.user_id,
        convite: conv ? { codigo: conv.codigo as string, expiraEm: conv.expira_em as string } : undefined,
      };
    }),
    tutores: tutores.map(
      (x): Tutor => ({
        id: x.id as string,
        nome: x.nome as string,
        whatsapp: x.whatsapp as string,
        email: u(x.email as string),
        endereco: u(x.endereco as string),
        consentimentoWhatsapp: !!x.consentimento_whatsapp_em,
        criadoEm: x.criado_em as string,
      }),
    ),
    pets: pets.map(
      (x): Pet => ({
        id: x.id as string,
        tutorId: x.tutor_id as string,
        nome: x.nome as string,
        especie: x.especie as Pet["especie"],
        raca: (x.raca as string) ?? "",
        porte: x.porte as Porte,
        sexo: u(x.sexo as Pet["sexo"]),
        nascimento: u(x.nascimento as string),
        pesoKg: x.peso_kg === null ? undefined : n(x.peso_kg),
        pelagem: u(x.pelagem as string),
        temperamento: u(x.temperamento as string),
        alergias: u(x.alergias as string),
        cuidados: u(x.cuidados as string),
        observacoes: u(x.observacoes as string),
        fotoUrl: fotoUrl(sb, x.foto_path),
        ultimaVisita: u(x.ultima_visita as string),
      }),
    ),
    servicos: servicos.map((s): Servico => {
      const meusPrecos = precos.filter((p) => p.servico_id === s.id);
      const preco = (porte: Porte) => {
        const p = meusPrecos.find((x) => x.porte === porte);
        return { preco: p ? n(p.preco) : 0, duracaoMin: p ? n(p.duracao_min) : 30 };
      };
      return {
        id: s.id as string,
        nome: s.nome as string,
        categoria: s.categoria as Servico["categoria"],
        precos: { P: preco("P"), M: preco("M"), G: preco("G"), GG: preco("GG") },
        comissaoPct: n(s.comissao_pct),
        ativo: !!s.ativo,
      };
    }),
    atendimentos: atendimentos.map((a): Atendimento => {
      const { data, hora } = partesNoFuso(a.inicio as string);
      return {
        id: a.id as string,
        petId: a.pet_id as string,
        tutorId: a.tutor_id as string,
        profissionalId: a.profissional_id as string,
        data,
        hora,
        duracaoMin: Math.round((Date.parse(a.fim as string) - Date.parse(a.inicio as string)) / 60000),
        status: a.status as Atendimento["status"],
        origem: a.origem as Atendimento["origem"],
        itens: itens
          .filter((i) => i.atendimento_id === a.id)
          .map((i) => ({
            servicoId: i.servico_id as string,
            nome: i.nome as string,
            preco: n(i.preco),
            duracaoMin: n(i.duracao_min),
            cobertoPorPlano: !!i.coberto_por_plano,
          })),
        valorTotal: n(a.valor_total),
        desconto: n(a.desconto),
        planoPetId: u(a.plano_pet_id as string),
        pago: !!a.pago,
        observacoes: u(a.observacoes as string),
        eventos: eventos
          .filter((e) => e.atendimento_id === a.id)
          .sort((x, y) => n(x.id) - n(y.id))
          .map((e) => ({
            de: (e.de as Atendimento["status"]) ?? null,
            para: e.para as Atendimento["status"],
            porMembroId: (e.membro_id as string) ?? "",
            em: e.em as string,
          })),
        token: a.token as string,
        transporte: (a.transporte as Atendimento["transporte"]) ?? "nenhum",
        enderecoTransporte: u(a.endereco_transporte as string),
        motoristaId: u(a.motorista_id as string),
        sinalValor: n(a.sinal_valor) || undefined,
        sinalPago: n(a.sinal_valor) > 0 ? !!a.sinal_pago : undefined,
      };
    }),
    planosModelo: modelos.map(
      (m): PlanoModelo => ({
        id: m.id as string,
        nome: m.nome as string,
        servicoIds: (m.servico_ids as string[]) ?? [],
        quantidadeUsos: n(m.quantidade_usos),
        validadeDias: n(m.validade_dias),
        preco: n(m.preco),
        ativo: m.ativo !== false,
      }),
    ),
    planosPet: planos.map(
      (p): PlanoPet => ({
        id: p.id as string,
        modeloId: (p.modelo_id as string) ?? "",
        nome: p.nome as string,
        petId: p.pet_id as string,
        tutorId: p.tutor_id as string,
        servicoIds: (p.servico_ids as string[]) ?? [],
        totalUsos: n(p.total_usos),
        preco: n(p.preco),
        inicio: p.inicio as string,
        vencimento: p.vencimento as string,
        status: p.status as PlanoPet["status"],
        observacoes: u(p.observacoes as string),
      }),
    ),
    planoUsos: usos.map(
      (x): PlanoUso => ({
        id: x.id as string,
        planoPetId: x.plano_pet_id as string,
        atendimentoId: u(x.atendimento_id as string),
        em: x.em as string,
        estornado: !!x.estornado,
      }),
    ),
    lancamentos: lancamentos.map(
      (l): Lancamento => ({
        id: l.id as string,
        tipo: l.tipo as Lancamento["tipo"],
        categoria: l.categoria as string,
        descricao: l.descricao as string,
        valor: n(l.valor),
        formaPagamento: u(l.forma_pagamento as FormaPagamento),
        status: l.status as Lancamento["status"],
        competencia: l.competencia as string,
        criadoEm: l.criado_em as string,
        pagoEm: u(l.pago_em as string),
        atendimentoId: u(l.atendimento_id as string),
        planoPetId: u(l.plano_pet_id as string),
      }),
    ),
    caixas: caixas.map(
      (c): Caixa => ({
        id: c.id as string,
        data: c.data as string,
        saldoInicial: n(c.saldo_inicial),
        entradas: n(c.entradas),
        saidas: n(c.saidas),
        saldoFinal: n(c.saldo_final),
        fechadoPorId: (c.fechado_por as string) ?? "",
        fechadoEm: c.fechado_em as string,
      }),
    ),
    mensagemModelos: msgModelos
      .map((m): MensagemModelo => ({ id: m.id as string, gatilho: m.gatilho as MensagemModelo["gatilho"], titulo: m.titulo as string, texto: m.texto as string, ativo: !!m.ativo }))
      .sort((a, b) => ORDEM_GATILHOS.indexOf(a.gatilho) - ORDEM_GATILHOS.indexOf(b.gatilho)),
    mensagensEnvios: envios.map(
      (e): MensagemEnvio => ({
        id: e.id as string,
        modeloId: (e.modelo_id as string) ?? "",
        tutorId: e.tutor_id as string,
        atendimentoId: u(e.atendimento_id as string),
        canal: e.canal as MensagemEnvio["canal"],
        enviadoEm: e.enviado_em as string,
      }),
    ),
    etapas: etapas.map(
      (e): AtendimentoEtapa => ({
        id: e.id as string,
        atendimentoId: e.atendimento_id as string,
        etapa: e.etapa as AtendimentoEtapa["etapa"],
        nota: u(e.nota as string),
        fotoUrl: fotoUrl(sb, e.foto_path),
        porMembroId: (e.membro_id as string) ?? "",
        em: e.em as string,
      }),
    ),
    // Vieram ordenadas da mais nova para a mais antiga: a primeira de cada atendimento é a atual.
    posicoes: posicoes
      .filter((p, i, lista) => lista.findIndex((x) => x.atendimento_id === p.atendimento_id) === i)
      .map(
        (p): Posicao => ({
          atendimentoId: p.atendimento_id as string,
          lat: n(p.lat),
          lng: n(p.lng),
          precisao: p.precisao === null ? undefined : n(p.precisao),
          em: p.em as string,
        }),
      ),
    acertos: acertos.map(
      (a): ComissaoAcerto => ({
        id: a.id as string,
        membroId: a.membro_id as string,
        de: a.de as string,
        ate: a.ate as string,
        valor: n(a.valor),
        formaPagamento: a.forma_pagamento as FormaPagamento,
        lancamentoId: u(a.lancamento_id as string),
        criadoEm: a.criado_em as string,
      }),
    ),
    produtos: produtos
      .map(
        (p): Produto => ({
          id: p.id as string,
          nome: p.nome as string,
          categoria: (p.categoria as string) || "Outros",
          precoVenda: n(p.preco_venda),
          custo: p.custo === null ? undefined : n(p.custo),
          estoque: n(p.estoque),
          estoqueMinimo: n(p.estoque_minimo),
          unidade: (p.unidade as string) || "un",
          ativo: !!p.ativo,
          criadoEm: p.criado_em as string,
        }),
      )
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    movimentos: movimentos.map(
      (m): MovimentoEstoque => ({
        id: m.id as string,
        produtoId: m.produto_id as string,
        tipo: m.tipo as MovimentoEstoque["tipo"],
        quantidade: n(m.quantidade),
        custoUnitario: m.custo_unitario === null ? undefined : n(m.custo_unitario),
        vendaId: u(m.venda_id as string),
        observacao: u(m.observacao as string),
        porMembroId: u(m.membro_id as string),
        em: m.em as string,
      }),
    ),
    vendas: vendas.map(
      (v): Venda => ({
        id: v.id as string,
        tutorId: u(v.tutor_id as string),
        atendimentoId: u(v.atendimento_id as string),
        itens: vendaItens
          .filter((i) => i.venda_id === v.id)
          .map((i) => ({ produtoId: u(i.produto_id as string), nome: i.nome as string, quantidade: n(i.quantidade), preco: n(i.preco) })),
        total: n(v.total),
        desconto: n(v.desconto),
        status: v.status as Venda["status"],
        formaPagamento: u(v.forma_pagamento as FormaPagamento),
        porMembroId: u(v.membro_id as string),
        lancamentoId: u(v.lancamento_id as string),
        criadoEm: v.criado_em as string,
      }),
    ),
    vacinas: vacinas.map(
      (v): Vacina => ({
        id: v.id as string,
        petId: v.pet_id as string,
        tipo: v.tipo as Vacina["tipo"],
        nome: v.nome as string,
        aplicadaEm: u(v.aplicada_em as string),
        proximaEm: u(v.proxima_em as string),
        observacao: u(v.observacao as string),
      }),
    ),
    resgates: resgates.map(
      (r): ResgateFidelidade => ({ id: r.id as string, petId: r.pet_id as string, atendimentoId: u(r.atendimento_id as string), valor: n(r.valor), em: r.em as string }),
    ),
  };
  return { tipo: "ok", db, petshopId: ps };
}

const ORDEM_GATILHOS = MODELOS_PADRAO.map((m) => m.gatilho);

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

function slugify(nome: string) {
  const base = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
  return `${base || "petshop"}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function criarPetshop(sb: Sb, input: { nome: string; donoNome: string; whatsapp?: string; termos?: string }) {
  if (input.nome.trim().length < 2) throw new ErroRegra("Informe o nome do pet shop.");
  const ps = (await ok(
    sb.rpc("criar_petshop", {
      p_nome: input.nome.trim(),
      p_slug: slugify(input.nome),
      p_whatsapp: input.whatsapp || null,
      p_dono_nome: input.donoNome.trim() || null,
    }),
  )) as Linha;
  const psId = ps.id as string;
  // Aceite dos termos de uso e da política de privacidade, registrado com data e quem aceitou.
  if (input.termos) await ok(sb.rpc("aceitar_termos", { p_petshop: psId, p_versao: input.termos }));

  // Serviços, preços, pacotes e mensagens padrão (mesmos do modo demonstração).
  const mapa = new Map<string, string>();
  const servicos = SERVICOS.map((s) => {
    const id = crypto.randomUUID();
    mapa.set(s.id, id);
    return { id, petshop_id: psId, nome: s.nome, categoria: s.categoria, comissao_pct: s.comissaoPct, ativo: true };
  });
  await ok(sb.from("servicos").insert(servicos));
  await ok(
    sb.from("servico_precos").insert(
      SERVICOS.flatMap((s) =>
        (Object.keys(s.precos) as Porte[]).map((porte) => ({
          petshop_id: psId,
          servico_id: mapa.get(s.id),
          porte,
          preco: s.precos[porte].preco,
          duracao_min: s.precos[porte].duracaoMin,
        })),
      ),
    ),
  );
  await ok(
    sb.from("planos_modelo").insert([
      { petshop_id: psId, nome: "Pacote 4 banhos", servico_ids: [mapa.get("s_banho")], quantidade_usos: 4, validade_dias: 30, preco: 240 },
      { petshop_id: psId, nome: "Pacote 2 banhos", servico_ids: [mapa.get("s_banho")], quantidade_usos: 2, validade_dias: 30, preco: 130 },
      { petshop_id: psId, nome: "Pacote 4 banho e tosa", servico_ids: [mapa.get("s_banho_tosa")], quantidade_usos: 4, validade_dias: 45, preco: 340 },
    ]),
  );
  await ok(
    sb.from("mensagem_modelos").insert(MODELOS_PADRAO.map((m) => ({ petshop_id: psId, gatilho: m.gatilho, titulo: m.titulo, texto: m.texto, ativo: true }))),
  );
  return psId;
}

// ---------------------------------------------------------------------------
// Gravações (uma por ação do store)
// ---------------------------------------------------------------------------

export const remoto = {
  criarAtendimento: (sb: Sb, ps: string, a: Atendimento) => {
    const inicio = isoNoFuso(a.data, a.hora);
    const fim = new Date(Date.parse(inicio) + a.duracaoMin * 60000).toISOString();
    return ok(
      sb.rpc("criar_atendimento", {
        p_atendimento: {
          id: a.id,
          petshop_id: ps,
          pet_id: a.petId,
          tutor_id: a.tutorId,
          profissional_id: a.profissionalId,
          inicio,
          fim,
          origem: a.origem,
          valor_total: a.valorTotal,
          desconto: a.desconto,
          plano_pet_id: a.planoPetId ?? null,
          observacoes: a.observacoes ?? null,
          token: a.token,
          transporte: a.transporte,
          endereco_transporte: a.enderecoTransporte ?? null,
          motorista_id: a.motoristaId ?? null,
        },
        p_itens: a.itens.map((i) => ({
          servico_id: i.servicoId,
          nome: i.nome,
          preco: i.preco,
          duracao_min: i.duracaoMin,
          coberto_por_plano: i.cobertoPorPlano,
        })),
      }),
    );
  },

  mudarStatus: (sb: Sb, _ps: string, id: string, status: string) => ok(sb.from("atendimentos").update({ status }).eq("id", id).select("id")),

  reatribuir: (sb: Sb, _ps: string, id: string, profissionalId: string) =>
    ok(sb.from("atendimentos").update({ profissional_id: profissionalId }).eq("id", id).select("id")),

  /** Paga pelo atendimento quando houver (o id local da receita pode ainda não ser o do banco). */
  pagar: async (sb: Sb, _ps: string, l: Lancamento, forma: FormaPagamento, pagoEm: string) => {
    let q = sb.from("lancamentos").update({ status: "pago", forma_pagamento: forma, pago_em: pagoEm });
    q = l.atendimentoId ? q.eq("atendimento_id", l.atendimentoId).eq("status", "pendente") : q.eq("id", l.id);
    const linhas = (await ok(q.select("id"))) as Linha[];
    if (!linhas?.length) throw new ErroRegra("Esse valor já foi recebido ou não foi encontrado. Atualizei a tela.");
  },

  lancamento: (sb: Sb, ps: string, l: Lancamento) =>
    ok(
      sb.from("lancamentos").insert({
        id: l.id,
        petshop_id: ps,
        tipo: l.tipo,
        categoria: l.categoria,
        descricao: l.descricao,
        valor: l.valor,
        forma_pagamento: l.formaPagamento ?? null,
        status: l.status,
        competencia: l.competencia,
        pago_em: l.pagoEm ?? null,
        atendimento_id: l.atendimentoId ?? null,
        plano_pet_id: l.planoPetId ?? null,
      }),
    ),

  fecharCaixa: (sb: Sb, ps: string, data: string) => ok(sb.rpc("fechar_caixa", { p_petshop: ps, p_data: data })),

  venderPlano: (sb: Sb, ps: string, p: PlanoPet, l: Lancamento) =>
    ok(
      sb.rpc("vender_plano", {
        p_plano: {
          id: p.id,
          petshop_id: ps,
          modelo_id: p.modeloId || null,
          nome: p.nome,
          pet_id: p.petId,
          tutor_id: p.tutorId,
          servico_ids: p.servicoIds,
          total_usos: p.totalUsos,
          preco: p.preco,
          inicio: p.inicio,
          vencimento: p.vencimento,
          observacoes: p.observacoes ?? null,
        },
        p_lancamento: {
          id: l.id,
          petshop_id: ps,
          tipo: l.tipo,
          categoria: l.categoria,
          descricao: l.descricao,
          valor: l.valor,
          forma_pagamento: l.formaPagamento,
          status: l.status,
          competencia: l.competencia,
          pago_em: l.pagoEm,
        },
      }),
    ),

  usoPlano: (sb: Sb, ps: string, uso: PlanoUso) =>
    ok(sb.from("plano_usos").insert({ id: uso.id, petshop_id: ps, plano_pet_id: uso.planoPetId, em: uso.em })),

  estornarUso: (sb: Sb, _ps: string, id: string) => ok(sb.from("plano_usos").update({ estornado: true }).eq("id", id)),

  tutor: (sb: Sb, ps: string, t: Tutor) =>
    ok(
      sb.from("tutores").insert({
        id: t.id,
        petshop_id: ps,
        nome: t.nome,
        whatsapp: t.whatsapp,
        endereco: t.endereco ?? null,
        consentimento_whatsapp_em: t.consentimentoWhatsapp ? new Date().toISOString() : null,
      }),
    ),

  /** Importação da planilha: tutores e depois pets, em lotes de 500. */
  importar: async (sb: Sb, ps: string, tutores: Tutor[], pets: Pet[]) => {
    const lotes = <T,>(xs: T[]) => Array.from({ length: Math.ceil(xs.length / 500) }, (_, i) => xs.slice(i * 500, i * 500 + 500));
    for (const lote of lotes(tutores))
      await ok(
        sb.from("tutores").insert(
          lote.map((t) => ({
            id: t.id,
            petshop_id: ps,
            nome: t.nome,
            whatsapp: t.whatsapp,
            email: t.email ?? null,
            endereco: t.endereco ?? null,
            origem: "planilha",
            consentimento_whatsapp_em: t.consentimentoWhatsapp ? t.criadoEm : null,
          })),
        ),
      );
    for (const lote of lotes(pets))
      await ok(
        sb.from("pets").insert(
          lote.map((p) => ({
            id: p.id,
            petshop_id: ps,
            tutor_id: p.tutorId,
            nome: p.nome,
            especie: p.especie,
            raca: p.raca || null,
            porte: p.porte,
            sexo: p.sexo ?? null,
            alergias: p.alergias ?? null,
            observacoes: p.observacoes ?? null,
          })),
        ),
      );
  },

  pet: (sb: Sb, ps: string, p: Pet, novo: boolean, fotoPath?: string | null) => {
    const linha: Linha = {
      id: p.id,
      petshop_id: ps,
      tutor_id: p.tutorId,
      nome: p.nome,
      especie: p.especie,
      raca: p.raca || null,
      porte: p.porte,
      sexo: p.sexo ?? null,
      nascimento: p.nascimento ?? null,
      peso_kg: p.pesoKg ?? null,
      pelagem: p.pelagem ?? null,
      temperamento: p.temperamento ?? null,
      alergias: p.alergias ?? null,
      cuidados: p.cuidados ?? null,
      observacoes: p.observacoes ?? null,
    };
    // A foto só muda quando uma nova foi enviada (fotoPath) ou removida (null).
    if (fotoPath !== undefined) linha.foto_path = fotoPath;
    return novo ? ok(sb.from("pets").insert(linha)) : ok(sb.from("pets").update(linha).eq("id", p.id));
  },

  etapa: (sb: Sb, ps: string, e: AtendimentoEtapa, fotoPath?: string) =>
    ok(
      sb.from("atendimento_etapas").insert({
        id: e.id,
        petshop_id: ps,
        atendimento_id: e.atendimentoId,
        etapa: e.etapa,
        nota: e.nota ?? null,
        foto_path: fotoPath ?? null,
        em: e.em,
      }),
    ),

  transporte: (sb: Sb, _ps: string, a: Pick<Atendimento, "id" | "transporte" | "enderecoTransporte" | "motoristaId">) =>
    ok(
      sb
        .from("atendimentos")
        .update({ transporte: a.transporte, endereco_transporte: a.enderecoTransporte ?? null, motorista_id: a.motoristaId ?? null })
        .eq("id", a.id)
        .select("id"),
    ),

  posicao: (sb: Sb, ps: string, p: Posicao) =>
    ok(sb.from("rota_posicoes").insert({ petshop_id: ps, atendimento_id: p.atendimentoId, lat: p.lat, lng: p.lng, precisao: p.precisao ?? null, em: p.em })),

  acerto: (sb: Sb, _ps: string, a: ComissaoAcerto) =>
    ok(sb.rpc("registrar_acerto", { p_membro: a.membroId, p_ate: a.ate, p_forma: a.formaPagamento, p_id: a.id, p_lancamento_id: a.lancamentoId ?? null })),

  modelo: (sb: Sb, _ps: string, id: string, texto: string) => ok(sb.from("mensagem_modelos").update({ texto }).eq("id", id)),

  /** Modelo que faltava no banco (ex.: "vacina" num pet shop antigo). */
  modeloNovo: (sb: Sb, ps: string, m: MensagemModelo) =>
    ok(sb.from("mensagem_modelos").upsert({ id: m.id, petshop_id: ps, gatilho: m.gatilho, titulo: m.titulo, texto: m.texto, ativo: m.ativo }, { onConflict: "petshop_id,gatilho" })),

  envio: (sb: Sb, ps: string, e: MensagemEnvio) =>
    ok(
      sb.from("mensagens_envios").insert({
        id: e.id,
        petshop_id: ps,
        modelo_id: e.modeloId || null,
        tutor_id: e.tutorId,
        atendimento_id: e.atendimentoId ?? null,
        canal: e.canal,
        enviado_em: e.enviadoEm,
      }),
    ),

  servico: async (sb: Sb, ps: string, s: Servico, novo = false) => {
    const linha = { nome: s.nome, categoria: s.categoria, comissao_pct: s.comissaoPct, ativo: s.ativo };
    if (novo) await ok(sb.from("servicos").insert({ id: s.id, petshop_id: ps, ...linha }));
    else await ok(sb.from("servicos").update(linha).eq("id", s.id));
    await ok(
      sb.from("servico_precos").upsert(
        (Object.keys(s.precos) as Porte[]).map((porte) => ({
          petshop_id: ps,
          servico_id: s.id,
          porte,
          preco: s.precos[porte].preco,
          duracao_min: s.precos[porte].duracaoMin,
        })),
        { onConflict: "servico_id,porte" },
      ),
    );
  },

  petshop: (sb: Sb, ps: string, d: Partial<Petshop>) => {
    const linha: Linha = {};
    if (d.nome !== undefined) linha.nome = d.nome;
    if (d.whatsapp !== undefined) linha.whatsapp = d.whatsapp;
    if (d.diasAbertos !== undefined) linha.dias_abertos = d.diasAbertos;
    if (d.abre !== undefined) linha.abre = d.abre;
    if (d.fecha !== undefined) linha.fecha = d.fecha;
    if (d.faltaConsomeUso !== undefined) linha.falta_consome_uso = d.faltaConsomeUso;
    if (d.diasClienteSumido !== undefined) linha.dias_cliente_sumido = d.diasClienteSumido;
    if ("endereco" in d) linha.endereco = d.endereco ?? null;
    if (d.slug !== undefined) linha.slug = d.slug;
    if (d.agendamentoOnline !== undefined) linha.agendamento_online = d.agendamentoOnline;
    if ("pixChave" in d) linha.pix_chave = d.pixChave ?? null;
    if ("pixCidade" in d) linha.pix_cidade = d.pixCidade ?? null;
    if (d.sinalPct !== undefined) linha.sinal_pct = d.sinalPct;
    if (d.fidelidadeAtiva !== undefined) linha.fidelidade_ativa = d.fidelidadeAtiva;
    if (d.fidelidadeMeta !== undefined) linha.fidelidade_meta = d.fidelidadeMeta;
    if (d.fidelidadeServicoIds !== undefined) linha.fidelidade_servico_ids = d.fidelidadeServicoIds;
    if (d.fidelidadePremio !== undefined) linha.fidelidade_premio = d.fidelidadePremio;
    return ok(sb.from("petshops").update(linha).eq("id", ps).select("id"));
  },

  membro: (sb: Sb, ps: string, m: Membro) =>
    ok(sb.from("membros").insert({ id: m.id, petshop_id: ps, nome: m.nome, papel: m.papel, comissao_pct: m.comissaoPct, sem_comissao: !!m.semComissao, ativo: true })),

  membroEditar: (sb: Sb, _ps: string, m: Membro) =>
    ok(
      sb
        .from("membros")
        .update({ nome: m.nome, papel: m.papel, comissao_pct: m.comissaoPct, sem_comissao: !!m.semComissao, ativo: m.ativo })
        .eq("id", m.id)
        .select("id"),
    ),

  tutorEditar: (sb: Sb, _ps: string, t: Tutor, antes?: Tutor) => {
    const linha: Linha = { nome: t.nome, whatsapp: t.whatsapp, email: t.email ?? null, endereco: t.endereco ?? null };
    if (!!antes?.consentimentoWhatsapp !== t.consentimentoWhatsapp) linha.consentimento_whatsapp_em = t.consentimentoWhatsapp ? new Date().toISOString() : null;
    return ok(sb.from("tutores").update(linha).eq("id", t.id).select("id"));
  },

  excluirTutor: (sb: Sb, _ps: string, id: string) => ok(sb.from("tutores").delete().eq("id", id).select("id")),

  excluirPet: (sb: Sb, _ps: string, id: string) => ok(sb.from("pets").delete().eq("id", id).select("id")),

  pacote: (sb: Sb, ps: string, m: PlanoModelo, novo: boolean) => {
    const linha = { nome: m.nome, servico_ids: m.servicoIds, quantidade_usos: m.quantidadeUsos, validade_dias: m.validadeDias, preco: m.preco, ativo: m.ativo };
    return novo ? ok(sb.from("planos_modelo").insert({ id: m.id, petshop_id: ps, ...linha })) : ok(sb.from("planos_modelo").update(linha).eq("id", m.id).select("id"));
  },

  /** Cancela o plano; agendamentos que ele cobriria passam a ser cobrados; devolução vira despesa. */
  cancelarPlano: async (sb: Sb, ps: string, p: PlanoPet, afetados: Atendimento[], despesa?: Lancamento) => {
    await ok(sb.from("planos_pet").update({ status: "cancelado", observacoes: p.observacoes ?? null }).eq("id", p.id).select("id"));
    for (const a of afetados) {
      await ok(sb.from("atendimento_itens").update({ coberto_por_plano: false }).eq("atendimento_id", a.id));
      await ok(sb.from("atendimentos").update({ plano_pet_id: null, valor_total: a.valorTotal }).eq("id", a.id));
    }
    if (despesa) await remoto.lancamento(sb, ps, despesa);
  },

  planoObs: (sb: Sb, _ps: string, id: string, observacoes?: string) => ok(sb.from("planos_pet").update({ observacoes: observacoes ?? null }).eq("id", id)),

  /** Reagenda e/ou troca serviços: itens novos entram antes de os antigos saírem (nada se perde se der erro). */
  editarAtendimento: async (sb: Sb, ps: string, a: Atendimento, itensMudaram: boolean) => {
    const inicio = isoNoFuso(a.data, a.hora);
    const fim = new Date(Date.parse(inicio) + a.duracaoMin * 60000).toISOString();
    let antigos: Linha[] = [];
    if (itensMudaram) {
      antigos = (await ok(sb.from("atendimento_itens").select("id").eq("atendimento_id", a.id))) as Linha[];
      await ok(
        sb.from("atendimento_itens").insert(
          a.itens.map((i) => ({ petshop_id: ps, atendimento_id: a.id, servico_id: i.servicoId, nome: i.nome, preco: i.preco, duracao_min: i.duracaoMin, coberto_por_plano: i.cobertoPorPlano })),
        ),
      );
    }
    await ok(
      sb
        .from("atendimentos")
        .update({
          inicio,
          fim,
          profissional_id: a.profissionalId,
          valor_total: a.valorTotal,
          desconto: a.desconto,
          plano_pet_id: a.planoPetId ?? null,
          observacoes: a.observacoes ?? null,
        })
        .eq("id", a.id)
        .select("id"),
    );
    if (antigos.length) await ok(sb.from("atendimento_itens").delete().in("id", antigos.map((x) => x.id as string)));
  },

  sinal: async (sb: Sb, ps: string, atendimentoId: string, l: Lancamento) => {
    await remoto.lancamento(sb, ps, l);
    await ok(sb.from("atendimentos").update({ sinal_pago: true }).eq("id", atendimentoId));
  },

  estornarPagamento: async (sb: Sb, _ps: string, l: Lancamento) => {
    await ok(sb.from("lancamentos").update({ status: "pendente", pago_em: null, forma_pagamento: null }).eq("id", l.id).select("id"));
    if (l.atendimentoId) await ok(sb.from("atendimentos").update({ pago: false }).eq("id", l.atendimentoId));
  },

  excluirLancamento: (sb: Sb, _ps: string, id: string) => ok(sb.from("lancamentos").delete().eq("id", id).select("id")),

  modeloEditar: (sb: Sb, _ps: string, m: MensagemModelo) =>
    ok(sb.from("mensagem_modelos").update({ titulo: m.titulo, texto: m.texto, ativo: m.ativo }).eq("id", m.id).select("id")),

  removerEtapa: async (sb: Sb, _ps: string, e: AtendimentoEtapa, soFoto: boolean) => {
    if (soFoto) await ok(sb.from("atendimento_etapas").update({ foto_path: null }).eq("id", e.id));
    else await ok(sb.from("atendimento_etapas").delete().eq("id", e.id));
    const path = caminhoDaUrl(e.fotoUrl);
    if (path) await apagarFoto(sb, path).catch(() => undefined); // a foto órfã não atrapalha
  },

  produto: (sb: Sb, ps: string, p: Produto, novo: boolean) => {
    const linha = { nome: p.nome, categoria: p.categoria, preco_venda: p.precoVenda, custo: p.custo ?? null, estoque_minimo: p.estoqueMinimo, unidade: p.unidade, ativo: p.ativo };
    return novo ? ok(sb.from("produtos").insert({ id: p.id, petshop_id: ps, ...linha })) : ok(sb.from("produtos").update(linha).eq("id", p.id).select("id"));
  },

  /** Entrada, ajuste ou estoque inicial (com a despesa da compra, se houver), numa transação. */
  movimento: (sb: Sb, ps: string, m: MovimentoEstoque, despesa?: Lancamento) =>
    ok(
      sb.rpc("registrar_entrada_estoque", {
        p_mov: { id: m.id, petshop_id: ps, produto_id: m.produtoId, tipo: m.tipo, quantidade: m.quantidade, custo_unitario: m.custoUnitario ?? null, observacao: m.observacao ?? null },
        p_despesa: despesa ? linhaLancamento(ps, despesa) : null,
      }),
    ),

  venda: (sb: Sb, ps: string, v: Venda, l?: Lancamento) =>
    ok(
      sb.rpc("registrar_venda", {
        p_venda: { id: v.id, petshop_id: ps, tutor_id: v.tutorId ?? null, atendimento_id: v.atendimentoId ?? null, total: v.total, desconto: v.desconto, status: v.status, forma_pagamento: v.formaPagamento ?? null },
        p_itens: v.itens.map((i) => ({ produto_id: i.produtoId ?? null, nome: i.nome, quantidade: i.quantidade, preco: i.preco })),
        p_lancamento: l ? linhaLancamento(ps, l) : null,
      }),
    ),

  cancelarVenda: async (sb: Sb, ps: string, v: Venda, estornos: MovimentoEstoque[], removerLancamento?: string, despesa?: Lancamento) => {
    await ok(sb.from("vendas").update({ status: "cancelada" }).eq("id", v.id).select("id"));
    if (estornos.length)
      await ok(
        sb.from("estoque_movimentos").insert(
          estornos.map((m) => ({ id: m.id, petshop_id: ps, produto_id: m.produtoId, tipo: "estorno", quantidade: m.quantidade, venda_id: v.id, observacao: m.observacao ?? null })),
        ),
      );
    if (removerLancamento) await ok(sb.from("lancamentos").delete().eq("id", removerLancamento));
    if (despesa) await remoto.lancamento(sb, ps, despesa);
  },

  vacina: (sb: Sb, ps: string, v: Vacina, novo: boolean) => {
    const linha = { pet_id: v.petId, tipo: v.tipo, nome: v.nome, aplicada_em: v.aplicadaEm ?? null, proxima_em: v.proximaEm ?? null, observacao: v.observacao ?? null };
    return novo ? ok(sb.from("pet_vacinas").insert({ id: v.id, petshop_id: ps, ...linha })) : ok(sb.from("pet_vacinas").update(linha).eq("id", v.id).select("id"));
  },

  excluirVacina: (sb: Sb, _ps: string, id: string) => ok(sb.from("pet_vacinas").delete().eq("id", id)),

  resgate: async (sb: Sb, ps: string, r: ResgateFidelidade, a: Atendimento) => {
    await ok(sb.from("fidelidade_resgates").insert({ id: r.id, petshop_id: ps, pet_id: r.petId, atendimento_id: r.atendimentoId ?? null, valor: r.valor, em: r.em }));
    await ok(sb.from("atendimentos").update({ desconto: a.desconto, valor_total: a.valorTotal }).eq("id", a.id));
  },

  desfazerResgate: async (sb: Sb, _ps: string, a: Atendimento) => {
    await ok(sb.from("fidelidade_resgates").delete().eq("atendimento_id", a.id));
    await ok(sb.from("atendimentos").update({ desconto: a.desconto, valor_total: a.valorTotal }).eq("id", a.id));
  },

  /** Cancelou ou faltou: o prêmio de fidelidade usado volta para o cartão. */
  liberarResgate: (sb: Sb, _ps: string, atendimentoId: string) => ok(sb.from("fidelidade_resgates").delete().eq("atendimento_id", atendimentoId)),
};

function linhaLancamento(ps: string, l: Lancamento): Linha {
  return {
    id: l.id,
    petshop_id: ps,
    tipo: l.tipo,
    categoria: l.categoria,
    descricao: l.descricao,
    valor: l.valor,
    forma_pagamento: l.formaPagamento ?? null,
    status: l.status,
    competencia: l.competencia,
    pago_em: l.pagoEm ?? null,
    atendimento_id: l.atendimentoId ?? null,
    plano_pet_id: l.planoPetId ?? null,
  };
}

// ---------------------------------------------------------------------------
// Convites da equipe
// ---------------------------------------------------------------------------

/** Dono gera (ou renova) o código de 6 letras de quem ainda não entra no app. */
export async function gerarConvite(sb: Sb, membroId: string): Promise<{ codigo: string; expiraEm: string }> {
  const linha = (await ok(sb.rpc("gerar_convite", { p_membro: membroId }))) as Linha;
  return { codigo: linha.codigo as string, expiraEm: linha.expira_em as string };
}

/** A pessoa convidada, já logada, usa o código e passa a fazer parte do pet shop. */
export async function aceitarConvite(sb: Sb, codigo: string): Promise<string> {
  return (await ok(sb.rpc("aceitar_convite", { p_codigo: codigo }))) as string;
}
