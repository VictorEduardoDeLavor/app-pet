"use client";

// Estado do app. Dois modos com as mesmas telas:
//  - demo:  dados de exemplo no navegador (localStorage)
//  - nuvem: dados do pet shop no Supabase
// Toda ação roda primeiro as regras de domínio no Db local (resposta instantânea na tela)
// e, no modo nuvem, grava no banco em fila e recarrega. Se o banco recusar, a tela volta
// ao estado do banco e o erro aparece num aviso.

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AtendimentoEtapa,
  Db,
  Etapa,
  Transporte,
  FormaPagamento,
  Membro,
  MensagemEnvio,
  MensagemModelo,
  Pet,
  Petshop,
  PlanoModelo,
  Posicao,
  Produto,
  Servico,
  StatusAtendimento,
  Tutor,
} from "@/domain/types";
import { criarSeed } from "./seed";
import * as R from "@/domain/rules";
import { hoje } from "@/domain/format";
import { MODELOS_PADRAO } from "@/domain/messages";
import { blobParaDataUrl, reduzirFoto, subirFoto, urlPublica } from "@/lib/fotos";
import { carregar, gerarConvite, remoto, traduzirErro } from "./cloud";
import { aplicarImportacao, type Previa } from "@/domain/importacao";
import * as E from "@/domain/edicao";
import * as P from "@/domain/produtos";
import * as V from "@/domain/vacinas";
import * as F from "@/domain/fidelidade";
import { agendarNoDb, type Confirmacao, type PedidoOnline } from "@/domain/agendamento-online";

type Resultado<T = void> = { ok: true; valor: T } | { ok: false; erro: string };
export type Modo = "demo" | "nuvem";

function tentar<T>(fn: () => T): Resultado<T> {
  try {
    return { ok: true, valor: fn() };
  } catch (e) {
    if (e instanceof R.ErroRegra) return { ok: false, erro: e.message };
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Conexão com o Supabase (só no modo nuvem)
// ---------------------------------------------------------------------------

let sb: SupabaseClient | null = null;
let userId: string | null = null;
let fila: Promise<unknown> = Promise.resolve();
const ouvintesErro = new Set<(msg: string) => void>();

export function aoErroDeSincronia(fn: (msg: string) => void) {
  ouvintesErro.add(fn);
  return () => ouvintesErro.delete(fn);
}

interface Estado {
  db: Db;
  versaoSeed: string;
  modo: Modo;
  petshopId: string | null;
  sincronizando: number;

  entrarNuvem: (cliente: SupabaseClient, uid: string, db: Db, petshopId: string) => void;
  recarregar: () => Promise<void>;
  resetar: () => void;

  criarAtendimento: (input: R.NovoAtendimentoInput) => Resultado<string>;
  mudarStatus: (id: string, para: StatusAtendimento) => Resultado<R.EfeitosStatus>;
  reatribuir: (id: string, profissionalId: string) => Resultado;
  pagarLancamento: (lancamentoId: string, forma: FormaPagamento) => Resultado;
  lancarDespesa: (input: R.DespesaInput) => Resultado;
  fecharCaixa: (data: string) => Resultado;
  venderPlano: (input: R.VendaPlanoInput) => Resultado<string>;
  darBaixaManual: (planoId: string) => Resultado;
  estornarUso: (usoId: string) => Resultado;
  criarTutor: (input: { nome: string; whatsapp: string; endereco?: string; consentimentoWhatsapp?: boolean }) => Resultado<string>;
  criarPet: (input: Omit<Pet, "id">) => Resultado<string>;
  /** Clientes e pets vindos de uma planilha, gravados em lote. */
  importarClientes: (previa: Previa, consentimento?: boolean) => Resultado<{ tutores: number; pets: number }>;
  atualizarPet: (pet: Pet) => void;
  criarMembro: (input: { nome: string; papel: Membro["papel"]; comissaoPct: number }) => Resultado<string>;
  salvarModelo: (id: string, texto: string) => void;
  salvarServico: (servico: Servico) => Resultado;
  atualizarPetshop: (dados: Partial<Petshop>) => Resultado;
  restaurarModelos: () => void;
  registrarEnvio: (modeloId: string, tutorId: string, atendimentoId?: string) => void;
  /** Demonstração: ver o app com os olhos de outra pessoa da equipe. */
  entrarComo: (membroId: string) => void;
  convidar: (membroId: string) => Promise<Resultado<{ codigo: string; expiraEm: string }>>;

  /** Registra um momento do atendimento (com foto opcional) na linha do tempo do tutor. */
  registrarEtapa: (input: { atendimentoId: string; etapa: Etapa; nota?: string; foto?: File | null }) => Promise<Resultado<AtendimentoEtapa>>;
  /** Troca (ou remove, com null) a foto do pet. */
  salvarFotoPet: (petId: string, foto: File | null) => Promise<Resultado>;
  /** Posição do carro no leva e traz (chamada pelo rastreio a cada poucos segundos). */
  enviarPosicao: (pos: Posicao) => void;
  registrarAcerto: (input: R.AcertoInput) => Resultado<R.ComissaoAcertoResultado>;
  definirTransporte: (atendimentoId: string, input: { transporte: Transporte; enderecoTransporte?: string; motoristaId?: string }) => Resultado;

  // Edição e correções
  editarMembro: (id: string, dados: Parameters<typeof E.editarMembro>[2]) => Resultado;
  editarTutor: (id: string, dados: Partial<Pick<Tutor, "nome" | "whatsapp" | "email" | "endereco" | "consentimentoWhatsapp">>) => Resultado;
  excluirTutor: (id: string) => Resultado;
  excluirPet: (id: string) => Resultado;
  salvarPacote: (m: PlanoModelo) => Resultado;
  cancelarPlano: (input: E.CancelarPlanoInput) => Resultado;
  editarObservacoesPlano: (planoId: string, observacoes: string) => Resultado;
  editarAtendimento: (id: string, e: E.EdicaoAtendimento) => Resultado;
  registrarSinal: (atendimentoId: string, forma: FormaPagamento) => Resultado;
  lancarReceita: (input: E.ReceitaInput) => Resultado;
  estornarPagamento: (lancamentoId: string) => Resultado;
  excluirLancamento: (lancamentoId: string) => Resultado;
  editarModelo: (id: string, dados: Partial<Pick<MensagemModelo, "titulo" | "texto" | "ativo">>) => Resultado;
  removerEtapa: (etapaId: string, soFoto: boolean) => Resultado;

  // Produtos e estoque
  salvarProduto: (p: Produto, estoqueInicial?: number) => Resultado<string>;
  entradaEstoque: (input: P.EntradaInput) => Resultado;
  ajustarEstoque: (input: { produtoId: string; saldoReal: number; observacao?: string }) => Resultado;
  registrarVenda: (input: P.VendaInput) => Resultado<string>;
  cancelarVenda: (vendaId: string) => Resultado;

  // Vacinas e fidelidade
  salvarVacina: (input: V.VacinaInput) => Resultado;
  excluirVacina: (id: string) => Resultado;
  resgatarFidelidade: (atendimentoId: string) => Resultado;
  desfazerResgate: (atendimentoId: string) => Resultado;

  /** Demonstração: o pedido da página pública cai na agenda deste navegador. */
  agendarOnlineDemo: (pedido: PedidoOnline) => Resultado<Confirmacao>;
}

const ALFABETO_CONVITE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function codigoDemo() {
  const b = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(b, (x) => ALFABETO_CONVITE[x % ALFABETO_CONVITE.length]).join("");
}

const SEED_DO_DIA = () => hoje();

export const useApp = create<Estado>()(
  persist(
    (set, get) => {
      /** Enfileira a gravação no banco e recarrega depois. Nada acontece no modo demo. */
      const gravar = (op: (cliente: SupabaseClient, ps: string) => Promise<unknown>, opcoes: { recarregar?: boolean } = {}) => {
        const { modo, petshopId } = get();
        if (modo !== "nuvem" || !sb || !petshopId) return;
        const cliente = sb;
        set((s) => ({ sincronizando: s.sincronizando + 1 }));
        fila = fila
          .then(() => op(cliente, petshopId))
          .catch((e) => {
            const msg = traduzirErro(e).message;
            ouvintesErro.forEach((fn) => fn(msg));
          })
          .then(() => (opcoes.recarregar === false ? undefined : get().recarregar()))
          .finally(() => set((s) => ({ sincronizando: Math.max(0, s.sincronizando - 1) })));
      };

      /**
       * Reduz a foto e, no modo nuvem, sobe para o Storage. Devolve a URL para a tela e o caminho para o banco.
       * No modo demonstração a foto vira data URL (fica só neste navegador).
       */
      const prepararFoto = async (foto: File, caminho: string): Promise<{ url: string; path?: string }> => {
        const { modo, petshopId } = get();
        if (modo === "nuvem" && sb && petshopId) {
          const blob = await reduzirFoto(foto);
          const path = `${petshopId}/${caminho}`;
          await subirFoto(sb, path, blob);
          return { url: urlPublica(sb, path), path };
        }
        const blob = await reduzirFoto(foto, { maxLado: 640, maxMB: 0.08 });
        return { url: await blobParaDataUrl(blob) };
      };

      /** Aplica a regra local; se passar, grava no banco com o resultado. */
      function aplicar<T, C>(
        fn: (db: Db) => { db: Db; valor: T; ctx?: C },
        remotoOp?: (cliente: SupabaseClient, ps: string, ctx: C, antes: Db) => Promise<unknown>,
      ): Resultado<T> {
        const antes = get().db;
        const r = tentar(() => fn(antes));
        if (!r.ok) return r;
        set({ db: r.valor.db });
        if (remotoOp) gravar((c, ps) => remotoOp(c, ps, r.valor.ctx as C, antes));
        return { ok: true, valor: r.valor.valor };
      }

      return {
        db: criarSeed(),
        versaoSeed: SEED_DO_DIA(),
        modo: "demo",
        petshopId: null,
        sincronizando: 0,

        entrarNuvem: (cliente, uid, db, petshopId) => {
          sb = cliente;
          userId = uid;
          set({ modo: "nuvem", db, petshopId });
        },

        recarregar: async () => {
          if (get().modo !== "nuvem" || !sb || !userId) return;
          try {
            const c = await carregar(sb, userId);
            if (c.tipo === "ok") set({ db: c.db, petshopId: c.petshopId });
          } catch (e) {
            ouvintesErro.forEach((fn) => fn(traduzirErro(e).message));
          }
        },

        resetar: () => {
          if (get().modo === "nuvem") void get().recarregar();
          else set({ db: criarSeed(), versaoSeed: SEED_DO_DIA() });
        },

        criarAtendimento: (input) =>
          aplicar(
            (db) => {
              const r = R.criarAtendimento(db, input, new Date());
              return { db: r.db, valor: r.atendimento.id, ctx: r.atendimento };
            },
            (c, ps, atd) => remoto.criarAtendimento(c, ps, atd),
          ),

        mudarStatus: (id, para) =>
          aplicar(
            (db) => {
              const r = R.mudarStatus(db, id, para, db.usuarioAtualId, new Date());
              return { db: r.db, valor: r.efeitos, ctx: !!F.resgateDoAtendimento(db, id) && (para === "cancelado" || para === "faltou") };
            },
            async (c, ps, liberarPremio) => {
              await remoto.mudarStatus(c, ps, id, para);
              if (liberarPremio) await remoto.liberarResgate(c, ps, id);
            },
          ),

        reatribuir: (id, profissionalId) =>
          aplicar(
            (db) => ({ db: R.reatribuir(db, id, profissionalId), valor: undefined }),
            (c, ps) => remoto.reatribuir(c, ps, id, profissionalId),
          ),

        pagarLancamento: (lancamentoId, forma) => {
          const agora = new Date();
          return aplicar(
            (db) => ({ db: R.pagarLancamento(db, lancamentoId, forma, agora), valor: undefined }),
            (c, ps, _ctx, antes) => remoto.pagar(c, ps, R.porId(antes.lancamentos, lancamentoId)!, forma, agora.toISOString()),
          );
        },

        lancarDespesa: (input) =>
          aplicar(
            (db) => {
              const novo = R.lancarDespesa(db, input, new Date());
              return { db: novo, valor: undefined, ctx: novo.lancamentos.at(-1)! };
            },
            (c, ps, l) => remoto.lancamento(c, ps, l),
          ),

        fecharCaixa: (data) =>
          aplicar(
            (db) => ({ db: R.fecharCaixa(db, data, db.usuarioAtualId, new Date()), valor: undefined }),
            (c, ps) => remoto.fecharCaixa(c, ps, data),
          ),

        venderPlano: (input) =>
          aplicar(
            (db) => {
              const r = R.venderPlano(db, input, new Date());
              return { db: r.db, valor: r.plano.id, ctx: { plano: r.plano, lanc: r.db.lancamentos.at(-1)! } };
            },
            (c, ps, ctx) => remoto.venderPlano(c, ps, ctx.plano, ctx.lanc),
          ),

        darBaixaManual: (planoId) =>
          aplicar(
            (db) => {
              const novo = R.darBaixaManual(db, planoId, new Date());
              return { db: novo, valor: undefined, ctx: novo.planoUsos.at(-1)! };
            },
            (c, ps, uso) => remoto.usoPlano(c, ps, uso),
          ),

        estornarUso: (usoId) =>
          aplicar(
            (db) => ({ db: E.desfazerUso(db, usoId), valor: undefined }),
            (c, ps) => remoto.estornarUso(c, ps, usoId),
          ),

        criarTutor: (input) =>
          aplicar(
            (db) => {
              const r = R.criarTutor(db, input, new Date());
              return { db: r.db, valor: r.tutor.id, ctx: r.tutor };
            },
            (c, ps, t) => remoto.tutor(c, ps, t),
          ),

        criarPet: (input) =>
          aplicar(
            (db) => {
              const r = R.criarPet(db, input);
              return { db: r.db, valor: r.pet.id, ctx: r.pet };
            },
            (c, ps, p) => remoto.pet(c, ps, p, true),
          ),

        importarClientes: (previa, consentimento = true) =>
          aplicar(
            (db) => {
              const r = aplicarImportacao(db, previa, new Date(), consentimento);
              return { db: r.db, valor: { tutores: r.tutores.length, pets: r.pets.length }, ctx: r };
            },
            (c, ps, r) => remoto.importar(c, ps, r.tutores, r.pets),
          ),

        atualizarPet: (pet) => {
          aplicar(
            (db) => ({ db: R.atualizarPet(db, pet), valor: undefined }),
            (c, ps) => remoto.pet(c, ps, pet, false),
          );
        },

        criarMembro: (input) =>
          aplicar(
            (db) => {
              const r = R.criarMembro(db, input);
              return { db: r.db, valor: r.membro.id, ctx: r.membro };
            },
            (c, ps, m) => remoto.membro(c, ps, m),
          ),

        salvarModelo: (id, texto) => {
          aplicar(
            (db) => ({ db: { ...db, mensagemModelos: db.mensagemModelos.map((m) => (m.id === id ? { ...m, texto } : m)) }, valor: undefined }),
            (c, ps) => remoto.modelo(c, ps, id, texto),
          );
        },

        salvarServico: (servico) =>
          aplicar(
            (db) => {
              const r = E.salvarServico(db, servico);
              return { db: r.db, valor: undefined, ctx: r };
            },
            (c, ps, r) => remoto.servico(c, ps, r.servico, r.novo),
          ),

        atualizarPetshop: (dados) =>
          aplicar(
            (db) => {
              const r = E.editarPetshop(db, dados);
              return { db: r.db, valor: undefined, ctx: r.dados };
            },
            (c, ps, d) => remoto.petshop(c, ps, d),
          ),

        restaurarModelos: () => {
          const padrao = new Map(MODELOS_PADRAO.map((m) => [m.gatilho, m]));
          aplicar(
            (db) => {
              const modelos = db.mensagemModelos.map((m) => ({ ...m, titulo: padrao.get(m.gatilho)?.titulo ?? m.titulo, texto: padrao.get(m.gatilho)?.texto ?? m.texto, ativo: true }));
              // Modelos que surgiram depois (ex.: lembrete de vacina) entram também.
              const faltam = MODELOS_PADRAO.filter((p) => !modelos.some((m) => m.gatilho === p.gatilho)).map((m) => ({ ...m, id: R.uid() }));
              const todos = [...modelos, ...faltam].sort((a, b) => MODELOS_PADRAO.findIndex((x) => x.gatilho === a.gatilho) - MODELOS_PADRAO.findIndex((x) => x.gatilho === b.gatilho));
              return { db: { ...db, mensagemModelos: todos }, valor: undefined, ctx: { modelos, faltam } };
            },
            async (c, ps, { modelos, faltam }) => {
              await Promise.all(modelos.map((m) => remoto.modeloEditar(c, ps, m)));
              for (const m of faltam) await remoto.modeloNovo(c, ps, m);
            },
          );
        },

        entrarComo: (membroId) => {
          if (get().modo !== "demo") return;
          set((s) => ({ db: { ...s.db, usuarioAtualId: membroId } }));
        },

        convidar: async (membroId) => {
          const { modo } = get();
          try {
            // Espera gravações pendentes (ex.: o membro recém-criado) antes de pedir o código ao banco.
            if (modo === "nuvem") await fila;
            const convite =
              modo === "nuvem" && sb
                ? await gerarConvite(sb, membroId)
                : { codigo: codigoDemo(), expiraEm: new Date(Date.now() + 7 * 864e5).toISOString() };
            set((s) => ({ db: { ...s.db, membros: s.db.membros.map((m) => (m.id === membroId ? { ...m, convite } : m)) } }));
            return { ok: true, valor: convite };
          } catch (e) {
            return { ok: false, erro: traduzirErro(e).message };
          }
        },

        registrarEnvio: (modeloId, tutorId, atendimentoId) => {
          const envio: MensagemEnvio = { id: R.uid(), modeloId, tutorId, atendimentoId, canal: "manual", enviadoEm: new Date().toISOString() };
          aplicar(
            (db) => ({ db: { ...db, mensagensEnvios: [...db.mensagensEnvios, envio] }, valor: undefined }),
            (c, ps) => remoto.envio(c, ps, envio),
          );
        },

        registrarEtapa: async ({ atendimentoId, etapa, nota, foto }) => {
          // Valida antes de gastar tempo com a foto.
          const previa = tentar(() => R.registrarEtapa(get().db, { atendimentoId, etapa, nota }, get().db.usuarioAtualId, new Date()));
          if (!previa.ok) return previa;
          const id = R.uid();
          let fotoUrl: string | undefined;
          let fotoPath: string | undefined;
          try {
            if (foto) {
              const f = await prepararFoto(foto, `etapas/${atendimentoId}/${id}.jpg`);
              fotoUrl = f.url;
              fotoPath = f.path;
            }
          } catch (e) {
            return { ok: false, erro: e instanceof Error ? e.message : "Não foi possível enviar a foto." };
          }
          return aplicar(
            (db) => {
              const r = R.registrarEtapa(db, { id, atendimentoId, etapa, nota, fotoUrl }, db.usuarioAtualId, new Date());
              return { db: r.db, valor: r.etapa, ctx: r.etapa };
            },
            (c, ps, e) => remoto.etapa(c, ps, e, fotoPath),
          );
        },

        salvarFotoPet: async (petId, foto) => {
          const pet = R.porId(get().db.pets, petId);
          if (!pet) return { ok: false, erro: "Pet não encontrado." };
          let fotoUrl: string | undefined;
          let fotoPath: string | null = null;
          try {
            if (foto) {
              // Nome novo a cada troca, para o navegador não mostrar a foto antiga em cache.
              const f = await prepararFoto(foto, `pets/${petId}-${Date.now().toString(36)}.jpg`);
              fotoUrl = f.url;
              fotoPath = f.path ?? null;
            }
          } catch (e) {
            return { ok: false, erro: e instanceof Error ? e.message : "Não foi possível enviar a foto." };
          }
          const atualizado: Pet = { ...pet, fotoUrl };
          return aplicar(
            (db) => ({ db: R.atualizarPet(db, atualizado), valor: undefined }),
            (c, ps) => remoto.pet(c, ps, atualizado, false, fotoPath),
          );
        },

        enviarPosicao: (pos) => {
          const r = tentar(() => R.atualizarPosicao(get().db, pos));
          if (!r.ok) return;
          set({ db: r.valor });
          // Sem recarregar o Db a cada posição: é só um ponto a mais no mapa.
          gravar((c, ps) => remoto.posicao(c, ps, pos), { recarregar: false });
        },

        definirTransporte: (atendimentoId, input) =>
          aplicar(
            (db) => {
              const novo = R.definirTransporte(db, atendimentoId, input);
              return { db: novo, valor: undefined, ctx: R.porId(novo.atendimentos, atendimentoId)! };
            },
            (c, ps, a) => remoto.transporte(c, ps, a),
          ),

        registrarAcerto: (input) =>
          aplicar(
            (db) => {
              const r = R.registrarAcerto(db, input, new Date());
              return { db: r.db, valor: { acerto: r.acerto, despesa: r.despesa }, ctx: r.acerto };
            },
            (c, ps, acerto) => remoto.acerto(c, ps, acerto),
          ),

        // -------------------------------------------------------------------
        // Edição e correções
        // -------------------------------------------------------------------

        editarMembro: (id, dados) =>
          aplicar(
            (db) => {
              const r = E.editarMembro(db, id, dados);
              return { db: r.db, valor: undefined, ctx: r.membro };
            },
            (c, ps, m) => remoto.membroEditar(c, ps, m),
          ),

        editarTutor: (id, dados) =>
          aplicar(
            (db) => {
              const r = E.editarTutor(db, id, dados);
              return { db: r.db, valor: undefined, ctx: { t: r.tutor, antes: R.porId(db.tutores, id) } };
            },
            (c, ps, { t, antes }) => remoto.tutorEditar(c, ps, t, antes),
          ),

        excluirTutor: (id) =>
          aplicar(
            (db) => ({ db: E.excluirTutor(db, id), valor: undefined }),
            (c, ps) => remoto.excluirTutor(c, ps, id),
          ),

        excluirPet: (id) =>
          aplicar(
            (db) => ({ db: E.excluirPet(db, id).db, valor: undefined }),
            (c, ps) => remoto.excluirPet(c, ps, id),
          ),

        salvarPacote: (m) =>
          aplicar(
            (db) => {
              const r = E.salvarPacote(db, m);
              return { db: r.db, valor: undefined, ctx: r };
            },
            (c, ps, r) => remoto.pacote(c, ps, r.pacote, r.novo),
          ),

        cancelarPlano: (input) =>
          aplicar(
            (db) => {
              const r = E.cancelarPlano(db, input, new Date());
              const plano = R.porId(r.db.planosPet, input.planoId)!;
              const afetados = r.db.atendimentos.filter((a) => {
                const antes = R.porId(db.atendimentos, a.id);
                return antes?.planoPetId === plano.id && !a.planoPetId;
              });
              return { db: r.db, valor: undefined, ctx: { plano, afetados, despesa: r.despesa } };
            },
            (c, ps, x) => remoto.cancelarPlano(c, ps, x.plano, x.afetados, x.despesa),
          ),

        editarObservacoesPlano: (planoId, observacoes) =>
          aplicar(
            (db) => {
              const novo = E.editarObservacoesPlano(db, planoId, observacoes);
              return { db: novo, valor: undefined, ctx: R.porId(novo.planosPet, planoId)!.observacoes };
            },
            (c, ps, obs) => remoto.planoObs(c, ps, planoId, obs),
          ),

        editarAtendimento: (id, e) =>
          aplicar(
            (db) => {
              const r = E.editarAtendimento(db, id, e);
              return { db: r.db, valor: undefined, ctx: r };
            },
            (c, ps, r) => remoto.editarAtendimento(c, ps, r.atendimento, r.itensMudaram),
          ),

        registrarSinal: (atendimentoId, forma) =>
          aplicar(
            (db) => {
              const r = E.registrarSinal(db, atendimentoId, forma, new Date());
              return { db: r.db, valor: undefined, ctx: r.lancamento };
            },
            (c, ps, l) => remoto.sinal(c, ps, atendimentoId, l),
          ),

        lancarReceita: (input) =>
          aplicar(
            (db) => {
              const r = E.lancarReceita(db, input, new Date());
              return { db: r.db, valor: undefined, ctx: r.lancamento };
            },
            (c, ps, l) => remoto.lancamento(c, ps, l),
          ),

        estornarPagamento: (lancamentoId) =>
          aplicar(
            (db) => ({ db: E.estornarPagamento(db, lancamentoId), valor: undefined, ctx: R.porId(db.lancamentos, lancamentoId)! }),
            (c, ps, l) => remoto.estornarPagamento(c, ps, l),
          ),

        excluirLancamento: (lancamentoId) =>
          aplicar(
            (db) => ({ db: E.excluirLancamento(db, lancamentoId), valor: undefined }),
            (c, ps) => remoto.excluirLancamento(c, ps, lancamentoId),
          ),

        editarModelo: (id, dados) =>
          aplicar(
            (db) => {
              const r = E.editarModelo(db, id, dados);
              return { db: r.db, valor: undefined, ctx: r.modelo };
            },
            (c, ps, m) => remoto.modeloEditar(c, ps, m),
          ),

        removerEtapa: (etapaId, soFoto) =>
          aplicar(
            (db) => ({ db: E.removerEtapa(db, etapaId, soFoto), valor: undefined, ctx: db.etapas.find((e) => e.id === etapaId)! }),
            (c, ps, e) => remoto.removerEtapa(c, ps, e, soFoto),
          ),

        // -------------------------------------------------------------------
        // Produtos e estoque
        // -------------------------------------------------------------------

        salvarProduto: (p, estoqueInicial = 0) =>
          aplicar(
            (db) => {
              const r = P.salvarProduto(db, p, new Date(), estoqueInicial);
              return { db: r.db, valor: r.produto.id, ctx: r };
            },
            async (c, ps, r) => {
              await remoto.produto(c, ps, r.produto, r.novo);
              if (r.movimento) await remoto.movimento(c, ps, r.movimento);
            },
          ),

        entradaEstoque: (input) =>
          aplicar(
            (db) => {
              const r = P.entradaEstoque(db, input, new Date());
              return { db: r.db, valor: undefined, ctx: r };
            },
            (c, ps, r) => remoto.movimento(c, ps, r.movimento, r.despesa),
          ),

        ajustarEstoque: (input) =>
          aplicar(
            (db) => {
              const r = P.ajustarEstoque(db, input, new Date());
              return { db: r.db, valor: undefined, ctx: r.movimento };
            },
            (c, ps, m) => remoto.movimento(c, ps, m),
          ),

        registrarVenda: (input) =>
          aplicar(
            (db) => {
              const r = P.registrarVenda(db, input, new Date());
              return { db: r.db, valor: r.venda.id, ctx: r };
            },
            (c, ps, r) => remoto.venda(c, ps, r.venda, r.lancamento),
          ),

        cancelarVenda: (vendaId) =>
          aplicar(
            (db) => {
              const r = P.cancelarVenda(db, vendaId, new Date());
              return { db: r.db, valor: undefined, ctx: r };
            },
            (c, ps, r) => remoto.cancelarVenda(c, ps, r.venda, r.estornos, r.removerLancamento, r.despesa),
          ),

        // -------------------------------------------------------------------
        // Vacinas e fidelidade
        // -------------------------------------------------------------------

        salvarVacina: (input) =>
          aplicar(
            (db) => {
              const r = V.salvarVacina(db, input);
              return { db: r.db, valor: undefined, ctx: r };
            },
            (c, ps, r) => remoto.vacina(c, ps, r.vacina, r.novo),
          ),

        excluirVacina: (id) =>
          aplicar(
            (db) => ({ db: V.excluirVacina(db, id), valor: undefined }),
            (c, ps) => remoto.excluirVacina(c, ps, id),
          ),

        resgatarFidelidade: (atendimentoId) =>
          aplicar(
            (db) => {
              const r = F.resgatar(db, atendimentoId, new Date());
              return { db: r.db, valor: undefined, ctx: r };
            },
            (c, ps, r) => remoto.resgate(c, ps, r.resgate, r.atendimento),
          ),

        desfazerResgate: (atendimentoId) =>
          aplicar(
            (db) => {
              const r = F.desfazerResgate(db, atendimentoId);
              return { db: r.db, valor: undefined, ctx: r.atendimento };
            },
            (c, ps, a) => remoto.desfazerResgate(c, ps, a),
          ),

        agendarOnlineDemo: (pedido) =>
          aplicar((db) => {
            const r = agendarNoDb(db, pedido, new Date());
            return { db: r.db, valor: r.confirmacao };
          }),
      };
    },
    {
      // v4: produtos e estoque, vacinas, fidelidade e agendamento online nos dados de exemplo.
      name: "app-pet:v4",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      // Só o modo demonstração fica no navegador; o modo nuvem sempre lê do banco.
      partialize: (s) => (s.modo === "demo" ? { db: s.db, versaoSeed: s.versaoSeed } : {}),
      // Demonstração: se os dados de exemplo são de outro dia, recria para a agenda abrir com movimento.
      onRehydrateStorage: () => (estado) => {
        if (estado && estado.modo === "demo" && estado.versaoSeed !== SEED_DO_DIA()) estado.resetar();
      },
    },
  ),
);

/** Atalho para ler o Db. */
export const useDb = () => useApp((s) => s.db);

/** Quem está usando o app agora (membro da equipe). */
export const useEu = () => useApp((s) => s.db.membros.find((m) => m.id === s.db.usuarioAtualId));
export const usePapel = () => useApp((s) => s.db.membros.find((m) => m.id === s.db.usuarioAtualId)?.papel ?? "dono");
