"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Ban, CalendarPlus, CircleCheck, CircleDollarSign, Copy, CreditCard, KeyRound, LockOpen, MessageCircle, PlugZap, Plus, RefreshCw, Search, ShieldCheck, Store, TriangleAlert, Unlock } from "lucide-react";
import {
  ajustarAssinaturaAdmin,
  conectarAsaas,
  conviteDonoAdmin,
  criarPetshopAdmin,
  linkConvite,
  type ConviteDono,
  listarPetshopsAdmin,
  sincronizarAdmin,
  souAdmin,
  statusAsaas,
  valorAdmin,
  type AcaoAdmin,
  type PetshopAdmin,
  type StatusAsaas,
} from "@/data/assinatura";
import { situacao } from "@/domain/assinatura";
import { supabase } from "@/lib/supabase/client";
import { MARCA } from "@/lib/marca";
import { Botao, Campo, Chip, Folha, Vazio, cx } from "@/components/ui";
import { CampoEndereco } from "@/components/campo-endereco";
import { useToast } from "@/components/providers";

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const data = (iso: string | null) => (iso ? new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("pt-BR") : "—");

function situacaoDe(p: PetshopAdmin) {
  return situacao({
    liberado: p.liberado,
    status: p.status,
    testeAte: p.testeAte,
    pagoAte: p.pagoAte,
    liberadoAte: p.liberadoAte,
    valor: p.valor,
    dono: true,
    termosVersao: p.termos,
    assinada: p.assinada,
  });
}

type Filtro = "todos" | "teste" | "pagantes" | "suspensos";

export default function Admin() {
  const [estado, setEstado] = useState<"carregando" | "negado" | "ok">("carregando");
  const [lista, setLista] = useState<PetshopAdmin[]>([]);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [aberto, setAberto] = useState<PetshopAdmin | null>(null);
  const [novo, setNovo] = useState(false);
  const toast = useToast();

  const carregar = useCallback(async () => {
    const sb = supabase();
    if (!(await souAdmin(sb))) return setEstado("negado");
    try {
      setLista(await listarPetshopsAdmin(sb));
      setEstado("ok");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível carregar.", "erro");
    }
  }, [toast]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const numeros = useMemo(() => {
    const pagantes = lista.filter((p) => p.pagoAte && p.liberado && p.status !== "bloqueada");
    return {
      total: lista.length,
      teste: lista.filter((p) => situacaoDe(p).fase === "teste").length,
      pagantes: pagantes.length,
      mrr: pagantes.filter((p) => p.status !== "cancelada").reduce((s, p) => s + p.valor, 0),
      suspensos: lista.filter((p) => !p.liberado).length,
    };
  }, [lista]);

  const visiveis = lista.filter((p) => {
    const fase = situacaoDe(p).fase;
    if (filtro === "teste" && fase !== "teste") return false;
    if (filtro === "pagantes" && !(p.pagoAte && p.liberado)) return false;
    if (filtro === "suspensos" && p.liberado) return false;
    const q = busca.trim().toLowerCase();
    return !q || [p.nome, p.dono, p.email, p.whatsapp].some((x) => x?.toLowerCase().includes(q));
  });

  if (estado === "carregando") return <main className="grid min-h-dvh place-items-center text-muted">Carregando…</main>;
  if (estado === "negado")
    return (
      <main className="mx-auto max-w-[440px] px-5 pt-20">
        <Vazio icone={<ShieldCheck className="h-6 w-6" />} titulo="Acesso restrito" texto="Esta área é só do administrador da plataforma." acao={<Link href="/" className="font-semibold text-brand-700">Voltar ao app</Link>} />
      </main>
    );

  return (
    <main className="mx-auto min-h-dvh max-w-[960px] bg-white px-5 pb-16 pt-6">
      <header className="flex items-center gap-3">
        <Link href="/" aria-label="Voltar" className="tap grid h-10 w-10 place-items-center rounded-full hover:bg-surface">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-600">{MARCA.nome}</p>
          <h1 className="text-[24px] font-bold tracking-tight">Painel do administrador</h1>
        </div>
        <button onClick={() => carregar()} aria-label="Atualizar" className="tap grid h-10 w-10 place-items-center rounded-full hover:bg-surface">
          <RefreshCw className="h-5 w-5 text-muted" />
        </button>
        <Botao className="!h-10 !w-auto shrink-0 whitespace-nowrap px-4 text-[14px]" icone={<Plus className="h-4 w-4" />} onClick={() => setNovo(true)}>
          <span className="sm:hidden">Novo</span>
          <span className="hidden sm:inline">Novo pet shop</span>
        </Botao>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Numero rotulo="Pet shops" valor={String(numeros.total)} />
        <Numero rotulo="Em teste" valor={String(numeros.teste)} />
        <Numero rotulo="Pagantes" valor={String(numeros.pagantes)} />
        <Numero rotulo="Receita mensal" valor={moeda(numeros.mrr)} destaque />
        <Numero rotulo="Suspensos" valor={String(numeros.suspensos)} />
      </div>

      <CartaoAsaas />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input pl-10" placeholder="Buscar pet shop, dono, e-mail ou WhatsApp" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
        <div className="flex gap-1.5 overflow-x-auto">
          {(["todos", "teste", "pagantes", "suspensos"] as Filtro[]).map((f) => (
            <button key={f} onClick={() => setFiltro(f)} className={cx("tap rounded-full px-3.5 py-2 text-[13px] font-medium capitalize", filtro === f ? "bg-brand-600 text-white" : "bg-surface text-muted")}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {visiveis.length === 0 ? (
        <div className="pt-10">
          <Vazio icone={<Store className="h-6 w-6" />} titulo={lista.length ? "Nada com esse filtro" : "Nenhum pet shop ainda"} texto={lista.length ? undefined : "Quando alguém se cadastrar, aparece aqui."} />
        </div>
      ) : (
        <ul className="mt-4 grid gap-3 lg:grid-cols-2">
          {visiveis.map((p) => {
            const s = situacaoDe(p);
            return (
              <li key={p.id} className="min-w-0">
                <button onClick={() => setAberto(p)} className="tap card w-full px-4 py-3.5 text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[15.5px] font-semibold">{p.nome}</p>
                      <p className="truncate text-[12.5px] text-muted">
                        {p.dono ?? "—"} · {p.email ?? "sem e-mail"}
                      </p>
                    </div>
                    <Chip tom={s.tom === "ok" ? "ok" : s.tom === "erro" ? "bad" : s.tom === "aviso" ? "warn" : "info"}>{rotuloFase(s.fase)}</Chip>
                  </div>
                  <p className="mt-2 text-[12.5px] text-muted">
                    Desde {data(p.criadoEm)} · {p.clientes} clientes · {p.pets} pets · {p.atendimentos30d} atend. em 30 dias · {moeda(p.valor)}/mês
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <AcoesFolha p={aberto} onFechar={() => setAberto(null)} onFeito={() => carregar()} />
      <NovoPetshopFolha aberta={novo} onFechar={() => setNovo(false)} modelos={lista} onCriado={() => carregar()} />
    </main>
  );
}

const quando = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

/** Situação da cobrança automática: chave cadastrada, conta, webhook ligado e último aviso recebido. */
function CartaoAsaas() {
  const toast = useToast();
  const [st, setSt] = useState<StatusAsaas | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [conectando, setConectando] = useState(false);

  const ler = useCallback(async () => {
    try {
      setSt(await statusAsaas(supabase()));
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler a situação do Asaas.");
    }
  }, []);
  useEffect(() => {
    void ler();
  }, [ler]);

  async function conectar() {
    setConectando(true);
    try {
      const r = await conectarAsaas(supabase());
      toast(`Asaas conectado (${r.conta}) · webhook ${r.webhook}`);
      await ler();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível conectar.", "erro");
    } finally {
      setConectando(false);
    }
  }

  const ambienteTrocou = !!st?.webhook && !!st.ambiente && st.webhookAmbiente !== st.ambiente;
  const pronto = !!st?.chave && !!st.webhook && !ambienteTrocou;

  return (
    <section className={cx("mt-6 rounded-[22px] border px-4 py-4", pronto ? "border-ok-500/25 bg-ok-50" : "border-warn-100 bg-warn-50")}>
      <div className="flex items-start gap-3">
        <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-full", pronto ? "bg-ok-500 text-white" : "bg-white text-warn-700")}>
          {pronto ? <CircleCheck className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className={cx("text-[15.5px] font-semibold", pronto ? "text-ok-700" : "text-warn-700")}>
            {pronto ? "Cobrança automática ligada" : "Cobrança automática (Asaas)"}
          </p>
          {erro ? (
            <p className="text-[13px] text-bad-700">{erro}</p>
          ) : !st ? (
            <p className="text-[13px] text-muted">Verificando…</p>
          ) : (
            <dl className="mt-1.5 grid grid-cols-[130px_1fr] gap-x-3 gap-y-1 text-[13px]">
              <dt className="text-muted">Chave de API</dt>
              <dd>{st.chave ? `cadastrada (${st.ambiente === "sandbox" ? "sandbox, de teste" : "produção"})` : "falta cadastrar"}</dd>
              <dt className="text-muted">Conta</dt>
              <dd className="truncate">{st.conta ?? "—"}</dd>
              <dt className="text-muted">Webhook</dt>
              <dd>{st.webhook ? `ligado em ${quando(st.conectadoEm)}` : "não ligado"}</dd>
              <dt className="text-muted">Último aviso</dt>
              <dd className="truncate">{st.ultimoEvento ? `${quando(st.ultimoEvento)} · ${st.ultimoEventoTipo ?? ""}` : "nenhum ainda"}</dd>
            </dl>
          )}
          {ambienteTrocou && (
            <p className="mt-2 flex items-center gap-1.5 text-[12.5px] font-medium text-warn-700">
              <TriangleAlert className="h-3.5 w-3.5" /> A chave mudou de ambiente: conecte de novo para ligar o webhook nesta conta.
            </p>
          )}
          {st && !st.chave && (
            <p className="mt-2 text-[12.5px] text-muted">
              Gere a chave no Asaas (Integrações › Chaves de API) e cadastre no Supabase como segredo <code>ASAAS_API_KEY</code>. Depois volte aqui e conecte.
            </p>
          )}
        </div>
      </div>
      {st?.chave && (
        <Botao variante={pronto ? "contorno" : "primario"} className="mt-3 !h-11" disabled={conectando} onClick={conectar} icone={<PlugZap className="h-4 w-4" />}>
          {conectando ? "Conectando…" : st.webhook ? "Reconectar (gera um token novo)" : "Conectar o Asaas"}
        </Botao>
      )}
    </section>
  );
}

function rotuloFase(f: string) {
  return (
    {
      teste: "Em teste",
      teste_acabou: "Teste acabou",
      ativa: "Pagante",
      pendente: "Fatura em aberto",
      atrasada: "Atrasado",
      cancelada: "Cancelado",
      cancelada_em_uso: "Cancelado (em uso)",
      liberada: "Liberado à mão",
      bloqueada: "Bloqueado",
    } as Record<string, string>
  )[f] ?? f;
}

function Numero({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className={cx("rounded-[18px] px-4 py-3", destaque ? "bg-gradient-to-br from-brand-600 to-brand-800 text-white" : "bg-surface")}>
      <p className={cx("text-[12px] font-medium", destaque ? "text-white/75" : "text-muted")}>{rotulo}</p>
      <p className="mt-0.5 text-[22px] font-bold tracking-tight">{valor}</p>
    </div>
  );
}

function AcoesFolha({ p, onFechar, onFeito }: { p: PetshopAdmin | null; onFechar: () => void; onFeito: () => void }) {
  const toast = useToast();
  const [valor, setValor] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => setValor(p ? String(p.valor) : ""), [p]);
  if (!p) return null;
  const s = situacaoDe(p);

  async function fazer(acao: AcaoAdmin, n?: number, msg = "Feito.") {
    setEnviando(true);
    try {
      await ajustarAssinaturaAdmin(supabase(), p!.id, acao, n);
      toast(msg);
      onFeito();
      onFechar();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível.", "erro");
    } finally {
      setEnviando(false);
    }
  }

  const zap = p.whatsapp ? `https://wa.me/${p.whatsapp}?text=${encodeURIComponent(`Olá! Aqui é do ${MARCA.nome}. Tudo certo com o ${p.nome}?`)}` : null;

  return (
    <Folha aberta onFechar={onFechar} titulo={p.nome}>
      <div className="space-y-4 pb-2">
        <div className="rounded-2xl bg-surface px-4 py-3 text-[13.5px]">
          <p className="font-semibold">{s.titulo}</p>
          <p className="text-muted">{s.texto}</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12.5px] text-muted">
            <dt>Teste até</dt>
            <dd className="text-ink">{data(p.testeAte)}</dd>
            <dt>Pago até</dt>
            <dd className="text-ink">{data(p.pagoAte)}</dd>
            <dt>Liberado até</dt>
            <dd className="text-ink">{data(p.liberadoAte)}</dd>
            <dt>Assinatura no Asaas</dt>
            <dd className="text-ink">{p.assinada ? "Sim" : "Não"}</dd>
            <dt>Termos</dt>
            <dd className="text-ink">{p.termos ?? "Não aceitos"}</dd>
            <dt>Último atendimento</dt>
            <dd className="text-ink">{data(p.ultimoAtendimento)}</dd>
          </dl>
        </div>
        {zap && (
          <a href={zap} target="_blank" rel="noreferrer" className="tap flex items-center justify-center gap-2 rounded-2xl bg-ok-500 py-3 text-[14.5px] font-semibold text-white">
            <MessageCircle className="h-5 w-5" /> Chamar no WhatsApp
          </a>
        )}
        {!p.email && <ConviteDoDono p={p} />}
        <div className="grid grid-cols-2 gap-2">
          <Botao variante="contorno" disabled={enviando} onClick={() => fazer("estender_teste", 7, "Teste estendido em 7 dias.")} icone={<CalendarPlus className="h-4 w-4" />}>
            +7 dias de teste
          </Botao>
          <Botao variante="contorno" disabled={enviando} onClick={() => fazer("liberar", 30, "Liberado por 30 dias.")} icone={<LockOpen className="h-4 w-4" />}>
            Liberar 30 dias
          </Botao>
        </div>
        <p className="-mt-1 text-[12px] text-muted">&quot;Liberar 30 dias&quot; serve para quem pagou por fora (Pix direto) ou para o piloto.</p>
        <form
          className="flex items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setEnviando(true);
            try {
              const r = await valorAdmin(supabase(), p.id, Number(valor.replace(",", ".")));
              toast(r.noAsaas ? "Mensalidade atualizada no app e no Asaas." : "Mensalidade atualizada.");
              onFeito();
              onFechar();
            } catch (err) {
              toast(err instanceof Error ? err.message : "Não foi possível.", "erro");
            } finally {
              setEnviando(false);
            }
          }}
        >
          <div className="flex-1">
            <Campo rotulo="Mensalidade deste pet shop (R$)">
              <input className="input" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
            </Campo>
          </div>
          <button type="submit" disabled={enviando} className="tap mb-0.5 grid h-[50px] w-[50px] place-items-center rounded-2xl bg-surface text-brand-700" aria-label="Salvar valor">
            <CircleDollarSign className="h-5 w-5" />
          </button>
        </form>
        <p className="-mt-2 text-[12px] text-muted">Quem já assinou: muda também no Asaas, inclusive na fatura em aberto. Mínimo R$ 5,00.</p>
        {p.assinada && (
          <Botao
            variante="fantasma"
            disabled={enviando}
            icone={<RefreshCw className="h-4 w-4" />}
            onClick={async () => {
              setEnviando(true);
              try {
                const r = await sincronizarAdmin(supabase(), p.id);
                toast(`${r.cobrancas} ${r.cobrancas === 1 ? "cobrança conferida" : "cobranças conferidas"} no Asaas.`);
                onFeito();
              } catch (err) {
                toast(err instanceof Error ? err.message : "Não foi possível.", "erro");
              } finally {
                setEnviando(false);
              }
            }}
          >
            Conferir cobranças no Asaas
          </Botao>
        )}
        {p.status === "bloqueada" ? (
          <Botao variante="fantasma" disabled={enviando} onClick={() => fazer("desbloquear", undefined, "Desbloqueado.")} icone={<Unlock className="h-4 w-4" />}>
            Desbloquear
          </Botao>
        ) : (
          <Botao variante="perigo" disabled={enviando} onClick={() => fazer("bloquear", undefined, "Bloqueado.")} icone={<Ban className="h-4 w-4" />}>
            Bloquear acesso
          </Botao>
        )}
      </div>
    </Folha>
  );
}

/** Texto pronto para mandar ao dono com o link do convite. */
function mensagemConvite(nome: string, dono: string | null, c: ConviteDono) {
  const ola = dono && dono !== "Dono" ? `Olá, ${dono.split(" ")[0]}!` : "Olá!";
  return `${ola} O app do ${nome} está pronto.\n\n1. Abra ${linkConvite(c.codigo)}\n2. Crie sua conta com e-mail e senha\n3. O código ${c.codigo} já vem preenchido (vale até ${data(c.expiraEm)})\n\nNo celular, depois de entrar, toque em "Instalar o app" para ficar com o ícone na tela.`;
}

function CartaoConvite({ nome, dono, whatsapp, convite }: { nome: string; dono: string | null; whatsapp: string | null; convite: ConviteDono }) {
  const toast = useToast();
  const texto = mensagemConvite(nome, dono, convite);
  return (
    <div className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3.5">
      <p className="text-[12.5px] font-medium text-muted">Convite do dono · vale até {data(convite.expiraEm)}</p>
      <p className="mt-1 font-mono text-[28px] font-bold tracking-[0.18em] text-brand-700">{convite.codigo}</p>
      <p className="mt-1 break-all text-[12.5px] text-muted">{linkConvite(convite.codigo)}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Botao
          variante="contorno"
          className="!h-11"
          icone={<Copy className="h-4 w-4" />}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(texto);
              toast("Mensagem copiada");
            } catch {
              toast("Não deu para copiar. Selecione o código à mão.", "erro");
            }
          }}
        >
          Copiar texto
        </Botao>
        {whatsapp ? (
          <a
            href={`https://wa.me/${whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(texto)}`}
            target="_blank"
            rel="noreferrer"
            className="tap flex h-11 items-center justify-center gap-2 rounded-2xl bg-ok-500 text-[14.5px] font-semibold text-white"
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}

/** Dono que ainda não entrou: gera (ou renova) o convite de 14 dias. */
function ConviteDoDono({ p }: { p: PetshopAdmin }) {
  const toast = useToast();
  const [convite, setConvite] = useState<ConviteDono | null>(null);
  const [codigo, setCodigo] = useState("");
  const [enviando, setEnviando] = useState(false);
  if (convite) return <CartaoConvite nome={p.nome} dono={p.dono} whatsapp={p.whatsapp} convite={convite} />;
  return (
    <div className="rounded-2xl border border-line px-4 py-3.5">
      <p className="flex items-center gap-2 text-[14.5px] font-semibold">
        <KeyRound className="h-4 w-4 text-brand-600" /> O dono ainda não entrou no app
      </p>
      <p className="mt-0.5 text-[12.5px] text-muted">Gere um convite novo (vale 14 dias). O anterior deixa de valer.</p>
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <input className="input !h-11 uppercase" maxLength={6} placeholder="Código (opcional)" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} />
        <Botao
          className="!h-11 !w-auto px-4"
          disabled={enviando}
          onClick={async () => {
            setEnviando(true);
            try {
              setConvite(await conviteDonoAdmin(supabase(), p.id, codigo));
            } catch (e) {
              toast(e instanceof Error ? e.message : "Não foi possível gerar o convite.", "erro");
            } finally {
              setEnviando(false);
            }
          }}
        >
          Gerar convite
        </Botao>
      </div>
    </div>
  );
}

/** Cadastro do pet shop de um cliente, a partir do padrão do app ou copiando outro pet shop. */
function NovoPetshopFolha({ aberta, onFechar, modelos, onCriado }: { aberta: boolean; onFechar: () => void; modelos: PetshopAdmin[]; onCriado: () => void }) {
  const toast = useToast();
  const [nome, setNome] = useState("");
  const [dono, setDono] = useState("");
  const [zap, setZap] = useState("");
  const [endereco, setEndereco] = useState("");
  const [codigo, setCodigo] = useState("");
  const [modelo, setModelo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [criado, setCriado] = useState<(ConviteDono & { slug: string; nome: string; dono: string; whatsapp: string | null }) | null>(null);

  useEffect(() => {
    if (!aberta) return;
    setNome("");
    setDono("");
    setZap("");
    setEndereco("");
    setCodigo("");
    setModelo("");
    setCriado(null);
  }, [aberta]);

  const zapDigitos = zap.replace(/\D/g, "");
  const zapCompleto = zapDigitos ? (zapDigitos.startsWith("55") ? zapDigitos : `55${zapDigitos}`) : null;

  async function criar() {
    if (nome.trim().length < 2) return toast("Informe o nome do pet shop.", "erro");
    setEnviando(true);
    try {
      const r = await criarPetshopAdmin(supabase(), { nome, donoNome: dono, whatsapp: zapCompleto ?? undefined, endereco, codigo, modelo: modelo || undefined });
      setCriado({ ...r, nome: nome.trim(), dono: dono.trim(), whatsapp: zapCompleto });
      toast("Pet shop criado");
      onCriado();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível criar.", "erro");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Folha aberta={aberta} onFechar={onFechar} titulo={criado ? "Pet shop criado" : "Novo pet shop"}>
      {criado ? (
        <div className="space-y-4 pb-2">
          <p className="text-[14px] text-muted">
            <b className="text-ink">{criado.nome}</b> está pronto, com 14 dias de teste. Mande o convite para {criado.dono || "o dono"}: ele cria a conta, aceita os termos e já cai no app.
          </p>
          <CartaoConvite nome={criado.nome} dono={criado.dono || null} whatsapp={criado.whatsapp} convite={criado} />
          <p className="text-[12.5px] text-muted">Página de agendamento (o dono liga em Dados do pet shop): /agendar/{criado.slug}</p>
          <Botao variante="contorno" onClick={onFechar}>
            Fechar
          </Botao>
        </div>
      ) : (
        <div className="space-y-4 pb-2">
          <Campo rotulo="Nome do pet shop">
            <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Spike Banho & Tosa" />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Nome do dono">
              <input className="input" value={dono} onChange={(e) => setDono(e.target.value)} />
            </Campo>
            <Campo rotulo="WhatsApp">
              <input className="input" inputMode="tel" value={zap} onChange={(e) => setZap(e.target.value)} placeholder="(11) 97520-1421" />
            </Campo>
          </div>
          <CampoEndereco rotulo="Endereço (opcional)" valor={endereco} onChange={setEndereco} />
          <div>
            <span className="label">Serviços, preços e mensagens</span>
            <div className="flex flex-wrap gap-2">
              {[{ id: "", nome: "Padrão do app" }, ...modelos.map((m) => ({ id: m.id, nome: `Copiar de ${m.nome}` }))].map((m) => (
                <button
                  key={m.id || "padrao"}
                  type="button"
                  onClick={() => setModelo(m.id)}
                  className={cx("tap rounded-xl border px-3.5 py-2.5 text-[14px] font-medium", modelo === m.id ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line text-muted")}
                >
                  {m.nome}
                </button>
              ))}
            </div>
            <span className="mt-1.5 block text-[12.5px] text-muted">Copiar traz os serviços ativos, preços por porte, pacotes e mensagens. Clientes e agenda não vêm.</span>
          </div>
          <Campo rotulo="Código do convite (opcional)" dica="6 letras ou números, sem 0, O, 1, I e L. Ex.: SPIKE2. Vazio = sorteado.">
            <input className="input uppercase" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} />
          </Campo>
          <Botao disabled={enviando} onClick={criar} icone={<Store className="h-[18px] w-[18px]" />}>
            {enviando ? "Criando…" : "Criar pet shop e convite"}
          </Botao>
        </div>
      )}
    </Folha>
  );
}
