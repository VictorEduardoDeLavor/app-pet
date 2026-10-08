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
import type { Db, FormaPagamento, Membro, MensagemEnvio, Pet, Petshop, Servico, StatusAtendimento } from "@/domain/types";
import { criarSeed } from "./seed";
import * as R from "@/domain/rules";
import { hoje } from "@/domain/format";
import { MODELOS_PADRAO } from "@/domain/messages";
import { carregar, gerarConvite, remoto, traduzirErro } from "./cloud";

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
  estornarUso: (usoId: string) => void;
  criarTutor: (input: { nome: string; whatsapp: string; endereco?: string; consentimentoWhatsapp?: boolean }) => Resultado<string>;
  criarPet: (input: Omit<Pet, "id">) => Resultado<string>;
  atualizarPet: (pet: Pet) => void;
  criarMembro: (input: { nome: string; papel: Membro["papel"]; comissaoPct: number }) => Resultado<string>;
  salvarModelo: (id: string, texto: string) => void;
  salvarServico: (servico: Servico) => void;
  atualizarPetshop: (dados: Partial<Petshop>) => void;
  restaurarModelos: () => void;
  registrarEnvio: (modeloId: string, tutorId: string, atendimentoId?: string) => void;
  /** Demonstração: ver o app com os olhos de outra pessoa da equipe. */
  entrarComo: (membroId: string) => void;
  convidar: (membroId: string) => Promise<Resultado<{ codigo: string; expiraEm: string }>>;
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
      const gravar = (op: (cliente: SupabaseClient, ps: string) => Promise<unknown>) => {
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
          .then(() => get().recarregar())
          .finally(() => set((s) => ({ sincronizando: Math.max(0, s.sincronizando - 1) })));
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
              return { db: r.db, valor: r.efeitos };
            },
            (c, ps) => remoto.mudarStatus(c, ps, id, para),
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

        estornarUso: (usoId) => {
          aplicar(
            (db) => ({ db: R.estornarUso(db, usoId), valor: undefined }),
            (c, ps) => remoto.estornarUso(c, ps, usoId),
          );
        },

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

        salvarServico: (servico) => {
          aplicar(
            (db) => ({ db: { ...db, servicos: db.servicos.map((s) => (s.id === servico.id ? servico : s)) }, valor: undefined }),
            (c, ps) => remoto.servico(c, ps, servico),
          );
        },

        atualizarPetshop: (dados) => {
          aplicar(
            (db) => ({ db: { ...db, petshop: { ...db.petshop, ...dados } }, valor: undefined }),
            (c, ps) => remoto.petshop(c, ps, dados),
          );
        },

        restaurarModelos: () => {
          const padrao = new Map(MODELOS_PADRAO.map((m) => [m.gatilho, m.texto]));
          aplicar(
            (db) => {
              const modelos = db.mensagemModelos.map((m) => ({ ...m, texto: padrao.get(m.gatilho) ?? m.texto }));
              return { db: { ...db, mensagemModelos: modelos }, valor: undefined, ctx: modelos };
            },
            (c, ps, modelos) => Promise.all(modelos.map((m) => remoto.modelo(c, ps, m.id, m.texto))),
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
      };
    },
    {
      // v2: dados de exemplo com fotos dos pets.
      name: "app-pet:v2",
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
