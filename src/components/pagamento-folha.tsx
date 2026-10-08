"use client";

import { useEffect, useState } from "react";
import { Banknote, CreditCard, Landmark, QrCode, WalletCards } from "lucide-react";
import { useApp, useDb } from "@/data/store";
import type { FormaPagamento } from "@/domain/types";
import { porId, resumoCaixa } from "@/domain/rules";
import { dataCurta, hoje, moeda } from "@/domain/format";
import { Botao, Folha, PetAvatar, cx } from "./ui";
import { useToast } from "./providers";

export const FORMAS: { valor: FormaPagamento; rotulo: string; Icone: typeof QrCode }[] = [
  { valor: "pix", rotulo: "Pix", Icone: QrCode },
  { valor: "dinheiro", rotulo: "Dinheiro", Icone: Banknote },
  { valor: "debito", rotulo: "Débito", Icone: CreditCard },
  { valor: "credito", rotulo: "Crédito", Icone: WalletCards },
  { valor: "transferencia", rotulo: "Transferência", Icone: Landmark },
];

export function SeletorForma({ valor, onChange }: { valor: FormaPagamento; onChange: (f: FormaPagamento) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {FORMAS.map(({ valor: v, rotulo, Icone }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cx(
            "tap flex flex-col items-center gap-1.5 rounded-2xl border py-3 text-[13px] font-medium",
            v === valor ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line text-muted",
          )}
        >
          <Icone className="h-5 w-5" />
          {rotulo}
        </button>
      ))}
    </div>
  );
}

export function PagamentoFolha({ aberta, onFechar, lancamentoId }: { aberta: boolean; onFechar: () => void; lancamentoId?: string }) {
  const db = useDb();
  const pagar = useApp((s) => s.pagarLancamento);
  const toast = useToast();
  const pendentes = resumoCaixa(db, hoje()).pendentes;
  const [escolhido, setEscolhido] = useState<string | undefined>(lancamentoId);
  const [forma, setForma] = useState<FormaPagamento>("pix");

  useEffect(() => {
    if (aberta) {
      setEscolhido(lancamentoId ?? pendentes[0]?.id);
      setForma("pix");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta, lancamentoId]);

  const lanc = porId(db.lancamentos, escolhido);

  return (
    <Folha aberta={aberta} onFechar={onFechar} titulo="Registrar pagamento">
      {!lancamentoId && (
        <>
          <p className="label">Qual atendimento?</p>
          {pendentes.length === 0 ? (
            <p className="mb-4 rounded-2xl bg-surface px-4 py-3 text-[14px] text-muted">Nada a receber. Tudo pago.</p>
          ) : (
            <ul className="mb-5 space-y-2">
              {pendentes.map((l) => {
                const atd = porId(db.atendimentos, l.atendimentoId);
                const pet = atd ? porId(db.pets, atd.petId) : undefined;
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => setEscolhido(l.id)}
                      className={cx(
                        "tap flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left",
                        escolhido === l.id ? "border-brand-600 bg-brand-50" : "border-line",
                      )}
                    >
                      {pet && <PetAvatar pet={pet} tamanho={40} />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14.5px] font-semibold">{l.descricao}</span>
                        <span className="block text-[12.5px] text-muted">{atd ? `${dataCurta(atd.data)} · ${atd.hora}` : dataCurta(l.competencia)}</span>
                      </span>
                      <span className="text-[15px] font-semibold">{moeda(l.valor)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {lanc && (
        <>
          {lancamentoId && (
            <div className="mb-4 rounded-2xl bg-surface px-4 py-3">
              <p className="text-[13px] text-muted">{lanc.descricao}</p>
              <p className="text-[28px] font-bold tracking-tight text-brand-700">{moeda(lanc.valor)}</p>
            </div>
          )}
          <p className="label">Forma de pagamento</p>
          <SeletorForma valor={forma} onChange={setForma} />
          <Botao
            className="mt-5"
            onClick={() => {
              const r = pagar(lanc.id, forma);
              if (!r.ok) return toast(r.erro, "erro");
              toast(`${moeda(lanc.valor)} recebido. Entrou no caixa de hoje.`);
              onFechar();
            }}
          >
            Confirmar {moeda(lanc.valor)}
          </Botao>
        </>
      )}
    </Folha>
  );
}
