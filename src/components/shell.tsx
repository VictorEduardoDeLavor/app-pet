"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import {
  Calendar,
  Car,
  ClipboardList,
  HandCoins,
  House,
  ListChecks,
  LoaderCircle,
  Lock,
  LogOut,
  Menu,
  MessageCircle,
  PawPrint,
  Scissors,
  Settings,
  ShoppingBag,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useApp, useDb, useEu } from "@/data/store";
import type { Db, Membro, Papel } from "@/domain/types";
import { NOME_PAPEL_CURTO, inicioDoPapel, pode, rotaPermitida, type Area } from "@/domain/permissoes";
import { hoje, iniciais } from "@/domain/format";
import { BotaoLink, Vazio, cx } from "./ui";
import { useSessao } from "./providers";

type ItemNav = { href: string; rotulo: string; Icone: LucideIcon; area: Area | null; prefixos: string[] };

const NAV_INICIO: ItemNav = { href: "/", rotulo: "Início", Icone: House, area: "inicio", prefixos: [] };
const NAV_FILA: ItemNav = { href: "/fila", rotulo: "Minha fila", Icone: ListChecks, area: "fila", prefixos: ["/fila"] };
const NAV_ROTAS: ItemNav = { href: "/rotas", rotulo: "Leva e traz", Icone: Car, area: "rotas", prefixos: ["/rotas"] };
const NAV_AGENDA: ItemNav = { href: "/agenda", rotulo: "Agenda", Icone: Calendar, area: "agenda", prefixos: ["/agenda", "/atendimentos"] };
const NAV_CLIENTES: ItemNav = { href: "/clientes", rotulo: "Clientes", Icone: Users, area: "clientes", prefixos: ["/clientes", "/pets"] };
const NAV_MENSAGENS: ItemNav = { href: "/mensagens", rotulo: "Mensagens", Icone: MessageCircle, area: "mensagens", prefixos: ["/mensagens"] };

const GESTAO: ItemNav[] = [
  { href: "/financeiro", rotulo: "Financeiro", Icone: Wallet, area: "financeiro", prefixos: ["/financeiro"] },
  { href: "/comissoes", rotulo: "Comissões", Icone: HandCoins, area: "comissoes", prefixos: ["/comissoes"] },
  { href: "/planos", rotulo: "Planos e pacotes", Icone: ClipboardList, area: "planos", prefixos: ["/planos"] },
  { href: "/servicos", rotulo: "Serviços e preços", Icone: Scissors, area: "servicos", prefixos: ["/servicos"] },
  { href: "/equipe", rotulo: "Equipe", Icone: UserCog, area: "equipe", prefixos: ["/equipe"] },
  { href: "/produtos", rotulo: "Produtos", Icone: ShoppingBag, area: "produtos", prefixos: ["/produtos"] },
];

function ativo(item: ItemNav, caminho: string) {
  if (item.href === "/") return caminho === "/";
  return item.prefixos.some((p) => caminho === p || caminho.startsWith(p + "/"));
}

/** O dono só vê "Minha fila" quando também atende (pet shop de uma pessoa só). */
function temFilaPropria(db: Db, eu: Membro | undefined) {
  if (!eu) return false;
  if (eu.papel === "banhista") return true;
  if (!pode(eu.papel, "fila")) return false;
  const T = hoje();
  return db.atendimentos.some((a) => a.profissionalId === eu.id && a.data >= T && a.status !== "cancelado");
}

function navMovel(papel: Papel): ItemNav[] {
  const operacional = papel === "banhista" || papel === "motorista";
  const mais: ItemNav = {
    href: "/mais",
    rotulo: operacional ? "Conta" : "Mais",
    Icone: Menu,
    area: null,
    prefixos: ["/mais", ...(operacional ? [] : [...GESTAO.flatMap((g) => g.prefixos), "/rotas"])],
  };
  if (papel === "banhista") return [{ ...NAV_FILA, prefixos: ["/fila", "/atendimentos", "/pets"] }, mais];
  if (papel === "motorista") return [NAV_ROTAS, mais];
  return [NAV_INICIO, NAV_AGENDA, NAV_CLIENTES, NAV_MENSAGENS, mais];
}

export function Shell({ children, semNav = false }: { children: ReactNode; semNav?: boolean }) {
  const caminho = usePathname();
  const router = useRouter();
  const sincronizando = useApp((s) => s.sincronizando > 0);
  const eu = useEu();
  const papel: Papel = eu?.papel ?? "dono";
  const permitido = rotaPermitida(papel, caminho);
  const destino = inicioDoPapel(papel);

  // Quem não usa a tela inicial da gestão (banhista) cai direto na própria fila.
  useEffect(() => {
    if (caminho === "/" && destino !== "/") router.replace(destino);
  }, [caminho, destino, router]);

  const itens = navMovel(papel);

  return (
    <div className="lg:pl-[256px]">
      <BarraLateral papel={papel} />
      <div className="mx-auto min-h-dvh max-w-[440px] bg-white sm:border-x sm:border-line sm:shadow-[0_0_60px_rgb(106_79_227/0.08)] lg:max-w-[760px] lg:shadow-none">
        {sincronizando && (
          <div role="status" className="fixed right-3 top-3 z-50 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[12px] font-medium text-muted shadow-sm ring-1 ring-line">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin text-brand-600" />
            Salvando
          </div>
        )}
        <main className={cx(semNav ? "pb-8" : "pb-[calc(96px+env(safe-area-inset-bottom))] lg:pb-12")}>
          {permitido ? children : caminho === "/" && destino !== "/" ? null : <SemAcesso destino={destino} />}
        </main>
        {!semNav && (
          <nav
            aria-label="Navegação principal"
            className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[440px] border-t border-white/70 bg-white/80 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_30px_-14px_rgb(52_33_130/0.22)] backdrop-blur-xl backdrop-saturate-150 lg:hidden"
          >
            <ul className={cx("grid gap-1", itens.length === 5 ? "grid-cols-5" : "grid-cols-2")}>
              {itens.map((item) => {
                const on = ativo(item, caminho);
                const { Icone } = item;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={on ? "page" : undefined}
                      className={cx(
                        "tap flex flex-col items-center gap-1 rounded-2xl py-2 text-[11px] font-medium",
                        on ? "bg-brand-100 text-brand-700" : "text-muted hover:text-ink",
                      )}
                    >
                      <Icone className="h-[22px] w-[22px]" strokeWidth={on ? 2.2 : 1.8} />
                      {item.rotulo}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </div>
    </div>
  );
}

/** Menu lateral fixo nas telas largas (computador e tablet deitado). */
function BarraLateral({ papel }: { papel: Papel }) {
  const caminho = usePathname();
  const db = useDb();
  const eu = useEu();
  const modo = useApp((s) => s.modo);
  const { sair } = useSessao();

  const principais = [NAV_INICIO, ...(temFilaPropria(db, eu) ? [NAV_FILA] : []), NAV_ROTAS, NAV_AGENDA, NAV_CLIENTES, NAV_MENSAGENS].filter(
    (i) => i.area === null || pode(papel, i.area),
  );
  const gestao = GESTAO.filter((i) => i.area === null || pode(papel, i.area));
  const conta: ItemNav = {
    href: "/mais",
    rotulo: papel === "banhista" || papel === "motorista" ? "Minha conta" : "Configurações",
    Icone: Settings,
    area: null,
    prefixos: ["/mais"],
  };

  return (
    <aside aria-label="Menu" className="fixed inset-y-0 left-0 z-40 hidden w-[256px] flex-col border-r border-line bg-white px-4 pb-5 pt-6 lg:flex">
      <Link href={inicioDoPapel(papel)} className="flex items-center gap-2.5 px-2">
        <PawPrint className="h-8 w-8 text-brand-600" strokeWidth={2.2} />
        <span className="min-w-0 leading-tight">
          <span className="block text-[18px] font-bold tracking-tight text-brand-700">APP PET</span>
          <span className="block truncate text-[12.5px] text-muted">{db.petshop.nome}</span>
        </span>
      </Link>

      <nav className="no-scrollbar mt-7 flex-1 overflow-y-auto">
        <ListaNav itens={principais} caminho={caminho} />
        {gestao.length > 0 && (
          <>
            <p className="mb-1.5 mt-6 px-3 text-[11.5px] font-semibold uppercase tracking-wide text-subtle">Gestão</p>
            <ListaNav itens={gestao} caminho={caminho} />
          </>
        )}
        <div className="mt-6">
          <ListaNav itens={[conta]} caminho={caminho} />
        </div>
      </nav>

      {eu && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-surface px-3 py-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-100 text-[13px] font-bold text-brand-700">{iniciais(eu.nome)}</span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[14px] font-semibold">{eu.nome}</span>
            <span className="block truncate text-[12px] text-muted">
              {NOME_PAPEL_CURTO[eu.papel]}
              {modo === "demo" && " · demonstração"}
            </span>
          </span>
          {modo === "nuvem" && (
            <button aria-label="Sair" title="Sair" onClick={sair} className="tap grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-white hover:text-bad-700">
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          )}
        </div>
      )}
    </aside>
  );
}

function ListaNav({ itens, caminho }: { itens: ItemNav[]; caminho: string }) {
  return (
    <ul className="space-y-0.5">
      {itens.map((item) => {
        const on = ativo(item, caminho);
        const { Icone } = item;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={on ? "page" : undefined}
              className={cx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] font-medium transition-colors",
                on ? "bg-brand-100 text-brand-700" : "text-ink/80 hover:bg-surface hover:text-ink",
              )}
            >
              <Icone className={cx("h-5 w-5", on ? "text-brand-600" : "text-muted")} strokeWidth={on ? 2.2 : 1.8} />
              {item.rotulo}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function SemAcesso({ destino }: { destino: string }) {
  return (
    <div className="pt-16">
      <Vazio
        icone={<Lock className="h-6 w-6" />}
        titulo="Esta área é da gestão"
        texto="Seu acesso mostra só o que você usa no dia a dia. Se precisar desta tela, fale com o dono do pet shop."
        acao={<BotaoLink href={destino}>{destino === "/fila" ? "Ir para minha fila" : destino === "/rotas" ? "Ir para o leva e traz" : "Ir para o início"}</BotaoLink>}
      />
    </div>
  );
}
