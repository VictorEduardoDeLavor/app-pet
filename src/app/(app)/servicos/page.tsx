"use client";

import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { useApp, useDb } from "@/data/store";
import type { Porte, Servico } from "@/domain/types";
import { duracao, moeda } from "@/domain/format";
import { Botao, Chip, Folha, TituloVoltar } from "@/components/ui";
import { useToast } from "@/components/providers";

const PORTES: Porte[] = ["P", "M", "G", "GG"];
const CATEGORIA: Record<Servico["categoria"], string> = { banho: "Banho", tosa: "Tosa", estetica: "Estética", outros: "Outros" };

export default function Servicos() {
  const db = useDb();
  const [editando, setEditando] = useState<Servico | null>(null);
  return (
    <div>
      <TituloVoltar voltarPara="/mais">Serviços e preços</TituloVoltar>
      <p className="px-5 text-[14px] text-muted">Preço e duração mudam com o porte. A agenda usa estes valores para sugerir o preço e bloquear o horário.</p>
      <ul className="mt-4 space-y-3 px-5">
        {db.servicos.map((s) => (
          <li key={s.id} className="card px-4 py-4">
            <div className="mb-3 flex items-center gap-2">
              <p className="flex-1 text-[16px] font-semibold">{s.nome}</p>
              <Chip tom="neutral">{CATEGORIA[s.categoria]}</Chip>
              <button aria-label={`Editar ${s.nome}`} onClick={() => setEditando(s)} className="tap grid h-9 w-9 place-items-center rounded-full text-brand-600 hover:bg-surface">
                <Pencil className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {PORTES.map((p) => (
                <div key={p} className="rounded-xl bg-surface px-1 py-2">
                  <p className="text-[11.5px] font-semibold text-muted">Porte {p}</p>
                  <p className="text-[14.5px] font-semibold">{moeda(s.precos[p].preco).replace(",00", "")}</p>
                  <p className="text-[11.5px] text-muted">{duracao(s.precos[p].duracaoMin)}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[12.5px] text-muted">Comissão do profissional: {s.comissaoPct}%</p>
          </li>
        ))}
      </ul>
      <EditarServico servico={editando} onFechar={() => setEditando(null)} />
    </div>
  );
}

function EditarServico({ servico, onFechar }: { servico: Servico | null; onFechar: () => void }) {
  const salvar = useApp((s) => s.salvarServico);
  const toast = useToast();
  const [rasc, setRasc] = useState<Servico | null>(servico);
  useEffect(() => setRasc(servico), [servico]);
  if (!rasc) return <Folha aberta={false} onFechar={onFechar} titulo="">{null}</Folha>;
  const setPorte = (p: Porte, campo: "preco" | "duracaoMin", v: string) =>
    setRasc({ ...rasc, precos: { ...rasc.precos, [p]: { ...rasc.precos[p], [campo]: Number(v.replace(",", ".")) || 0 } } });

  return (
    <Folha aberta={!!servico} onFechar={onFechar} titulo={`Editar ${rasc.nome}`}>
      <div className="grid grid-cols-[56px_1fr_1fr] items-center gap-x-3 gap-y-2.5">
        <span />
        <span className="label !mb-0">Preço (R$)</span>
        <span className="label !mb-0">Duração (min)</span>
        {PORTES.map((p) => (
          <div key={p} className="contents">
            <span className="text-[14px] font-semibold">Porte {p}</span>
            <input className="input !py-2.5" inputMode="decimal" value={rasc.precos[p].preco} onChange={(e) => setPorte(p, "preco", e.target.value)} />
            <input className="input !py-2.5" inputMode="numeric" value={rasc.precos[p].duracaoMin} onChange={(e) => setPorte(p, "duracaoMin", e.target.value)} />
          </div>
        ))}
      </div>
      <label className="mt-4 block">
        <span className="label">Comissão do profissional (%)</span>
        <input className="input" inputMode="numeric" value={rasc.comissaoPct} onChange={(e) => setRasc({ ...rasc, comissaoPct: Number(e.target.value) || 0 })} />
      </label>
      <Botao
        className="mt-5"
        onClick={() => {
          salvar(rasc);
          toast("Serviço atualizado");
          onFechar();
        }}
      >
        Salvar
      </Botao>
    </Folha>
  );
}
