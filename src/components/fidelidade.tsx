"use client";

// Cartão de selos do programa de fidelidade (mesmo desenho na ficha do pet e no link do tutor).

import { Gift, PawPrint } from "lucide-react";
import { cx } from "./ui";

export function CartaoSelos({ meta, selos, premio, nomePet, compacto = false }: { meta: number; selos: number; premio: string; nomePet?: string; compacto?: boolean }) {
  const cheios = Math.min(selos, meta);
  const completo = selos >= meta;
  return (
    <div className={cx("rounded-[22px] border px-4 py-4", completo ? "border-ok-500/30 bg-ok-50" : "border-brand-200 bg-brand-50")}>
      <div className="flex items-center gap-3">
        <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-full", completo ? "bg-ok-500 text-white" : "bg-white text-brand-600")}>
          <Gift className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cx("text-[15px] font-semibold", completo ? "text-ok-700" : "text-brand-700")}>
            {completo ? `Prêmio liberado: ${premio}!` : `Cartão fidelidade${nomePet ? ` de ${nomePet}` : ""}`}
          </p>
          <p className="text-[13px] text-muted">
            {completo ? "Use no próximo atendimento." : `${cheios} de ${meta} · faltam ${meta - cheios} para ganhar ${premio.toLowerCase()}`}
          </p>
        </div>
      </div>
      {!compacto && (
        <div className="mt-3 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(meta, 10)}, minmax(0, 1fr))` }} aria-label={`${cheios} de ${meta} selos`}>
          {Array.from({ length: meta }, (_, i) => (
            <span
              key={i}
              className={cx(
                "grid aspect-square place-items-center rounded-full border-2",
                i < cheios ? (completo ? "border-ok-500 bg-ok-500 text-white" : "border-brand-500 bg-brand-500 text-white") : "border-dashed border-brand-200 bg-white text-brand-200",
              )}
            >
              <PawPrint className="h-[55%] w-[55%]" />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
