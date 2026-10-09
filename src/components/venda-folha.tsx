"use client";

// Venda de produtos: no balcão (com ou sem cliente) ou junto com o atendimento do pet.

import { useEffect, useMemo, useState } from "react";
import { Minus, PackageSearch, Plus, Search, ShoppingBag, X } from "lucide-react";
import { useApp, useDb } from "@/data/store";
import type { FormaPagamento } from "@/domain/types";
import { porId } from "@/domain/rules";
import { totalDaVenda } from "@/domain/produtos";
import { lerNumero, moeda } from "@/domain/format";
import { Botao, Campo, Folha, cx } from "./ui";
import { SeletorForma } from "./pagamento-folha";
import { useToast } from "./providers";

type Item = { produtoId: string; quantidade: number; preco: string };

export function VendaFolha({ aberta, onFechar, atendimentoId, tutorInicial }: { aberta: boolean; onFechar: () => void; atendimentoId?: string; tutorInicial?: string }) {
  const db = useDb();
  const registrar = useApp((s) => s.registrarVenda);
  const toast = useToast();
  const atd = porId(db.atendimentos, atendimentoId);
  const [itens, setItens] = useState<Item[]>([]);
  const [busca, setBusca] = useState("");
  const [desconto, setDesconto] = useState("");
  const [forma, setForma] = useState<FormaPagamento | "depois">("pix");
  const [tutorId, setTutorId] = useState<string | undefined>(undefined);
  const [buscaCliente, setBuscaCliente] = useState("");

  useEffect(() => {
    if (!aberta) return;
    setItens([]);
    setBusca("");
    setDesconto("");
    setForma(atendimentoId ? "depois" : "pix");
    setTutorId(atd?.tutorId ?? tutorInicial);
    setBuscaCliente("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta]);

  const produtos = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return db.produtos.filter((p) => p.ativo && (!q || p.nome.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q))).slice(0, q ? 20 : 8);
  }, [db.produtos, busca]);

  const precoNum = (i: Item) => {
    const n = lerNumero(i.preco);
    return Number.isNaN(n) ? (porId(db.produtos, i.produtoId)?.precoVenda ?? 0) : n;
  };
  const { bruto, total } = totalDaVenda(db, { itens: itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade, preco: precoNum(i) })), desconto: lerNumero(desconto) || 0 });
  const tutor = porId(db.tutores, tutorId);
  const clientes = buscaCliente.trim().length >= 2 ? db.tutores.filter((t) => t.nome.toLowerCase().includes(buscaCliente.trim().toLowerCase()) || t.whatsapp.includes(buscaCliente.replace(/\D/g, "") || "#")).slice(0, 5) : [];

  function adicionar(produtoId: string) {
    const p = porId(db.produtos, produtoId)!;
    const atual = itens.find((i) => i.produtoId === produtoId);
    if ((atual?.quantidade ?? 0) + 1 > p.estoque) return toast(`Só tem ${p.estoque} ${p.unidade} de ${p.nome} no estoque.`, "erro");
    setItens(atual ? itens.map((i) => (i.produtoId === produtoId ? { ...i, quantidade: i.quantidade + 1 } : i)) : [...itens, { produtoId, quantidade: 1, preco: String(p.precoVenda).replace(".", ",") }]);
    setBusca("");
  }

  function mudarQtd(produtoId: string, delta: number) {
    setItens(itens.flatMap((i) => (i.produtoId !== produtoId ? [i] : i.quantidade + delta <= 0 ? [] : [{ ...i, quantidade: i.quantidade + delta }])));
  }

  return (
    <Folha aberta={aberta} onFechar={onFechar} titulo={atd ? `Produtos para ${porId(db.pets, atd.petId)?.nome ?? "o pet"}` : "Vender produtos"}>
      {db.produtos.filter((p) => p.ativo).length === 0 ? (
        <div className="pb-4 text-center">
          <PackageSearch className="mx-auto h-8 w-8 text-brand-600" />
          <p className="mt-2 font-semibold">Nenhum produto cadastrado</p>
          <p className="mt-1 text-[14px] text-muted">Cadastre em Produtos e estoque.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-subtle" />
              <input className="input bg-surface pl-11" placeholder="Buscar produto" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <ul className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
              {produtos.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => adicionar(p.id)}
                    disabled={p.estoque <= 0}
                    className="tap w-[132px] shrink-0 rounded-2xl border border-line px-3 py-2.5 text-left disabled:opacity-45"
                  >
                    <span className="line-clamp-2 block min-h-[36px] text-[13px] font-medium leading-tight">{p.nome}</span>
                    <span className="mt-1 block text-[14px] font-semibold text-brand-700">{moeda(p.precoVenda)}</span>
                    <span className={cx("block text-[11.5px]", p.estoque <= p.estoqueMinimo ? "text-warn-700" : "text-muted")}>
                      {p.estoque <= 0 ? "Sem estoque" : `${p.estoque} ${p.unidade} em estoque`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {itens.length > 0 && (
            <ul className="divide-y divide-line rounded-2xl border border-line">
              {itens.map((i) => {
                const p = porId(db.produtos, i.produtoId)!;
                return (
                  <li key={i.produtoId} className="flex items-center gap-2 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium">{p.nome}</p>
                      <div className="mt-1 flex items-center gap-1.5 text-[12.5px] text-muted">
                        R$
                        <input
                          aria-label={`Preço de ${p.nome}`}
                          className="w-16 rounded-lg border border-line px-1.5 py-0.5 text-[13px] text-ink"
                          inputMode="decimal"
                          value={i.preco}
                          onChange={(e) => setItens(itens.map((x) => (x.produtoId === i.produtoId ? { ...x, preco: e.target.value } : x)))}
                        />
                        cada
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" aria-label="Menos" onClick={() => mudarQtd(i.produtoId, -1)} className="tap grid h-8 w-8 place-items-center rounded-full bg-surface">
                        {i.quantidade === 1 ? <X className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                      </button>
                      <span className="w-6 text-center text-[15px] font-semibold tabular-nums">{i.quantidade}</span>
                      <button type="button" aria-label="Mais" onClick={() => adicionar(i.produtoId)} className="tap grid h-8 w-8 place-items-center rounded-full bg-surface">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <span className="w-[72px] text-right text-[14px] font-semibold tabular-nums">{moeda(precoNum(i) * i.quantidade)}</span>
                  </li>
                );
              })}
            </ul>
          )}

          {itens.length > 0 && (
            <>
              <Campo rotulo="Desconto (R$)">
                <input className="input" inputMode="decimal" value={desconto} onChange={(e) => setDesconto(e.target.value)} placeholder="0,00" />
              </Campo>

              {!atd && (
                <div>
                  <span className="label">Cliente (opcional)</span>
                  {tutor ? (
                    <div className="flex items-center justify-between rounded-2xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-[14.5px] font-medium">
                      {tutor.nome}
                      <button type="button" onClick={() => setTutorId(undefined)} className="text-[13.5px] text-brand-600">
                        Trocar
                      </button>
                    </div>
                  ) : (
                    <>
                      <input className="input" placeholder="Nome ou WhatsApp" value={buscaCliente} onChange={(e) => setBuscaCliente(e.target.value)} />
                      {clientes.length > 0 && (
                        <ul className="mt-2 divide-y divide-line rounded-2xl border border-line">
                          {clientes.map((t) => (
                            <li key={t.id}>
                              <button type="button" onClick={() => setTutorId(t.id)} className="tap w-full px-4 py-2.5 text-left text-[14px]">
                                {t.nome}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              )}

              <div>
                <span className="label">Pagamento</span>
                {forma !== "depois" && <SeletorForma valor={forma} onChange={setForma} />}
                <button
                  type="button"
                  onClick={() => setForma(forma === "depois" ? "pix" : "depois")}
                  className={cx("tap mt-2 w-full rounded-2xl border px-4 py-3 text-left text-[14px] font-medium", forma === "depois" ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line text-muted")}
                >
                  {forma === "depois" ? "✓ " : ""}
                  {atd ? "Cobrar junto com o atendimento (fica a receber)" : "Receber depois (fica a receber no nome do cliente)"}
                </button>
              </div>

              <div className="flex items-baseline justify-between rounded-2xl bg-surface px-4 py-3">
                <span className="text-[14px] text-muted">{bruto !== total ? `${moeda(bruto)} − desconto` : "Total"}</span>
                <span className="text-[24px] font-bold tracking-tight text-brand-700">{moeda(total)}</span>
              </div>

              <Botao
                icone={<ShoppingBag className="h-5 w-5" />}
                onClick={() => {
                  if (itens.some((i) => Number.isNaN(lerNumero(i.preco)))) return toast("Confira os preços.", "erro");
                  const r = registrar({
                    itens: itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade, preco: precoNum(i) })),
                    desconto: lerNumero(desconto) || 0,
                    tutorId: atd ? undefined : tutorId,
                    atendimentoId: atd?.id,
                    formaPagamento: forma === "depois" ? undefined : forma,
                  });
                  if (!r.ok) return toast(r.erro, "erro");
                  toast(forma === "depois" ? `Venda registrada · ${moeda(total)} a receber` : `Venda de ${moeda(total)} no caixa de hoje`);
                  onFechar();
                }}
              >
                Registrar venda
              </Botao>
            </>
          )}
        </div>
      )}
    </Folha>
  );
}
