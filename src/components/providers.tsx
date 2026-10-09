"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CircleAlert, CircleCheck, LocateFixed, PawPrint } from "lucide-react";
import { aoErroDeSincronia, useApp } from "@/data/store";
import { useRastreio } from "@/lib/rastreio";
import { carregar } from "@/data/cloud";
import { buscarAssinatura, demoAssinatura, souAdmin, useAssinatura } from "@/data/assinatura";
import { CHAVE_DEMO, supabase, temSupabase } from "@/lib/supabase/client";
import { cx } from "./ui";

type Aviso = { id: number; texto: string; tipo: "ok" | "erro" };
const ToastCtx = createContext<(texto: string, tipo?: Aviso["tipo"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

type Sessao = { email: string | null; temSupabase: boolean; sair: () => Promise<void> };
const SessaoCtx = createContext<Sessao>({ email: null, temSupabase: false, sair: async () => {} });
export const useSessao = () => useContext(SessaoCtx);

const PUBLICAS = ["/entrar", "/bem-vindo"];
/** Abrem com ou sem login e nunca redirecionam: link do tutor, troca de senha, termos e página de vendas. */
const ABERTAS = ["/acompanhar", "/agendar", "/nova-senha", "/termos", "/privacidade", "/conheca"];
/** Pedem login, mas não um pet shop: o painel do administrador da plataforma. */
const SO_LOGIN = ["/admin"];

type Etapa = "carregando" | "pronto" | "publica";

export function Providers({ children }: { children: ReactNode }) {
  const caminho = usePathname();
  const router = useRouter();
  const publica = PUBLICAS.some((p) => caminho.startsWith(p));
  const aberta = ABERTAS.some((p) => caminho.startsWith(p));
  const soLogin = SO_LOGIN.some((p) => caminho.startsWith(p));
  const [etapa, setEtapa] = useState<Etapa>("carregando");
  const [email, setEmail] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  const mostrar = useCallback((texto: string, tipo: Aviso["tipo"] = "ok") => {
    const id = Date.now() + Math.random();
    setAvisos((a) => [...a, { id, texto, tipo }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), tipo === "erro" ? 5200 : 3200);
  }, []);

  useEffect(() => {
    const desligar = aoErroDeSincronia((msg) => mostrar(msg, "erro"));
    return () => {
      desligar();
    };
  }, [mostrar]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      await Promise.resolve(useApp.persist.rehydrate());
      if (aberta) {
        // Link do tutor (dados de exemplo ou banco) e nova senha cuidam de si mesmos.
        if (vivo) setEtapa("pronto");
        return;
      }
      if (!temSupabase) {
        useAssinatura.getState().definir(demoAssinatura());
        if (vivo) setEtapa("pronto");
        return;
      }
      const sb = supabase();

      // Volta do link de confirmação de e-mail (PKCE).
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      if (code) {
        await sb.auth.exchangeCodeForSession(code).catch(() => null);
        window.history.replaceState(null, "", window.location.pathname);
      }

      const { data } = await sb.auth.getSession();
      const sessao = data.session;
      if (!vivo) return;

      if (!sessao) {
        if (localStorage.getItem(CHAVE_DEMO) === "1" && !caminho.startsWith("/bem-vindo") && !soLogin) {
          useAssinatura.getState().definir(demoAssinatura());
          return setEtapa("pronto");
        }
        setEtapa("publica");
        // Sem login, o convite passa primeiro pelo cadastro.
        if (caminho.startsWith("/bem-vindo")) router.replace("/entrar" + window.location.search);
        // Visitante sem conta na página principal vê a página de vendas.
        else if (caminho === "/") router.replace("/conheca");
        else if (!publica) router.replace("/entrar");
        return;
      }

      setEmail(sessao.user.email ?? null);
      localStorage.removeItem(CHAVE_DEMO);
      if (soLogin) {
        // O painel do administrador confere a permissão sozinho (RPC sou_admin).
        setEtapa("pronto");
        return;
      }
      try {
        const c = await carregar(sb, sessao.user.id);
        if (!vivo) return;
        if (c.tipo === "sem-petshop") {
          setEtapa("publica");
          if (!caminho.startsWith("/bem-vindo")) router.replace("/bem-vindo");
          return;
        }
        const [info, admin] = await Promise.all([buscarAssinatura(sb, c.petshopId).catch(() => null), souAdmin(sb)]);
        if (!vivo) return;
        useAssinatura.getState().definir(info, admin);
        useApp.getState().entrarNuvem(sb, sessao.user.id, c.db, c.petshopId);
        setEtapa("pronto");
        if (publica) router.replace("/");
      } catch (e) {
        mostrar(e instanceof Error ? e.message : "Não foi possível carregar os dados.", "erro");
        setEtapa("publica");
      }
    })();
    return () => {
      vivo = false;
    };
    // Roda uma vez; as trocas de conta recarregam a página inteira.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sair = useCallback(async () => {
    localStorage.removeItem(CHAVE_DEMO);
    if (temSupabase) await supabase().auth.signOut();
    window.location.href = "/entrar";
  }, []);

  const mostrarConteudo = etapa === "pronto" || (etapa === "publica" && publica);
  const gpsLigado = useRastreio((s) => s.ativo);

  return (
    <ToastCtx.Provider value={mostrar}>
      <SessaoCtx.Provider value={{ email, temSupabase, sair }}>
        {mostrarConteudo ? (
          children
        ) : (
          <div className="grid min-h-dvh place-items-center bg-white">
            <PawPrint className="h-9 w-9 animate-pulse text-brand-500" />
          </div>
        )}
      </SessaoCtx.Provider>
      {gpsLigado && !aberta && !caminho.startsWith("/rotas") && (
        <Link
          href="/rotas"
          className="fixed left-3 top-3 z-50 flex items-center gap-1.5 rounded-full bg-ok-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-lg lg:left-[268px]"
        >
          <LocateFixed className="h-3.5 w-3.5 animate-pulse" />
          Localização ao vivo
        </Link>
      )}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] mx-auto flex max-w-[440px] flex-col gap-2 px-4 lg:left-[256px]">
        {avisos.map((a) => (
          <div
            key={a.id}
            role="status"
            className={cx(
              "flex items-start gap-2.5 rounded-2xl px-4 py-3 text-[14px] font-medium text-white shadow-lg",
              a.tipo === "ok" ? "bg-ink" : "bg-bad-700",
            )}
          >
            {a.tipo === "ok" ? <CircleCheck className="mt-px h-[18px] w-[18px] shrink-0 text-ok-500" /> : <CircleAlert className="mt-px h-[18px] w-[18px] shrink-0" />}
            <span>{a.texto}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
