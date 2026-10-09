"use client";

// Extrato de comissões: quanto cada pessoa tem a receber desde o último pagamento,
// o detalhe atendimento por atendimento e o registro do pagamento (vira despesa no caixa).

import { useState } from "react";
import { HandCoins, Receipt } from "lucide-react";
import { useApp, useDb } from "@/data/store";
import type { FormaPagamento, Membro } from "@/domain/types";
import { comissaoDoAtendimento, comissoesPendentes, porId, totalComissao, ultimoAcerto } from "@/domain/rules";
import { NOME_FORMA, dataCurta, hoje, iniciais, moeda, primeiroNome } from "@/domain/format";
import { Botao, Chip, Folha, PetAvatar, TituloVoltar, Vazio, cx } from "@/components/ui";
import { useToast } from "@/components/providers";

const FORMAS: FormaPagamento[] = ["pix", "dinheiro", "transferencia", "debito"];

export default function ComissoesPagina() {
  const db = useDb();
  const T = hoje();
  const [aberto, setAberto] = useState<Membro | null>(null);
  // Quem atende ou já atendeu (inclui quem saiu da equipe mas ainda tem comissão).
  const pessoas = db.membros.filter(
    (m) => (m.ativo && m.papel === "banhista") || db.atendimentos.some((a) => a.profissionalId === m.id && a.status === "finalizado") || comissoesPendentes(db, m.id, T).length > 0,
  ).filter((m) => !(m.semComissao && totalComissao(db, comissoesPendentes(db, m.id, T)) === 0)); // "sem comissão" (ex.: o dono) só aparece se tiver saldo antigo
  const totalGeral = pessoas.reduce((s, m) => s + totalComissao(db, comissoesPendentes(db, m.id, T)), 0);

  return (
    <div>
      <TituloVoltar voltarPara="/mais">Comissões</TituloVoltar>
      <div className="mx-5 mt-2 rounded-[22px] bg-gradient-to-br from-brand-600 to-brand-800 px-5 py-5 text-white shadow-[var(--shadow-hero)]">
        <p className="text-[13px] text-white/80">Total a pagar até hoje</p>
        <p className="mt-1 text-[32px] font-bold tracking-tight">{moeda(totalGeral)}</p>
        <p className="mt-1 text-[12.5px] text-white/70">Sobre o preço de tabela dos serviços finalizados, inclusive os cobertos por plano.</p>
      </div>

      {pessoas.length === 0 ? (
        <Vazio icone={<HandCoins className="h-6 w-6" />} titulo="Ninguém com comissão ainda" texto="Quando alguém finalizar um atendimento, a comissão aparece aqui." />
      ) : (
        <ul className="mx-5 mt-5 space-y-2.5">
          {pessoas.map((m) => {
            const pend = comissoesPendentes(db, m.id, T);
            const valor = totalComissao(db, pend);
            const ultimo = ultimoAcerto(db, m.id);
            return (
              <li key={m.id}>
                <button onClick={() => setAberto(m)} className="tap card flex w-full items-center gap-3 px-4 py-3.5 text-left">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-100 text-[14px] font-bold text-brand-700">{iniciais(m.nome)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{m.nome}</span>
                    <span className="block truncate text-[12.5px] text-muted">
                      {pend.length} {pend.length === 1 ? "atendimento" : "atendimentos"}
                      {ultimo ? ` · último pagamento ${dataCurta(ultimo.ate)}` : " · nenhum pagamento ainda"}
                    </span>
                  </span>
                  <span className={cx("shrink-0 text-[16px] font-bold", valor > 0 ? "text-ink" : "text-subtle")}>{moeda(valor)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {aberto && <ExtratoFolha membro={aberto} onFechar={() => setAberto(null)} />}
    </div>
  );
}

function ExtratoFolha({ membro, onFechar }: { membro: Membro; onFechar: () => void }) {
  const db = useDb();
  const pagar = useApp((s) => s.registrarAcerto);
  const toast = useToast();
  const T = hoje();
  const [forma, setForma] = useState<FormaPagamento>("pix");
  const [confirmando, setConfirmando] = useState(false);
  const pend = comissoesPendentes(db, membro.id, T);
  const valor = totalComissao(db, pend);
  const acertos = db.acertos.filter((a) => a.membroId === membro.id).sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1));

  return (
    <Folha aberta onFechar={onFechar} titulo={`Comissão de ${primeiroNome(membro.nome)}`}>
      <div className="rounded-2xl bg-surface px-4 py-3.5">
        <p className="text-[13px] text-muted">A pagar até hoje</p>
        <p className="text-[26px] font-bold tracking-tight">{moeda(valor)}</p>
        {pend.length > 0 && (
          <p className="text-[12.5px] text-muted">
            De {dataCurta(pend[0].data)} a {dataCurta(pend.at(-1)!.data)} · {pend.length} {pend.length === 1 ? "atendimento" : "atendimentos"}
          </p>
        )}
      </div>

      {pend.length > 0 && (
        <ul className="mt-4 divide-y divide-line rounded-2xl border border-line">
          {pend.map((a) => {
            const pet = porId(db.pets, a.petId);
            return (
              <li key={a.id} className="flex items-center gap-3 px-3.5 py-2.5">
                {pet && <PetAvatar pet={pet} tamanho={34} />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium">
                    {pet?.nome} · {dataCurta(a.data)}
                  </p>
                  <p className="truncate text-[12px] text-muted">{a.itens.map((i) => i.nome + (i.cobertoPorPlano ? " (plano)" : "")).join(" + ")}</p>
                </div>
                <span className="shrink-0 text-[14px] font-semibold">{moeda(comissaoDoAtendimento(db, a))}</span>
              </li>
            );
          })}
        </ul>
      )}

      {valor > 0 &&
        (confirmando ? (
          <div className="mt-5 rounded-2xl border border-brand-200 bg-brand-50 p-4">
            <p className="text-[14px] font-semibold text-brand-700">Como você pagou?</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {FORMAS.map((f) => (
                <button
                  key={f}
                  onClick={() => setForma(f)}
                  className={cx("tap rounded-xl border py-2.5 text-[14px] font-medium", forma === f ? "border-brand-600 bg-white text-brand-700" : "border-transparent bg-white/60 text-muted")}
                >
                  {NOME_FORMA[f]}
                </button>
              ))}
            </div>
            <Botao
              className="mt-4"
              icone={<HandCoins className="h-5 w-5" />}
              onClick={() => {
                const r = pagar({ membroId: membro.id, ate: T, formaPagamento: forma });
                if (!r.ok) return toast(r.erro, "erro");
                toast(`Pagamento de ${moeda(r.valor.acerto.valor)} registrado e lançado no caixa`);
                setConfirmando(false);
              }}
            >
              Confirmar {moeda(valor)} em {NOME_FORMA[forma].toLowerCase()}
            </Botao>
          </div>
        ) : (
          <Botao className="mt-5" icone={<HandCoins className="h-5 w-5" />} onClick={() => setConfirmando(true)}>
            Registrar pagamento
          </Botao>
        ))}

      {acertos.length > 0 && (
        <section className="mt-6 pb-2">
          <h3 className="mb-2 flex items-center gap-1.5 text-[14px] font-semibold">
            <Receipt className="h-4 w-4 text-brand-600" /> Pagamentos feitos
          </h3>
          <ul className="space-y-2">
            {acertos.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded-xl bg-surface px-3.5 py-2.5 text-[13.5px]">
                <span>
                  {dataCurta(a.de)} a {dataCurta(a.ate)}
                  <span className="block text-[12px] text-muted">{NOME_FORMA[a.formaPagamento]}</span>
                </span>
                <Chip tom="ok">{moeda(a.valor)}</Chip>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Folha>
  );
}
