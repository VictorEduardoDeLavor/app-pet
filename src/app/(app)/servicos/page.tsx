"use client";

import { useEffect, useState } from "react";
import { Copy, Pencil, Plus } from "lucide-react";
import { useApp, useDb } from "@/data/store";
import type { Porte, Servico } from "@/domain/types";
import { servicoEmBranco } from "@/domain/edicao";
import { duracao, lerNumero, moeda } from "@/domain/format";
import { Botao, Campo, Chip, Folha, TituloVoltar, cx } from "@/components/ui";
import { useToast } from "@/components/providers";

const PORTES: Porte[] = ["P", "M", "G", "GG"];
const CATEGORIA: Record<Servico["categoria"], string> = { banho: "Banho", tosa: "Tosa", estetica: "Estética", outros: "Outros" };

export default function Servicos() {
  const db = useDb();
  const [editando, setEditando] = useState<Servico | null>(null);
  const ativos = db.servicos.filter((s) => s.ativo);
  const inativos = db.servicos.filter((s) => !s.ativo);
  return (
    <div>
      <TituloVoltar
        voltarPara="/mais"
        acao={
          <button onClick={() => setEditando(servicoEmBranco())} className="tap flex items-center gap-1.5 rounded-full px-3 py-2 text-[15px] font-medium text-brand-600">
            <Plus className="h-[18px] w-[18px]" />
            Novo
          </button>
        }
      >
        Serviços e preços
      </TituloVoltar>
      <p className="px-5 text-[14px] text-muted">Preço e duração mudam com o porte. A agenda usa estes valores para sugerir o preço e bloquear o horário.</p>
      <ul className="mt-4 space-y-3 px-5">
        {ativos.map((s) => (
          <CartaoServico key={s.id} s={s} onEditar={() => setEditando(s)} />
        ))}
      </ul>
      {inativos.length > 0 && (
        <>
          <p className="mb-2 mt-6 px-5 text-[13px] font-semibold uppercase tracking-wide text-subtle">Desativados</p>
          <ul className="space-y-3 px-5 opacity-70">
            {inativos.map((s) => (
              <CartaoServico key={s.id} s={s} onEditar={() => setEditando(s)} />
            ))}
          </ul>
        </>
      )}
      <EditarServico servico={editando} onFechar={() => setEditando(null)} />
    </div>
  );
}

function CartaoServico({ s, onEditar }: { s: Servico; onEditar: () => void }) {
  return (
    <li className="card px-4 py-4">
      <div className="mb-3 flex items-center gap-2">
        <p className="flex-1 text-[16px] font-semibold">{s.nome}</p>
        <Chip tom="neutral">{CATEGORIA[s.categoria]}</Chip>
        <button aria-label={`Editar ${s.nome}`} onClick={onEditar} className="tap grid h-9 w-9 place-items-center rounded-full text-brand-600 hover:bg-surface">
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
  );
}

type Linha = { preco: string; duracao: string };
const num = lerNumero;
const txt = (n: number) => String(n).replace(".", ",");

function EditarServico({ servico, onFechar }: { servico: Servico | null; onFechar: () => void }) {
  const db = useDb();
  const salvar = useApp((s) => s.salvarServico);
  const toast = useToast();
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState<Servico["categoria"]>("banho");
  const [linhas, setLinhas] = useState<Record<Porte, Linha>>({ P: { preco: "", duracao: "" }, M: { preco: "", duracao: "" }, G: { preco: "", duracao: "" }, GG: { preco: "", duracao: "" } });
  const [comissao, setComissao] = useState("");
  const [ativo, setAtivo] = useState(true);
  const novo = !!servico && !db.servicos.some((s) => s.id === servico.id);

  useEffect(() => {
    if (!servico) return;
    setNome(servico.nome);
    setCategoria(servico.categoria);
    setLinhas(Object.fromEntries(PORTES.map((p) => [p, { preco: novo ? "" : txt(servico.precos[p].preco), duracao: String(servico.precos[p].duracaoMin) }])) as Record<Porte, Linha>);
    setComissao(servico.comissaoPct ? txt(servico.comissaoPct) : "");
    setAtivo(servico.ativo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servico]);

  if (!servico) return null;
  const set = (p: Porte, campo: keyof Linha, v: string) => setLinhas({ ...linhas, [p]: { ...linhas[p], [campo]: v } });
  const repetirP = () => setLinhas(Object.fromEntries(PORTES.map((p) => [p, { ...linhas.P }])) as Record<Porte, Linha>);

  return (
    <Folha aberta onFechar={onFechar} titulo={novo ? "Novo serviço" : `Editar ${servico.nome}`}>
      <div className="space-y-4">
        <Campo rotulo="Nome">
          <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Banho com hidratação" />
        </Campo>
        <div>
          <span className="label">Categoria</span>
          <div className="grid grid-cols-4 gap-1.5">
            {(Object.keys(CATEGORIA) as Servico["categoria"][]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategoria(c)}
                className={cx("tap rounded-xl border py-2 text-[13px] font-medium", categoria === c ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line text-muted")}
              >
                {CATEGORIA[c]}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-[64px_1fr_1fr] items-center gap-x-3 gap-y-2.5">
          <span />
          <span className="label !mb-0">Preço (R$)</span>
          <span className="label !mb-0">Duração (min)</span>
          {PORTES.map((p) => (
            <div key={p} className="contents">
              <span className="text-[14px] font-semibold">Porte {p}</span>
              <input className="input !py-2.5" inputMode="decimal" value={linhas[p].preco} onChange={(e) => set(p, "preco", e.target.value)} placeholder="0,00" />
              <input className="input !py-2.5" inputMode="numeric" value={linhas[p].duracao} onChange={(e) => set(p, "duracao", e.target.value)} />
            </div>
          ))}
        </div>
        <button type="button" onClick={repetirP} className="flex items-center gap-1.5 text-[13.5px] font-medium text-brand-600">
          <Copy className="h-4 w-4" />
          Usar o preço e a duração do P em todos os portes
        </button>
        <Campo rotulo="Comissão do profissional (%)" dica="Vale para quem não tem comissão própria na Equipe.">
          <input className="input" inputMode="decimal" value={comissao} onChange={(e) => setComissao(e.target.value)} placeholder="0" />
        </Campo>
        {!novo && (
          <label className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 text-[14.5px]">
            <span>
              Serviço ativo
              <span className="block text-[12.5px] text-muted">Desativado some da agenda e da página de agendamento; o histórico fica.</span>
            </span>
            <input type="checkbox" className="h-6 w-6 accent-brand-600" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
          </label>
        )}
      </div>
      <Botao
        className="mt-5"
        onClick={() => {
          const precos = Object.fromEntries(
            PORTES.map((p) => [p, { preco: linhas[p].preco.trim() === "" ? 0 : num(linhas[p].preco), duracaoMin: num(linhas[p].duracao) }]),
          ) as Servico["precos"];
          if (PORTES.some((p) => Number.isNaN(precos[p].preco) || Number.isNaN(precos[p].duracaoMin))) return toast("Use só números nos preços e durações.", "erro");
          const comissaoPct = comissao.trim() ? num(comissao) : 0;
          if (Number.isNaN(comissaoPct)) return toast("Comissão inválida.", "erro");
          const r = salvar({ ...servico, nome, categoria, precos, comissaoPct, ativo });
          if (!r.ok) return toast(r.erro, "erro");
          toast(novo ? "Serviço criado" : "Serviço atualizado");
          onFechar();
        }}
      >
        {novo ? "Criar serviço" : "Salvar"}
      </Botao>
    </Folha>
  );
}
