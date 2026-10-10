"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import type { Especie } from "@/domain/types";
import { buscarRacas, racaDaLista } from "@/domain/racas";
import { cx } from "./ui";

/**
 * Raça com busca: digite uma ou duas letras e escolha na lista (cães ou gatos).
 * A lista fica logo abaixo do campo, empurrando o resto, para não ser cortada dentro das folhas
 * e funcionar igual no iPhone e no Android. Texto fora da lista também vale.
 */
export function CampoRaca({
  valor,
  onChange,
  especie,
  placeholder = "Digite para buscar. Ex.: shih, lulu, SRD",
  className,
}: {
  valor: string;
  onChange: (v: string) => void;
  especie: Especie;
  placeholder?: string;
  className?: string;
}) {
  const id = useId();
  const campo = useRef<HTMLInputElement>(null);
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const sugestoes = useMemo(() => buscarRacas(valor, especie, 6), [valor, especie]);
  const escolhida = racaDaLista(valor, especie);
  const mostrar = aberto && sugestoes.length > 0 && !(escolhida && sugestoes[0]?.nome === valor.trim());

  const escolher = (nome: string) => {
    onChange(nome);
    setAberto(false);
  };

  return (
    <div className={className}>
      <div className="relative">
        <input
          className={cx("input scroll-mt-24", escolhida && "pr-11")}
          value={valor}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={mostrar}
          aria-controls={`${id}-lista`}
          aria-autocomplete="list"
          ref={campo}
          onFocus={() => {
            setAberto(true);
            // No celular o teclado cobre a metade de baixo: sobe o campo para a lista caber na tela.
            setTimeout(() => campo.current?.scrollIntoView({ block: "start", behavior: "smooth" }), 300);
          }}
          onBlur={() => setTimeout(() => setAberto(false), 150)}
          onChange={(e) => {
            onChange(e.target.value);
            setAtivo(0);
            setAberto(true);
          }}
          onKeyDown={(e) => {
            if (!mostrar) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setAtivo((i) => Math.min(i + 1, sugestoes.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setAtivo((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              escolher(sugestoes[ativo].nome);
            } else if (e.key === "Escape") {
              setAberto(false);
            }
          }}
        />
        {escolhida && <Check aria-hidden className="pointer-events-none absolute right-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-brand-600" />}
      </div>
      {mostrar && (
        <ul id={`${id}-lista`} role="listbox" className="mt-1.5 overflow-hidden rounded-2xl border border-line bg-white shadow-[0_12px_28px_-16px_rgb(29_26_43/0.35)]">
          {sugestoes.map((r, i) => (
            <li key={r.nome} role="option" aria-selected={i === ativo}>
              <button
                type="button"
                // Mantém o foco no campo para o toque não fechar a lista antes de escolher.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => escolher(r.nome)}
                className={cx("flex w-full items-center px-4 py-2.5 text-left text-[14.5px] text-ink", i === ativo ? "bg-brand-50" : "hover:bg-surface", i > 0 && "border-t border-line")}
              >
                {r.nome}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
