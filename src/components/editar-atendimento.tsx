"use client";

// Reagendar (dia, horário, profissional) e mudar serviços, desconto e observações de um atendimento.

import { useEffect, useMemo, useState } from "react";
import { useApp, useDb } from "@/data/store";
import { conflitos, montarItens, petshopAberto, porId, profissionais } from "@/domain/rules";
import { dataLonga, duracao, horaDeMinutos, lerNumero, minutos, moeda } from "@/domain/format";
import { Botao, Campo, Folha, cx } from "./ui";
import { useToast } from "./providers";

export function EditarAtendimentoFolha({ aberta, onFechar, atendimentoId }: { aberta: boolean; onFechar: () => void; atendimentoId: string }) {
  const db = useDb();
  const editar = useApp((s) => s.editarAtendimento);
  const toast = useToast();
  const a = porId(db.atendimentos, atendimentoId);
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [prof, setProf] = useState("");
  const [servicos, setServicos] = useState<string[]>([]);
  const [desconto, setDesconto] = useState("");
  const [obs, setObs] = useState("");

  useEffect(() => {
    if (!aberta || !a) return;
    setData(a.data);
    setHora(a.hora);
    setProf(a.profissionalId);
    setServicos(a.itens.map((i) => i.servicoId));
    setDesconto(a.desconto ? String(a.desconto).replace(".", ",") : "");
    setObs(a.observacoes ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta]);

  const previa = useMemo(() => {
    if (!a || servicos.length === 0) return null;
    try {
      return montarItens(db, a.petId, servicos, data || a.data);
    } catch {
      return null;
    }
  }, [db, a, servicos, data]);

  if (!a) return null;
  const aberto = ["agendado", "confirmado"].includes(a.status);
  const dur = previa?.duracaoMin ?? a.duracaoMin;
  const abre = minutos(db.petshop.abre);
  const fecha = minutos(db.petshop.fecha);
  const horarios: string[] = [];
  if (data && petshopAberto(db, data)) {
    for (let m = abre; m + dur <= fecha; m += 30) {
      const h = horaDeMinutos(m);
      if (conflitos(db, { profissionalId: prof, data, hora: h, duracaoMin: dur, ignorarId: a.id }).length === 0) horarios.push(h);
    }
  }
  if (hora && !horarios.includes(hora) && data === a.data && prof === a.profissionalId) horarios.unshift(hora);
  horarios.sort();
  const bruto = previa ? previa.valorSugerido : a.itens.filter((i) => !i.cobertoPorPlano).reduce((s, i) => s + i.preco, 0);
  const desc = lerNumero(desconto) || 0;

  return (
    <Folha aberta={aberta} onFechar={onFechar} titulo="Editar atendimento">
      <div className="space-y-4">
        {aberto ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Dia">
                <input className="input" type="date" value={data} onChange={(e) => setData(e.target.value)} />
              </Campo>
              <Campo rotulo="Profissional">
                <select className="input" value={prof} onChange={(e) => setProf(e.target.value)}>
                  {profissionais(db).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome.split(" ")[0]}
                    </option>
                  ))}
                </select>
              </Campo>
            </div>
            <div>
              <span className="label">{data ? `Horário · ${dataLonga(data)}` : "Horário"}</span>
              {data && !petshopAberto(db, data) ? (
                <p className="rounded-2xl bg-warn-50 px-4 py-3 text-[14px] text-warn-700">O pet shop não abre neste dia.</p>
              ) : horarios.length === 0 ? (
                <p className="rounded-2xl bg-surface px-4 py-3 text-[14px] text-muted">Nenhum horário livre para {duracao(dur)} neste dia.</p>
              ) : (
                <div className="grid grid-cols-4 gap-1.5">
                  {horarios.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setHora(h)}
                      className={cx("tap rounded-xl border py-2 text-[13.5px] font-medium tabular-nums", hora === h ? "border-brand-600 bg-brand-600 text-white" : "border-line text-ink/80")}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="rounded-2xl bg-surface px-4 py-3 text-[13.5px] text-muted">O atendimento já começou: dá para mudar serviços, desconto e observações.</p>
        )}

        <div>
          <span className="label">Serviços</span>
          <div className="flex flex-wrap gap-2">
            {db.servicos
              .filter((s) => s.ativo || servicos.includes(s.id))
              .map((s) => {
                const on = servicos.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setServicos(on ? servicos.filter((x) => x !== s.id) : [...servicos, s.id])}
                    className={cx("tap rounded-full border px-3.5 py-2 text-[13.5px] font-medium", on ? "border-brand-600 bg-brand-600 text-white" : "border-line text-muted")}
                  >
                    {s.nome}
                  </button>
                );
              })}
          </div>
          {previa?.planoPetId && <p className="mt-1.5 text-[12.5px] text-ok-700">Um serviço é coberto pelo plano do pet.</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Desconto (R$)">
            <input className="input" inputMode="decimal" value={desconto} onChange={(e) => setDesconto(e.target.value)} placeholder="0,00" />
          </Campo>
          <div>
            <span className="label">A cobrar</span>
            <p className="rounded-2xl bg-surface px-4 py-3 text-[17px] font-semibold text-brand-700">{moeda(Math.max(0, bruto - desc))}</p>
          </div>
        </div>
        <Campo rotulo="Observações do atendimento">
          <textarea className="input resize-none" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
        </Campo>
      </div>
      <Botao
        className="mt-5"
        onClick={() => {
          if (Number.isNaN(lerNumero(desconto)) && desconto.trim()) return toast("Desconto inválido.", "erro");
          const r = editar(a.id, aberto ? { data, hora, profissionalId: prof, servicoIds: servicos, desconto: desc, observacoes: obs } : { servicoIds: servicos, desconto: desc, observacoes: obs });
          if (!r.ok) return toast(r.erro, "erro");
          toast("Atendimento atualizado");
          onFechar();
        }}
      >
        Salvar alterações
      </Botao>
    </Folha>
  );
}
