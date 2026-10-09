"use client";

// Campos do leva e traz (agendamento e ficha do atendimento).

import { useEffect, useState } from "react";
import { Car } from "lucide-react";
import { useApp, useDb } from "@/data/store";
import type { Transporte } from "@/domain/types";
import { NOME_TRANSPORTE, motoristas, porId } from "@/domain/rules";
import { Botao, Campo, Folha, cx } from "./ui";
import { useToast } from "./providers";

export interface ValorTransporte {
  transporte: Transporte;
  enderecoTransporte: string;
  motoristaId?: string;
}

const OPCOES: Transporte[] = ["nenhum", "busca", "entrega", "busca_e_entrega"];

export function CamposTransporte({ valor, onChange }: { valor: ValorTransporte; onChange: (v: ValorTransporte) => void }) {
  const db = useDb();
  const quem = motoristas(db);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {OPCOES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange({ ...valor, transporte: t, motoristaId: valor.motoristaId ?? quem.find((m) => m.papel === "motorista")?.id ?? quem[0]?.id })}
            className={cx(
              "tap rounded-xl border px-2 py-2.5 text-[13.5px] font-medium",
              valor.transporte === t ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line text-muted",
            )}
          >
            {NOME_TRANSPORTE[t]}
          </button>
        ))}
      </div>
      {valor.transporte !== "nenhum" && (
        <>
          <Campo rotulo="Endereço" dica="O motorista abre a rota no Google Maps com um toque.">
            <input
              className="input"
              value={valor.enderecoTransporte}
              onChange={(e) => onChange({ ...valor, enderecoTransporte: e.target.value })}
              placeholder="Rua, número, bairro"
              autoComplete="street-address"
            />
          </Campo>
          <div>
            <span className="label">Motorista</span>
            <div className="flex flex-wrap gap-2">
              {quem.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onChange({ ...valor, motoristaId: m.id })}
                  className={cx(
                    "tap rounded-full border px-4 py-2 text-[14px] font-medium",
                    m.id === valor.motoristaId ? "border-brand-600 bg-brand-600 text-white" : "border-line text-muted",
                  )}
                >
                  {m.nome.split(" ")[0]}
                </button>
              ))}
            </div>
            {!quem.some((m) => m.papel === "motorista") && (
              <p className="mt-1.5 text-[12.5px] text-muted">Cadastre o motorista em Equipe para ele ver as rotas no celular dele.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function TransporteFolha({ atendimentoId, aberta, onFechar }: { atendimentoId: string; aberta: boolean; onFechar: () => void }) {
  const db = useDb();
  const definir = useApp((s) => s.definirTransporte);
  const toast = useToast();
  const a = porId(db.atendimentos, atendimentoId);
  const tutor = a ? porId(db.tutores, a.tutorId) : undefined;
  const [v, setV] = useState<ValorTransporte>({ transporte: "nenhum", enderecoTransporte: "" });

  useEffect(() => {
    if (aberta && a) setV({ transporte: a.transporte, enderecoTransporte: a.enderecoTransporte ?? tutor?.endereco ?? "", motoristaId: a.motoristaId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta]);

  if (!a) return null;
  return (
    <Folha aberta={aberta} onFechar={onFechar} titulo="Leva e traz">
      <CamposTransporte valor={v} onChange={setV} />
      <Botao
        className="mt-5"
        icone={<Car className="h-5 w-5" />}
        onClick={() => {
          const r = definir(a.id, v);
          if (!r.ok) return toast(r.erro, "erro");
          toast(v.transporte === "nenhum" ? "Sem leva e traz neste atendimento" : `${NOME_TRANSPORTE[v.transporte]} combinado`);
          onFechar();
        }}
      >
        Salvar
      </Botao>
    </Folha>
  );
}
