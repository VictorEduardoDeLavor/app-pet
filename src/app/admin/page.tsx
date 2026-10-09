"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Ban, CalendarPlus, CircleDollarSign, LockOpen, MessageCircle, RefreshCw, Search, ShieldCheck, Store, Unlock } from "lucide-react";
import { ajustarAssinaturaAdmin, listarPetshopsAdmin, souAdmin, type AcaoAdmin, type PetshopAdmin } from "@/data/assinatura";
import { situacao } from "@/domain/assinatura";
import { supabase } from "@/lib/supabase/client";
import { MARCA } from "@/lib/marca";
import { Botao, Campo, Chip, Folha, Vazio, cx } from "@/components/ui";
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
        <div className="flex-1">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-600">{MARCA.nome}</p>
          <h1 className="text-[24px] font-bold tracking-tight">Painel do administrador</h1>
        </div>
        <button onClick={() => carregar()} aria-label="Atualizar" className="tap grid h-10 w-10 place-items-center rounded-full hover:bg-surface">
          <RefreshCw className="h-5 w-5 text-muted" />
        </button>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Numero rotulo="Pet shops" valor={String(numeros.total)} />
        <Numero rotulo="Em teste" valor={String(numeros.teste)} />
        <Numero rotulo="Pagantes" valor={String(numeros.pagantes)} />
        <Numero rotulo="Receita mensal" valor={moeda(numeros.mrr)} destaque />
        <Numero rotulo="Suspensos" valor={String(numeros.suspensos)} />
      </div>

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
    </main>
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
          onSubmit={(e) => {
            e.preventDefault();
            fazer("valor", Number(valor.replace(",", ".")), "Valor da mensalidade atualizado.");
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
        <p className="-mt-2 text-[12px] text-muted">Vale para a próxima assinatura criada; quem já assinou mantém o valor no Asaas.</p>
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
