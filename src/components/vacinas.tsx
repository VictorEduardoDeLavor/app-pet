"use client";

// Carteira de saúde do pet (vacinas, vermífugo, antipulgas) com aviso de vencimento.

import { useEffect, useState } from "react";
import { MessageCircle, Plus, Syringe, Trash2 } from "lucide-react";
import { useApp, useDb } from "@/data/store";
import type { TipoVacina, Vacina } from "@/domain/types";
import { NOME_TIPO_VACINA, SUGESTOES_VACINA, proximaSugerida, situacao, textoVencimento, vacinasDoPet } from "@/domain/vacinas";
import { dataCurta, hoje } from "@/domain/format";
import { porId } from "@/domain/rules";
import { Botao, Campo, Chip, Folha, Secao, cx } from "./ui";
import { useToast } from "./providers";
import { WhatsappFolha } from "./whatsapp-folha";

const TOM_SITUACAO = { vencida: "bad", vence_logo: "warn", em_dia: "ok", sem_data: "neutral" } as const;

export function CarteiraSaude({ petId, podeAvisar }: { petId: string; podeAvisar: boolean }) {
  const db = useDb();
  const T = hoje();
  const [editando, setEditando] = useState<Vacina | "nova" | null>(null);
  const [avisar, setAvisar] = useState<string | null>(null);
  const pet = porId(db.pets, petId);
  const lista = vacinasDoPet(db, petId);
  if (!pet) return null;

  return (
    <Secao
      className="mt-6"
      titulo="Vacinas e cuidados"
      acao={
        <button onClick={() => setEditando("nova")} className="tap flex items-center gap-1 text-[14px] font-medium text-brand-600">
          <Plus className="h-4 w-4" />
          Registrar
        </button>
      }
    >
      {lista.length === 0 ? (
        <button onClick={() => setEditando("nova")} className="tap flex w-full items-center gap-3 rounded-2xl border border-dashed border-brand-300 px-4 py-3.5 text-left text-[14px] text-brand-700">
          <Syringe className="h-5 w-5 shrink-0" />
          Anote as vacinas, o vermífugo e o antipulgas. O app avisa quando vencer.
        </button>
      ) : (
        <ul className="divide-y divide-line rounded-[20px] border border-line">
          {lista.map((v) => {
            const sit = situacao(v, T);
            return (
              <li key={v.id} className="flex items-center gap-3 px-4 py-3">
                <button onClick={() => setEditando(v)} className="tap min-w-0 flex-1 text-left">
                  <p className="truncate text-[14.5px] font-medium">{v.nome}</p>
                  <p className="truncate text-[12.5px] text-muted">
                    {NOME_TIPO_VACINA[v.tipo]}
                    {v.aplicadaEm && ` · aplicada ${dataCurta(v.aplicadaEm)}`}
                    {v.proximaEm && ` · vence ${dataCurta(v.proximaEm)}`}
                  </p>
                </button>
                {sit !== "sem_data" && (
                  <Chip tom={TOM_SITUACAO[sit]}>{sit === "vencida" ? "Vencida" : sit === "vence_logo" ? `Vence ${textoVencimento(v.proximaEm!, T)}` : "Em dia"}</Chip>
                )}
                {podeAvisar && (sit === "vencida" || sit === "vence_logo") && (
                  <button aria-label="Avisar o tutor" onClick={() => setAvisar(v.id)} className="tap grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ok-50 text-ok-700">
                    <MessageCircle className="h-4 w-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <VacinaFolha aberta={editando !== null} onFechar={() => setEditando(null)} petId={petId} vacina={editando === "nova" ? undefined : editando ?? undefined} />
      {avisar && <WhatsappFolha aberta onFechar={() => setAvisar(null)} tutorId={pet.tutorId} petId={pet.id} vacinaId={avisar} gatilho="vacina" />}
    </Secao>
  );
}

function VacinaFolha({ aberta, onFechar, petId, vacina }: { aberta: boolean; onFechar: () => void; petId: string; vacina?: Vacina }) {
  const salvar = useApp((s) => s.salvarVacina);
  const excluir = useApp((s) => s.excluirVacina);
  const toast = useToast();
  const [tipo, setTipo] = useState<TipoVacina>("vacina");
  const [nome, setNome] = useState("");
  const [aplicada, setAplicada] = useState("");
  const [proxima, setProxima] = useState("");
  const [obs, setObs] = useState("");
  const [proximaManual, setProximaManual] = useState(false);

  useEffect(() => {
    if (!aberta) return;
    setTipo(vacina?.tipo ?? "vacina");
    setNome(vacina?.nome ?? "");
    setAplicada(vacina?.aplicadaEm ?? hoje());
    setProxima(vacina?.proximaEm ?? "");
    setObs(vacina?.observacao ?? "");
    setProximaManual(!!vacina);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta]);

  // Sugere o próximo vencimento pelo nome (ex.: antirrábica = 1 ano), até a pessoa mudar à mão.
  useEffect(() => {
    if (proximaManual) return;
    const s = proximaSugerida(nome, aplicada);
    if (s) setProxima(s);
  }, [nome, aplicada, proximaManual]);

  return (
    <Folha aberta={aberta} onFechar={onFechar} titulo={vacina ? "Editar registro" : "Registrar vacina ou remédio"}>
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-1.5">
          {(Object.keys(NOME_TIPO_VACINA) as TipoVacina[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={cx("tap rounded-xl border py-2 text-[12.5px] font-medium", tipo === t ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line text-muted")}
            >
              {NOME_TIPO_VACINA[t]}
            </button>
          ))}
        </div>
        <Campo rotulo="Nome">
          <input className="input" list="sugestoes-vacina" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: V10, Antirrábica, Vermífugo" />
          <datalist id="sugestoes-vacina">
            {SUGESTOES_VACINA.filter((s) => tipo === "outro" || s.tipo === tipo).map((s) => (
              <option key={s.nome} value={s.nome} />
            ))}
          </datalist>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Aplicada em">
            <input className="input" type="date" value={aplicada} onChange={(e) => setAplicada(e.target.value)} />
          </Campo>
          <Campo rotulo="Vence em">
            <input
              className="input"
              type="date"
              value={proxima}
              onChange={(e) => {
                setProximaManual(true);
                setProxima(e.target.value);
              }}
            />
          </Campo>
        </div>
        <Campo rotulo="Observação (opcional)">
          <input className="input" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: aplicada na clínica do bairro" />
        </Campo>
      </div>
      <Botao
        className="mt-5"
        onClick={() => {
          const r = salvar({ id: vacina?.id, petId, tipo, nome, aplicadaEm: aplicada || undefined, proximaEm: proxima || undefined, observacao: obs });
          if (!r.ok) return toast(r.erro, "erro");
          toast("Carteira atualizada");
          onFechar();
        }}
      >
        Salvar
      </Botao>
      {vacina && (
        <button
          onClick={() => {
            const r = excluir(vacina.id);
            if (!r.ok) return toast(r.erro, "erro");
            toast("Registro apagado");
            onFechar();
          }}
          className="mx-auto mt-4 flex items-center gap-1.5 text-[14px] font-medium text-bad-700"
        >
          <Trash2 className="h-4 w-4" />
          Apagar este registro
        </button>
      )}
    </Folha>
  );
}
