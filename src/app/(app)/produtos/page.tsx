"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDownToLine, PackageOpen, PackagePlus, Plus, Search, ShoppingBag, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { useApp, useDb } from "@/data/store";
import type { FormaPagamento, Produto, Venda } from "@/domain/types";
import { CATEGORIAS_PRODUTO, NOME_MOVIMENTO, UNIDADES, margem, movimentosDoProduto, produtoEmBranco, produtosAbaixoDoMinimo } from "@/domain/produtos";
import { porId } from "@/domain/rules";
import { NOME_FORMA, dataCurta, dataDoIso, hoje, horaDoIso, lerNumero, moeda } from "@/domain/format";
import { Aviso, Botao, Campo, Chip, Filtros, Folha, Segmentado, TituloVoltar, Vazio, cx } from "@/components/ui";
import { SeletorForma } from "@/components/pagamento-folha";
import { VendaFolha } from "@/components/venda-folha";
import { useToast } from "@/components/providers";

export default function ProdutosPagina() {
  return (
    <Suspense>
      <Produtos />
    </Suspense>
  );
}

const qtd = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

function Produtos() {
  const db = useDb();
  const params = useSearchParams();
  const [aba, setAba] = useState<"produtos" | "vendas">(params.get("aba") === "vendas" ? "vendas" : "produtos");
  const [vendendo, setVendendo] = useState(params.get("vender") === "1");
  const [aberto, setAberto] = useState<Produto | null>(null);
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const baixos = produtosAbaixoDoMinimo(db);
  const categorias = [...new Set(db.produtos.map((p) => p.categoria))].sort();
  const T = hoje();
  const vendasHoje = db.vendas.filter((v) => v.status !== "cancelada" && dataDoIso(v.criadoEm) === T);

  const lista = db.produtos
    .filter((p) => (categoria === "todas" ? true : categoria === "baixo" ? baixos.includes(p) : p.categoria === categoria))
    .filter((p) => !busca.trim() || p.nome.toLowerCase().includes(busca.trim().toLowerCase()))
    .sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome, "pt-BR"));

  return (
    <div>
      <TituloVoltar
        voltarPara="/mais"
        acao={
          <button onClick={() => setAberto(produtoEmBranco())} className="tap flex items-center gap-1.5 rounded-full px-3 py-2 text-[15px] font-medium text-brand-600">
            <Plus className="h-[18px] w-[18px]" />
            Novo
          </button>
        }
      >
        Produtos e estoque
      </TituloVoltar>

      <div className="mx-5 mt-1 grid grid-cols-3 divide-x divide-brand-200/70 rounded-[20px] bg-surface py-4 text-center">
        <div>
          <p className="text-[20px] font-bold">{db.produtos.filter((p) => p.ativo).length}</p>
          <p className="text-[12px] text-muted">Produtos</p>
        </div>
        <div>
          <p className={cx("text-[20px] font-bold", baixos.length > 0 && "text-warn-700")}>{baixos.length}</p>
          <p className="text-[12px] text-muted">Estoque baixo</p>
        </div>
        <div>
          <p className="text-[20px] font-bold">{moeda(vendasHoje.reduce((s, v) => s + v.total, 0)).replace(",00", "")}</p>
          <p className="text-[12px] text-muted">Vendido hoje</p>
        </div>
      </div>

      <div className="px-5 pt-4">
        <Botao icone={<ShoppingBag className="h-5 w-5" />} onClick={() => setVendendo(true)}>
          Vender no balcão
        </Botao>
      </div>

      {baixos.length > 0 && (
        <button onClick={() => { setAba("produtos"); setCategoria("baixo"); }} className="mx-5 mt-4 block w-[calc(100%-40px)] text-left">
          <Aviso
            icone={<TriangleAlert className="h-5 w-5" />}
            titulo={`${baixos.length} ${baixos.length === 1 ? "produto acabando" : "produtos acabando"}`}
            texto={baixos.slice(0, 3).map((p) => `${p.nome} (${qtd(p.estoque)} ${p.unidade})`).join(" · ")}
          />
        </button>
      )}

      <Segmentado
        className="mx-5 mt-5"
        valor={aba}
        onChange={setAba}
        opcoes={[
          { valor: "produtos", rotulo: "Produtos" },
          { valor: "vendas", rotulo: "Vendas" },
        ]}
      />

      {aba === "produtos" ? (
        <>
          <div className="px-5 pt-4">
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-subtle" />
              <input className="input bg-surface pl-11" placeholder="Buscar produto" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <Filtros
              valor={categoria}
              onChange={setCategoria}
              opcoes={[
                { valor: "todas", rotulo: "Todos", contagem: db.produtos.length },
                ...(baixos.length ? [{ valor: "baixo", rotulo: "Estoque baixo", contagem: baixos.length }] : []),
                ...categorias.map((c) => ({ valor: c, rotulo: c })),
              ]}
            />
          </div>
          {lista.length === 0 ? (
            <Vazio
              icone={<PackageOpen className="h-6 w-6" />}
              titulo={db.produtos.length === 0 ? "Nenhum produto ainda" : "Nada encontrado"}
              texto={db.produtos.length === 0 ? "Cadastre shampoos, petiscos e acessórios que você vende no balcão." : undefined}
              acao={db.produtos.length === 0 ? <Botao onClick={() => setAberto(produtoEmBranco())}>Cadastrar produto</Botao> : undefined}
            />
          ) : (
            <ul className="mt-4 divide-y divide-line px-5">
              {lista.map((p) => {
                const baixo = p.ativo && p.estoqueMinimo > 0 && p.estoque <= p.estoqueMinimo;
                const mg = margem(p);
                return (
                  <li key={p.id}>
                    <button onClick={() => setAberto(p)} className={cx("tap flex w-full items-center gap-3 py-3 text-left", !p.ativo && "opacity-55")}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium">{p.nome}</p>
                        <p className="truncate text-[12.5px] text-muted">
                          {p.categoria}
                          {mg !== undefined && ` · margem ${mg}%`}
                          {!p.ativo && " · desativado"}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[15px] font-semibold">{moeda(p.precoVenda)}</span>
                        <Chip tom={p.estoque <= 0 ? "bad" : baixo ? "warn" : "neutral"}>
                          {qtd(p.estoque)} {p.unidade}
                        </Chip>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : (
        <ListaVendas />
      )}

      <VendaFolha aberta={vendendo} onFechar={() => setVendendo(false)} />
      {aberto && <ProdutoFolha produto={aberto} onFechar={() => setAberto(null)} />}
    </div>
  );
}

function ListaVendas() {
  const db = useDb();
  const [aberta, setAberta] = useState<Venda | null>(null);
  const vendas = [...db.vendas].sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1)).slice(0, 100);
  if (vendas.length === 0) return <Vazio icone={<ShoppingBag className="h-6 w-6" />} titulo="Nenhuma venda ainda" />;
  return (
    <>
      <ul className="mt-4 divide-y divide-line px-5">
        {vendas.map((v) => {
          const tutor = porId(db.tutores, v.tutorId);
          const lanc = porId(db.lancamentos, v.lancamentoId);
          const aReceber = v.status !== "cancelada" && lanc?.status === "pendente";
          return (
            <li key={v.id}>
              <button onClick={() => setAberta(v)} className={cx("tap flex w-full items-center gap-3 py-3 text-left", v.status === "cancelada" && "opacity-55")}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-medium">{v.itens.map((i) => (i.quantidade === 1 ? i.nome : `${qtd(i.quantidade)}× ${i.nome}`)).join(", ")}</p>
                  <p className="truncate text-[12.5px] text-muted">
                    {dataCurta(dataDoIso(v.criadoEm)).slice(0, 5)} {horaDoIso(v.criadoEm)}
                    {tutor && ` · ${tutor.nome}`}
                    {v.formaPagamento && ` · ${NOME_FORMA[v.formaPagamento]}`}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[15px] font-semibold">{moeda(v.total)}</span>
                  {v.status === "cancelada" ? <Chip tom="neutral">Cancelada</Chip> : aReceber ? <Chip tom="warn">A receber</Chip> : null}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      {aberta && <VendaDetalhe venda={aberta} onFechar={() => setAberta(null)} />}
    </>
  );
}

function VendaDetalhe({ venda, onFechar }: { venda: Venda; onFechar: () => void }) {
  const db = useDb();
  const cancelar = useApp((s) => s.cancelarVenda);
  const toast = useToast();
  const [confirmar, setConfirmar] = useState(false);
  const v = porId(db.vendas, venda.id) ?? venda;
  const lanc = porId(db.lancamentos, v.lancamentoId);
  return (
    <Folha aberta onFechar={onFechar} titulo="Venda">
      <ul className="divide-y divide-line rounded-2xl border border-line">
        {v.itens.map((i, k) => (
          <li key={k} className="flex justify-between gap-3 px-4 py-2.5 text-[14.5px]">
            <span>
              {qtd(i.quantidade)}× {i.nome}
            </span>
            <span className="tabular-nums">{moeda(i.preco * i.quantidade)}</span>
          </li>
        ))}
        {v.desconto > 0 && (
          <li className="flex justify-between px-4 py-2.5 text-[14px] text-muted">
            <span>Desconto</span>
            <span>− {moeda(v.desconto)}</span>
          </li>
        )}
        <li className="flex justify-between px-4 py-3 font-semibold">
          <span>Total</span>
          <span>{moeda(v.total)}</span>
        </li>
      </ul>
      <p className="mt-3 text-[13px] text-muted">
        {dataCurta(dataDoIso(v.criadoEm))} às {horaDoIso(v.criadoEm)}
        {porId(db.membros, v.porMembroId) && ` · por ${porId(db.membros, v.porMembroId)!.nome.split(" ")[0]}`}
        {porId(db.tutores, v.tutorId) && ` · cliente ${porId(db.tutores, v.tutorId)!.nome}`}
        {v.status === "cancelada" ? " · cancelada" : lanc?.status === "pendente" ? " · a receber" : v.formaPagamento ? ` · ${NOME_FORMA[v.formaPagamento]}` : ""}
      </p>
      {v.status !== "cancelada" &&
        (confirmar ? (
          <div className="mt-5 rounded-2xl bg-bad-50 px-4 py-4">
            <p className="text-[14px] font-semibold text-bad-700">Cancelar esta venda?</p>
            <p className="mt-0.5 text-[13px] text-muted">
              Os produtos voltam ao estoque. {lanc?.status === "pago" ? `O valor de ${moeda(lanc.valor)} sai do caixa de hoje como devolução.` : "O valor a receber deixa de existir."}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Botao variante="contorno" className="!h-11" onClick={() => setConfirmar(false)}>
                Voltar
              </Botao>
              <Botao
                variante="perigo"
                className="!h-11"
                onClick={() => {
                  const r = cancelar(v.id);
                  if (!r.ok) return toast(r.erro, "erro");
                  toast("Venda cancelada · estoque devolvido");
                  onFechar();
                }}
              >
                Cancelar venda
              </Botao>
            </div>
          </div>
        ) : (
          <Botao variante="perigo" className="mt-5" onClick={() => setConfirmar(true)}>
            Cancelar venda
          </Botao>
        ))}
    </Folha>
  );
}

function ProdutoFolha({ produto, onFechar }: { produto: Produto; onFechar: () => void }) {
  const db = useDb();
  const salvar = useApp((s) => s.salvarProduto);
  const toast = useToast();
  const existente = porId(db.produtos, produto.id);
  const p = existente ?? produto;
  const novo = !existente;
  const [modo, setModo] = useState<"dados" | "entrada" | "ajuste">("dados");
  const [nome, setNome] = useState(p.nome);
  const [categoria, setCategoria] = useState(p.categoria);
  const [preco, setPreco] = useState(p.precoVenda ? qtd(p.precoVenda) : "");
  const [custo, setCusto] = useState(p.custo !== undefined ? qtd(p.custo) : "");
  const [minimo, setMinimo] = useState(p.estoqueMinimo ? qtd(p.estoqueMinimo) : "");
  const [unidade, setUnidade] = useState(p.unidade);
  const [ativo, setAtivo] = useState(p.ativo);
  const [inicial, setInicial] = useState("");
  const movimentos = useMemo(() => movimentosDoProduto(db, p.id).slice(0, 15), [db, p.id]);

  return (
    <Folha aberta onFechar={onFechar} titulo={novo ? "Novo produto" : p.nome}>
      {!novo && (
        <>
          <div className="mb-4 flex items-center justify-between rounded-2xl bg-surface px-4 py-3">
            <div>
              <p className="text-[13px] text-muted">Em estoque</p>
              <p className="text-[26px] font-bold tracking-tight text-brand-700">
                {qtd(p.estoque)} <span className="text-[15px] font-semibold">{p.unidade}</span>
              </p>
            </div>
            {p.custo !== undefined && <p className="text-right text-[12.5px] text-muted">Custo {moeda(p.custo)}<br />Valor em estoque {moeda(Math.max(0, p.estoque) * p.custo)}</p>}
          </div>
          <Segmentado
            className="mb-4"
            valor={modo}
            onChange={setModo}
            opcoes={[
              { valor: "dados", rotulo: "Dados" },
              { valor: "entrada", rotulo: "Entrada" },
              { valor: "ajuste", rotulo: "Contagem" },
            ]}
          />
        </>
      )}

      {modo === "entrada" && <EntradaForm produto={p} onFeito={onFechar} />}
      {modo === "ajuste" && <AjusteForm produto={p} onFeito={onFechar} />}
      {modo === "dados" && (
        <div className="space-y-4">
          <Campo rotulo="Nome">
            <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Shampoo neutro 500 ml" />
          </Campo>
          <div>
            <span className="label">Categoria</span>
            <div className="flex flex-wrap gap-1.5">
              {[...new Set([...CATEGORIAS_PRODUTO, categoria])].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategoria(c)}
                  className={cx("tap rounded-full border px-3 py-1.5 text-[13px] font-medium", c === categoria ? "border-brand-600 bg-brand-600 text-white" : "border-line text-muted")}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Preço de venda (R$)">
              <input className="input" inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} placeholder="0,00" />
            </Campo>
            <Campo rotulo="Custo (R$) · opcional">
              <input className="input" inputMode="decimal" value={custo} onChange={(e) => setCusto(e.target.value)} placeholder="0,00" />
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Avisar quando tiver só">
              <input className="input" inputMode="decimal" value={minimo} onChange={(e) => setMinimo(e.target.value)} placeholder="0" />
            </Campo>
            <Campo rotulo="Unidade">
              <select className="input" value={unidade} onChange={(e) => setUnidade(e.target.value)}>
                {[...new Set([...UNIDADES, unidade])].map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </Campo>
          </div>
          {novo ? (
            <Campo rotulo="Quantidade em estoque agora">
              <input className="input" inputMode="decimal" value={inicial} onChange={(e) => setInicial(e.target.value)} placeholder="0" />
            </Campo>
          ) : (
            <label className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 text-[14.5px]">
              <span>
                À venda
                <span className="block text-[12.5px] text-muted">Desativado não aparece para vender.</span>
              </span>
              <input type="checkbox" className="h-6 w-6 accent-brand-600" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
            </label>
          )}
          <Botao
            onClick={() => {
              const v = lerNumero(preco);
              const c = custo.trim() ? lerNumero(custo) : undefined;
              const m = minimo.trim() ? lerNumero(minimo) : 0;
              const ini = inicial.trim() ? lerNumero(inicial) : 0;
              if ([v, m, ini].some(Number.isNaN) || (c !== undefined && Number.isNaN(c))) return toast("Use só números nos valores.", "erro");
              const r = salvar({ ...p, nome, categoria, precoVenda: v, custo: c, estoqueMinimo: m, unidade, ativo }, ini);
              if (!r.ok) return toast(r.erro, "erro");
              toast(novo ? "Produto cadastrado" : "Produto atualizado");
              onFechar();
            }}
          >
            {novo ? "Cadastrar produto" : "Salvar"}
          </Botao>
          {!novo && movimentos.length > 0 && (
            <div>
              <h3 className="mb-2 mt-2 text-[14px] font-semibold">Movimentações</h3>
              <ul className="divide-y divide-line rounded-2xl border border-line">
                {movimentos.map((mv) => (
                  <li key={mv.id} className="flex items-center gap-3 px-3.5 py-2.5 text-[13.5px]">
                    <span className="w-[82px] shrink-0 text-muted">{dataCurta(dataDoIso(mv.em)).slice(0, 5)} {horaDoIso(mv.em)}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {NOME_MOVIMENTO[mv.tipo]}
                      {mv.observacao && <span className="text-muted"> · {mv.observacao}</span>}
                    </span>
                    <span className={cx("font-semibold tabular-nums", mv.quantidade > 0 ? "text-ok-700" : "text-bad-700")}>
                      {mv.quantidade > 0 ? "+" : ""}
                      {qtd(mv.quantidade)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Folha>
  );
}

function EntradaForm({ produto, onFeito }: { produto: Produto; onFeito: () => void }) {
  const entrada = useApp((s) => s.entradaEstoque);
  const toast = useToast();
  const [quantidade, setQuantidade] = useState("");
  const [custo, setCusto] = useState(produto.custo !== undefined ? qtd(produto.custo) : "");
  const [lancar, setLancar] = useState(true);
  const [forma, setForma] = useState<FormaPagamento>("pix");
  const [obs, setObs] = useState("");
  const q = lerNumero(quantidade);
  const c = lerNumero(custo);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo={`Chegou (${produto.unidade})`}>
          <input className="input" inputMode="decimal" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} placeholder="0" />
        </Campo>
        <Campo rotulo="Custo unitário (R$)">
          <input className="input" inputMode="decimal" value={custo} onChange={(e) => setCusto(e.target.value)} placeholder="0,00" />
        </Campo>
      </div>
      <Campo rotulo="Fornecedor ou nota (opcional)">
        <input className="input" value={obs} onChange={(e) => setObs(e.target.value)} />
      </Campo>
      <label className="flex items-start gap-3 rounded-2xl bg-surface px-4 py-3 text-[14px]">
        <input type="checkbox" checked={lancar} onChange={(e) => setLancar(e.target.checked)} className="mt-0.5 h-5 w-5 accent-brand-600" />
        <span>
          Lançar a compra no caixa de hoje
          {q > 0 && c > 0 && <span className="block text-[12.5px] text-muted">Despesa de {moeda(q * c)}</span>}
        </span>
      </label>
      {lancar && <SeletorForma valor={forma} onChange={setForma} />}
      <Botao
        icone={<ArrowDownToLine className="h-5 w-5" />}
        onClick={() => {
          const r = entrada({ produtoId: produto.id, quantidade: q, custoUnitario: custo.trim() ? c : undefined, observacao: obs, despesaForma: lancar ? forma : undefined });
          if (!r.ok) return toast(r.erro, "erro");
          toast(`Entrada de ${qtd(q)} ${produto.unidade} registrada`);
          onFeito();
        }}
      >
        Registrar entrada
      </Botao>
    </div>
  );
}

function AjusteForm({ produto, onFeito }: { produto: Produto; onFeito: () => void }) {
  const ajustar = useApp((s) => s.ajustarEstoque);
  const toast = useToast();
  const [saldo, setSaldo] = useState("");
  const [obs, setObs] = useState("");
  useEffect(() => setSaldo(qtd(produto.estoque)), [produto.estoque]);
  const novo = lerNumero(saldo);
  const dif = Number.isNaN(novo) ? 0 : Math.round((novo - produto.estoque) * 100) / 100;
  return (
    <div className="space-y-4">
      <p className="text-[14px] text-muted">Contou a prateleira? Informe o que tem de verdade; o app registra a diferença (perda, quebra, uso no banho).</p>
      <Campo rotulo={`Quantidade contada (${produto.unidade})`}>
        <input className="input text-[17px] font-semibold" inputMode="decimal" value={saldo} onChange={(e) => setSaldo(e.target.value)} />
      </Campo>
      {dif !== 0 && (
        <p className={cx("text-[13.5px] font-medium", dif > 0 ? "text-ok-700" : "text-bad-700")}>
          Diferença: {dif > 0 ? "+" : ""}
          {qtd(dif)} {produto.unidade}
        </p>
      )}
      <Campo rotulo="Motivo (opcional)">
        <input className="input" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: usado no banho, vencido" />
      </Campo>
      <Botao
        icone={<SlidersHorizontal className="h-5 w-5" />}
        onClick={() => {
          const r = ajustar({ produtoId: produto.id, saldoReal: novo, observacao: obs });
          if (!r.ok) return toast(r.erro, "erro");
          toast("Estoque ajustado");
          onFeito();
        }}
      >
        Ajustar estoque
      </Botao>
      <p className="flex items-center gap-1.5 text-[12.5px] text-subtle">
        <PackagePlus className="h-3.5 w-3.5" />
        Mercadoria nova entra pela aba Entrada.
      </p>
    </div>
  );
}
