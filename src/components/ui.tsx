"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { ArrowLeft, Cat, ChevronRight, Dog, X } from "lucide-react";
import { useEffect, type ComponentProps, type ReactNode } from "react";
import type { Pet, StatusAtendimento } from "@/domain/types";
import { NOME_STATUS } from "@/domain/rules";

export const cx = clsx;

// ---------------------------------------------------------------------------
// Chips
// ---------------------------------------------------------------------------

type Tom = "brand" | "ok" | "warn" | "bad" | "info" | "neutral";

const TOM: Record<Tom, string> = {
  brand: "bg-brand-100 text-brand-700",
  ok: "bg-ok-50 text-ok-700",
  warn: "bg-warn-50 text-warn-700",
  bad: "bg-bad-50 text-bad-700",
  info: "bg-info-50 text-info-600",
  neutral: "bg-canvas text-muted",
};

export function Chip({ tom = "brand", children, className }: { tom?: Tom; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-medium leading-none", TOM[tom], className)}>
      {children}
    </span>
  );
}

const TOM_STATUS: Record<StatusAtendimento, Tom> = {
  agendado: "info",
  confirmado: "ok",
  em_atendimento: "brand",
  finalizado: "neutral",
  cancelado: "bad",
  faltou: "warn",
};

export function StatusChip({ status, className }: { status: StatusAtendimento; className?: string }) {
  return (
    <Chip tom={TOM_STATUS[status]} className={className}>
      {NOME_STATUS[status]}
    </Chip>
  );
}

// ---------------------------------------------------------------------------
// Botões
// ---------------------------------------------------------------------------

type BotaoProps = ComponentProps<"button"> & { variante?: "primario" | "contorno" | "fantasma" | "perigo"; icone?: ReactNode };

export function Botao({ variante = "primario", icone, className, children, ...rest }: BotaoProps) {
  return (
    <button
      {...rest}
      className={cx(
        "tap inline-flex h-[52px] w-full items-center justify-center gap-2.5 rounded-2xl px-5 text-[15px] font-semibold disabled:opacity-50 disabled:active:scale-100",
        variante === "primario" && "botao-primario text-white",
        variante === "contorno" && "border-[1.5px] border-brand-300 bg-white text-brand-700 hover:bg-brand-50",
        variante === "fantasma" && "bg-surface text-brand-700 hover:bg-brand-100",
        variante === "perigo" && "border-[1.5px] border-bad-500/30 bg-white text-bad-700 hover:bg-bad-50",
        className,
      )}
    >
      {icone}
      {children}
    </button>
  );
}

export function BotaoLink({ href, icone, children, className }: { href: string; icone?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cx(
        "tap botao-primario inline-flex h-[52px] w-full items-center justify-center gap-2.5 rounded-2xl px-5 text-[15px] font-semibold text-white",
        className,
      )}
    >
      {icone}
      {children}
    </Link>
  );
}

/** Link para fora do app (fatura, WhatsApp) com cara de botão; abre em outra aba. */
export function BotaoExterno({
  href,
  icone,
  children,
  variante = "primario",
  className,
}: {
  href: string;
  icone?: ReactNode;
  children: ReactNode;
  variante?: "primario" | "contorno";
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cx(
        "tap inline-flex h-[52px] w-full items-center justify-center gap-2.5 rounded-2xl px-5 text-[15px] font-semibold",
        variante === "primario" ? "botao-primario text-white" : "border-[1.5px] border-brand-300 bg-white text-brand-700 hover:bg-brand-50",
        className,
      )}
    >
      {icone}
      {children}
    </a>
  );
}

// ---------------------------------------------------------------------------
// Cabeçalhos
// ---------------------------------------------------------------------------

export function Titulo({ children, acao }: { children: ReactNode; acao?: ReactNode }) {
  return (
    <header className="flex items-center justify-between px-5 pb-3 pt-6">
      <h1 className="text-[26px] font-bold tracking-tight text-ink">{children}</h1>
      {acao}
    </header>
  );
}

export function TituloVoltar({ children, acao, voltarPara }: { children: ReactNode; acao?: ReactNode; voltarPara?: string }) {
  const router = useRouter();
  return (
    <header className="flex items-center gap-3 px-4 pb-2 pt-5">
      <button
        aria-label="Voltar"
        onClick={() => (voltarPara ? router.push(voltarPara) : router.back())}
        className="tap -ml-1 grid h-10 w-10 place-items-center rounded-full text-ink hover:bg-surface"
      >
        <ArrowLeft className="h-[22px] w-[22px]" />
      </button>
      <h1 className="flex-1 truncate text-[21px] font-bold tracking-tight">{children}</h1>
      {acao}
    </header>
  );
}

export function Secao({ titulo, acao, children, className }: { titulo: ReactNode; acao?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("px-5", className)}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[17px] font-semibold text-ink">{titulo}</h2>
        {acao}
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Avatar do pet
// ---------------------------------------------------------------------------

const PASTEIS = [
  ["#fdf1dc", "#c98a2b"],
  ["#efe9fe", "#6a4fe3"],
  ["#e5f4ec", "#2f8a57"],
  ["#fde8ec", "#c24a62"],
  ["#e6f0fd", "#3f6fc2"],
  ["#f4eadf", "#94643a"],
];

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

export function PetAvatar({ pet, tamanho = 48 }: { pet: Pick<Pet, "nome" | "especie" | "fotoUrl">; tamanho?: number }) {
  const [fundo, traco] = PASTEIS[hash(pet.nome) % PASTEIS.length];
  const Icone = pet.especie === "gato" ? Cat : Dog;
  if (pet.fotoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={pet.fotoUrl}
        alt={pet.nome}
        width={tamanho}
        height={tamanho}
        loading="lazy"
        className="shrink-0 rounded-full object-cover shadow-[0_2px_10px_rgb(29_26_43/0.14)] ring-2 ring-white"
        style={{ width: tamanho, height: tamanho }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full"
      style={{ width: tamanho, height: tamanho, background: fundo, color: traco }}
    >
      <Icone style={{ width: tamanho * 0.5, height: tamanho * 0.5 }} strokeWidth={1.75} />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Diversos
// ---------------------------------------------------------------------------

export function Progresso({ valor, total, className }: { valor: number; total: number; className?: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((valor / total) * 100)) : 0;
  return (
    <div className={cx("h-2 w-full overflow-hidden rounded-full bg-brand-100", className)} role="progressbar" aria-valuenow={valor} aria-valuemax={total}>
      <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function LinhaLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={cx("tap flex items-center gap-3", className)}>
      {children}
      <ChevronRight className="h-5 w-5 shrink-0 text-subtle" />
    </Link>
  );
}

export function Vazio({ icone, titulo, texto, acao, foto }: { icone: ReactNode; titulo: string; texto?: string; acao?: ReactNode; foto?: string }) {
  return (
    <div className="flex flex-col items-center px-8 py-10 text-center">
      {foto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={foto} alt="" className="mb-4 h-28 w-44 rounded-[22px] object-cover shadow-[0_12px_30px_-12px_rgb(74_51_168/0.45)]" />
      ) : (
        <div className="mb-3 grid h-14 w-14 place-items-center rounded-full bg-surface text-brand-600">{icone}</div>
      )}
      <p className="font-semibold text-ink">{titulo}</p>
      {texto && <p className="mt-1 text-[14px] text-muted">{texto}</p>}
      {acao && <div className="mt-4 w-full">{acao}</div>}
    </div>
  );
}

export function Segmentado<T extends string>({
  opcoes,
  valor,
  onChange,
  className,
}: {
  opcoes: { valor: T; rotulo: ReactNode }[];
  valor: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cx("flex rounded-full bg-surface p-1", className)} role="tablist">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          role="tab"
          aria-selected={o.valor === valor}
          onClick={() => onChange(o.valor)}
          className={cx(
            "flex-1 rounded-full py-2 text-[14px] font-medium transition",
            o.valor === valor ? "bg-brand-600 text-white shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

export function Filtros<T extends string>({
  opcoes,
  valor,
  onChange,
}: {
  opcoes: { valor: T; rotulo: string; contagem?: number }[];
  valor: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          onClick={() => onChange(o.valor)}
          className={cx(
            "tap shrink-0 rounded-full border px-3.5 py-2 text-[13px] font-medium",
            o.valor === valor ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white text-muted",
          )}
        >
          {o.rotulo}
          {o.contagem !== undefined && <span className={cx("ml-1.5", o.valor === valor ? "text-white/75" : "text-subtle")}>{o.contagem}</span>}
        </button>
      ))}
    </div>
  );
}

/** Folha que sobe de baixo (modal). */
export function Folha({ aberta, onFechar, titulo, children }: { aberta: boolean; onFechar: () => void; titulo: ReactNode; children: ReactNode }) {
  useEffect(() => {
    if (!aberta) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", esc);
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", esc);
      document.body.style.overflow = anterior;
    };
  }, [aberta, onFechar]);

  if (!aberta) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center lg:p-6" role="dialog" aria-modal="true">
      <button aria-label="Fechar" className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onFechar} />
      <div className="relative max-h-[88dvh] w-full max-w-[440px] overflow-y-auto rounded-t-[28px] bg-white pb-[max(20px,env(safe-area-inset-bottom))] shadow-2xl lg:max-w-[520px] lg:rounded-[28px] lg:pb-6">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-white px-5 pb-3 pt-4">
          <span className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-line lg:hidden" />
          <h2 className="pt-2 text-[18px] font-bold">{titulo}</h2>
          <button aria-label="Fechar" onClick={onFechar} className="tap mt-2 grid h-9 w-9 place-items-center rounded-full bg-surface text-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5">{children}</div>
      </div>
    </div>
  );
}

export function Campo({ rotulo, children, dica }: { rotulo: string; children: ReactNode; dica?: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{rotulo}</span>
      {children}
      {dica && <span className="mt-1.5 block text-[12.5px] text-muted">{dica}</span>}
    </label>
  );
}

export function Aviso({ tom = "warn", icone, titulo, texto, className }: { tom?: "warn" | "bad" | "info" | "ok"; icone: ReactNode; titulo: ReactNode; texto?: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "flex items-start gap-3 rounded-2xl border px-4 py-3.5",
        tom === "warn" && "border-warn-100 bg-warn-50",
        tom === "bad" && "border-bad-500/20 bg-bad-50",
        tom === "info" && "border-brand-200 bg-brand-50",
        tom === "ok" && "border-ok-500/20 bg-ok-50",
        className,
      )}
    >
      <span className={cx("mt-0.5 shrink-0", tom === "warn" && "text-warn-500", tom === "bad" && "text-bad-500", tom === "info" && "text-brand-600", tom === "ok" && "text-ok-500")}>{icone}</span>
      <div className="min-w-0">
        <p className={cx("text-[14.5px] font-semibold", tom === "warn" && "text-warn-700", tom === "bad" && "text-bad-700", tom === "info" && "text-brand-700", tom === "ok" && "text-ok-700")}>{titulo}</p>
        {texto && <p className={cx("mt-0.5 text-[13px]", tom === "warn" ? "text-warn-700/80" : "text-muted")}>{texto}</p>}
      </div>
    </div>
  );
}

/** Cartão de capa com foto de fundo e véu lavanda, para o topo das telas principais. */
export function CapaFoto({
  foto,
  children,
  className,
  posicao = "center",
  veu = "escuro",
}: {
  foto: string;
  children: ReactNode;
  className?: string;
  posicao?: string;
  veu?: "escuro" | "claro";
}) {
  return (
    <section className={cx("relative isolate overflow-hidden rounded-[28px] shadow-[var(--shadow-hero)]", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={foto} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" style={{ objectPosition: posicao }} />
      <div
        aria-hidden
        className={cx(
          "absolute inset-0 -z-10",
          veu === "escuro"
            ? "bg-[linear-gradient(180deg,rgb(40_26_99/0.04)_0%,rgb(52_33_130/0.30)_42%,rgb(29_18_74/0.86)_100%)]"
            : "bg-[linear-gradient(180deg,rgb(255_255_255/0)_30%,rgb(255_255_255/0.92)_100%)]",
        )}
      />
      {children}
    </section>
  );
}

/** Indicador translúcido usado sobre fotos. */
export function NumeroVidro({ valor, rotulo, sub, href }: { valor: string; rotulo: string; sub?: string; href?: string }) {
  const corpo = (
    <>
      <span className="block text-[22px] font-bold leading-tight tracking-tight text-white">{valor}</span>
      <span className="mt-0.5 block text-[12px] leading-tight text-white/85">{rotulo}</span>
      {sub && <span className="block text-[11px] leading-tight text-white/60">{sub}</span>}
    </>
  );
  const cls = "vidro tap flex-1 rounded-2xl px-2 py-3 text-center";
  return href ? (
    <Link href={href} className={cls}>
      {corpo}
    </Link>
  ) : (
    <div className={cls}>{corpo}</div>
  );
}
