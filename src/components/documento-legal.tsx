import Link from "next/link";
import type { ReactNode } from "react";
import { PawPrint } from "lucide-react";
import { MARCA } from "@/lib/marca";

export function DocumentoLegal({ titulo, atualizado, children }: { titulo: string; atualizado: string; children: ReactNode }) {
  return (
    <main className="mx-auto min-h-dvh max-w-[760px] bg-white px-5 pb-20 pt-8 sm:px-8">
      <Link href="/conheca" className="inline-flex items-center gap-2 text-brand-700">
        <PawPrint className="h-7 w-7" strokeWidth={2.2} />
        <span className="text-[17px] font-bold tracking-tight">{MARCA.nome}</span>
      </Link>
      <h1 className="mt-8 text-[30px] font-bold leading-tight tracking-tight">{titulo}</h1>
      <p className="mt-2 text-[13.5px] text-muted">
        Versão {MARCA.versaoTermos} · atualizada em {atualizado}
      </p>
      <article className="legal mt-8 space-y-4 text-[15px] leading-relaxed text-ink/90">{children}</article>
      <footer className="mt-14 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-6 text-[13.5px] text-muted">
        <Link href="/termos" className="hover:text-brand-700">
          Termos de uso
        </Link>
        <Link href="/privacidade" className="hover:text-brand-700">
          Política de privacidade
        </Link>
        <Link href="/conheca" className="hover:text-brand-700">
          Conheça o {MARCA.nome}
        </Link>
      </footer>
    </main>
  );
}

export function quemOferece(): string {
  const { razaoSocial, documento } = MARCA.empresa;
  if (razaoSocial) return `${razaoSocial}${documento ? `, inscrito(a) sob o nº ${documento}` : ""}`;
  return `o responsável pelo ${MARCA.nome}`;
}

export function contato(): string {
  if (MARCA.suporteEmail) return `pelo e-mail ${MARCA.suporteEmail}`;
  if (MARCA.suporteWhatsapp) return `pelo WhatsApp de suporte informado no app`;
  return "pelos canais de suporte informados no app";
}
