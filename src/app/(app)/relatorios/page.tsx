"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, CalendarRange, Download, FileSpreadsheet } from "lucide-react";
import { useDb, usePapel } from "@/data/store";
import { csvAtendimentos, csvLancamentos, periodoAnterior, periodoDoMes, relatorio, variacao, type Periodo } from "@/domain/relatorios";
import { pode } from "@/domain/permissoes";
import { NOME_FORMA, dataCurta, diaCurto, hoje, moeda, moedaCurta, somaDias } from "@/domain/format";
import { Botao, Campo, Filtros, Folha, Secao, TituloVoltar, cx } from "@/components/ui";

type Atalho = "hoje" | "7d" | "mes" | "mes_passado" | "30d" | "outro";

function periodoDe(a: Atalho, T: string, outro: Periodo): Periodo {
  switch (a) {
    case "hoje":
      return { de: T, ate: T };
    case "7d":
      return { de: somaDias(T, -6), ate: T };
    case "30d":
      return { de: somaDias(T, -29), ate: T };
    case "mes":
      return { de: periodoDoMes(T).de, ate: T };
    case "mes_passado":
      return periodoDoMes(T, -1);
    case "outro":
      return outro;
  }
}

export default function Relatorios() {
  const db = useDb();
  const papel = usePapel();
  const T = hoje();
  const [atalho, setAtalho] = useState<Atalho>("mes");
  const [outro, setOutro] = useState<Periodo>({ de: somaDias(T, -29), ate: T });
  const [escolhendo, setEscolhendo] = useState(false);
  const [exportar, setExportar] = useState(false);
  const p = periodoDe(atalho, T, outro);
  const r = useMemo(() => relatorio(db, p), [db, p.de, p.ate]); // eslint-disable-line react-hooks/exhaustive-deps
  const ant = useMemo(() => relatorio(db, periodoAnterior(p)), [db, p.de, p.ate]); // eslint-disable-line react-hooks/exhaustive-deps
  const verComissao = pode(papel, "comissoes");
  const maxDia = Math.max(1, ...r.porDia.map((d) => d.valor));
  const umDia = p.de === p.ate;

  return (
    <div>
      <TituloVoltar
        voltarPara="/mais"
        acao={
          <button onClick={() => setExportar(true)} className="tap flex items-center gap-1.5 rounded-full px-3 py-2 text-[15px] font-medium text-brand-600">
            <Download className="h-[18px] w-[18px]" />
            Exportar
          </button>
        }
      >
        Relatórios
      </TituloVoltar>

      <div className="px-5">
        <Filtros
          valor={atalho}
          onChange={(v) => (v === "outro" ? setEscolhendo(true) : setAtalho(v))}
          opcoes={[
            { valor: "hoje", rotulo: "Hoje" },
            { valor: "7d", rotulo: "7 dias" },
            { valor: "mes", rotulo: "Este mês" },
            { valor: "mes_passado", rotulo: "Mês passado" },
            { valor: "30d", rotulo: "30 dias" },
            { valor: "outro", rotulo: atalho === "outro" ? `${dataCurta(outro.de).slice(0, 5)} a ${dataCurta(outro.ate).slice(0, 5)}` : "Escolher datas" },
          ]}
        />
        <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-muted">
          <CalendarRange className="h-3.5 w-3.5" />
          {umDia ? dataCurta(p.de) : `${dataCurta(p.de)} a ${dataCurta(p.ate)}`} · comparado com o período anterior
        </p>
      </div>

      <div className="mx-5 mt-4 grid grid-cols-2 gap-3">
        <Kpi rotulo="Entrou no caixa" valor={moedaCurta(r.recebido)} delta={variacao(r.recebido, ant.recebido)} destaque />
        <Kpi rotulo="Saiu do caixa" valor={moedaCurta(r.gasto)} delta={variacao(r.gasto, ant.gasto)} inverso />
        <Kpi rotulo="Saldo do período" valor={moedaCurta(r.saldo)} tom={r.saldo < 0 ? "bad" : undefined} />
        <Kpi rotulo="A receber (hoje)" valor={moedaCurta(r.aReceber)} href="/financeiro#a-receber" />
        <Kpi rotulo="Atendimentos" valor={String(r.atendimentos)} delta={variacao(r.atendimentos, ant.atendimentos)} />
        <Kpi rotulo="Ticket médio" valor={moedaCurta(r.ticketMedio)} delta={variacao(r.ticketMedio, ant.ticketMedio)} />
      </div>

      {!umDia && r.porDia.length <= 62 && (
        <Secao className="mt-6" titulo="Entradas por dia">
          <div className="flex h-36 items-end gap-[3px] rounded-2xl bg-surface px-3 pb-2 pt-3" role="img" aria-label="Gráfico das entradas por dia">
            {r.porDia.map((d) => (
              <div key={d.data} className="group relative flex h-full flex-1 flex-col justify-end" title={`${dataCurta(d.data)}: ${moeda(d.valor)} · ${d.atendimentos} atendimentos`}>
                <div className={cx("w-full rounded-t-[4px]", d.data === T ? "bg-brand-600" : "bg-brand-400/70")} style={{ height: `${Math.max(d.valor > 0 ? 4 : 1, (d.valor / maxDia) * 100)}%` }} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between px-1 text-[11px] text-subtle">
            <span>{dataCurta(p.de).slice(0, 5)}</span>
            {r.porDia.length <= 8 ? r.porDia.slice(1, -1).map((d) => <span key={d.data}>{diaCurto(d.data)}</span>) : null}
            <span>{dataCurta(p.ate).slice(0, 5)}</span>
          </div>
        </Secao>
      )}

      <Secao className="mt-6" titulo="De onde veio o dinheiro">
        <Barras itens={r.porCategoriaReceita.map((c) => ({ nome: c.nome, valor: c.valor }))} vazio="Nenhuma entrada no período." />
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Mini rotulo="Serviços feitos" valor={moedaCurta(r.faturamentoServicos)} />
          <Mini rotulo="Planos vendidos" valor={moedaCurta(r.vendasPlanos)} />
          <Mini rotulo="Produtos" valor={moedaCurta(r.vendasProdutos)} />
        </div>
      </Secao>

      {r.porForma.length > 0 && (
        <Secao className="mt-6" titulo="Formas de pagamento">
          <Barras itens={r.porForma.map((f) => ({ nome: NOME_FORMA[f.forma], valor: f.valor }))} />
        </Secao>
      )}

      {r.porCategoriaDespesa.length > 0 && (
        <Secao className="mt-6" titulo="Para onde foi">
          <Barras itens={r.porCategoriaDespesa.map((c) => ({ nome: c.nome, valor: c.valor }))} tom="bad" />
        </Secao>
      )}

      <Secao className="mt-6" titulo="Serviços mais feitos">
        {r.servicos.length === 0 ? (
          <p className="text-[14px] text-muted">Nenhum atendimento finalizado no período.</p>
        ) : (
          <Tabela
            cab={["Serviço", "Qtd.", "Valor"]}
            linhas={r.servicos.slice(0, 10).map((s) => [
              <span key="n">
                {s.nome}
                {s.porPlano > 0 && <span className="block text-[11.5px] text-muted">{s.porPlano} pelo plano</span>}
              </span>,
              s.quantidade,
              moedaCurta(s.valor),
            ])}
          />
        )}
      </Secao>

      <Secao className="mt-6" titulo="Clientes que mais gastaram">
        {r.clientes.length === 0 ? (
          <p className="text-[14px] text-muted">Sem movimento no período.</p>
        ) : (
          <Tabela
            cab={["Cliente", "Visitas", "Gastou"]}
            linhas={r.clientes.slice(0, 10).map((c) => [
              <Link key="n" href={`/clientes/${c.tutorId}`} className="font-medium text-brand-700">
                {c.nome}
              </Link>,
              c.atendimentos,
              moedaCurta(c.valor),
            ])}
          />
        )}
      </Secao>

      <Secao className="mt-6" titulo="Equipe">
        {r.equipe.length === 0 ? (
          <p className="text-[14px] text-muted">Nenhum atendimento finalizado no período.</p>
        ) : (
          <Tabela
            cab={verComissao ? ["Pessoa", "Atend.", "Valor", "Comissão"] : ["Pessoa", "Atend.", "Valor"]}
            linhas={r.equipe.map((m) => [m.nome.split(" ")[0], m.atendimentos, moedaCurta(m.valor), ...(verComissao ? [moedaCurta(m.comissao)] : [])])}
          />
        )}
      </Secao>

      {r.produtos.length > 0 && (
        <Secao className="mt-6" titulo="Produtos mais vendidos">
          <Tabela
            cab={["Produto", "Qtd.", "Valor", "Lucro"]}
            linhas={r.produtos.slice(0, 10).map((x) => [x.nome, String(x.quantidade).replace(".", ","), moedaCurta(x.valor), x.lucro === undefined ? "—" : moedaCurta(x.lucro)])}
          />
        </Secao>
      )}

      <Secao className="mt-6" titulo="Agenda e clientes">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Mini rotulo="Clientes atendidos" valor={String(r.clientesAtendidos)} />
          <Mini rotulo="Clientes novos" valor={String(r.clientesNovos)} />
          <Mini rotulo="Pedidos online" valor={String(r.online)} />
          <Mini rotulo="Faltas" valor={String(r.faltas)} tom={r.faltas > 0 ? "warn" : undefined} />
          <Mini rotulo="Cancelamentos" valor={String(r.cancelamentos)} />
          <Mini rotulo="Taxa de faltas" valor={`${r.atendimentos + r.faltas > 0 ? Math.round((r.faltas / (r.atendimentos + r.faltas)) * 100) : 0}%`} />
        </div>
      </Secao>

      <Folha aberta={escolhendo} onFechar={() => setEscolhendo(false)} titulo="Escolher datas">
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="De">
            <input className="input" type="date" value={outro.de} max={outro.ate} onChange={(e) => e.target.value && setOutro({ ...outro, de: e.target.value })} />
          </Campo>
          <Campo rotulo="Até">
            <input className="input" type="date" value={outro.ate} min={outro.de} onChange={(e) => e.target.value && setOutro({ ...outro, ate: e.target.value })} />
          </Campo>
        </div>
        <Botao
          className="mt-5"
          onClick={() => {
            setAtalho("outro");
            setEscolhendo(false);
          }}
        >
          Ver relatório
        </Botao>
      </Folha>

      <Folha aberta={exportar} onFechar={() => setExportar(false)} titulo="Exportar para planilha">
        <p className="text-[14px] text-muted">Arquivos CSV que abrem no Excel e no Google Planilhas, do período {umDia ? dataCurta(p.de) : `${dataCurta(p.de)} a ${dataCurta(p.ate)}`}.</p>
        <div className="mt-4 space-y-3 pb-2">
          <Botao variante="contorno" icone={<FileSpreadsheet className="h-5 w-5" />} onClick={() => baixar(`lancamentos-${p.de}-a-${p.ate}.csv`, csvLancamentos(db, p))}>
            Entradas e saídas do caixa
          </Botao>
          <Botao variante="contorno" icone={<FileSpreadsheet className="h-5 w-5" />} onClick={() => baixar(`atendimentos-${p.de}-a-${p.ate}.csv`, csvAtendimentos(db, p))}>
            Atendimentos
          </Botao>
        </div>
      </Folha>
    </div>
  );
}

function baixar(nome: string, conteudo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Kpi({ rotulo, valor, delta, inverso, destaque, tom, href }: { rotulo: string; valor: string; delta?: number; inverso?: boolean; destaque?: boolean; tom?: "bad"; href?: string }) {
  const bom = delta === undefined ? undefined : inverso ? delta <= 0 : delta >= 0;
  const corpo = (
    <>
      <p className="text-[12.5px] text-muted">{rotulo}</p>
      <p className={cx("mt-0.5 text-[21px] font-bold tracking-tight", destaque && "text-brand-700", tom === "bad" && "text-bad-700")}>{valor}</p>
      {delta !== undefined && delta !== 0 && (
        <p className={cx("mt-0.5 flex items-center gap-0.5 text-[12px] font-medium", bom ? "text-ok-700" : "text-bad-700")}>
          {delta > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          {Math.abs(delta)}%
        </p>
      )}
    </>
  );
  return href ? (
    <Link href={href} className="card tap px-4 py-3">
      {corpo}
    </Link>
  ) : (
    <div className="card px-4 py-3">{corpo}</div>
  );
}

function Mini({ rotulo, valor, tom }: { rotulo: string; valor: string; tom?: "warn" }) {
  return (
    <div className="rounded-2xl bg-surface px-2 py-3">
      <p className={cx("text-[17px] font-bold", tom === "warn" && "text-warn-700")}>{valor}</p>
      <p className="text-[11.5px] leading-tight text-muted">{rotulo}</p>
    </div>
  );
}

function Barras({ itens, vazio, tom }: { itens: { nome: string; valor: number }[]; vazio?: string; tom?: "bad" }) {
  if (itens.length === 0) return <p className="text-[14px] text-muted">{vazio}</p>;
  const total = itens.reduce((s, i) => s + i.valor, 0);
  return (
    <ul className="space-y-2.5">
      {itens.map((i) => {
        const pct = total > 0 ? Math.round((i.valor / total) * 100) : 0;
        return (
          <li key={i.nome}>
            <div className="mb-1 flex justify-between text-[13.5px]">
              <span className="font-medium">{i.nome}</span>
              <span className="tabular-nums text-muted">
                {moedaCurta(i.valor)} · {pct}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface">
              <div className={cx("h-full rounded-full", tom === "bad" ? "bg-bad-500/70" : "bg-brand-500")} style={{ width: `${Math.max(2, pct)}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Tabela({ cab, linhas }: { cab: string[]; linhas: ReactNode[][] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line">
      <table className="w-full text-[13.5px]">
        <thead className="bg-surface text-[12px] text-muted">
          <tr>
            {cab.map((c, i) => (
              <th key={c} className={cx("px-3 py-2 font-medium", i === 0 ? "text-left" : "text-right")}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {linhas.map((l, k) => (
            <tr key={k}>
              {l.map((c, i) => (
                <td key={i} className={cx("px-3 py-2", i === 0 ? "text-left" : "whitespace-nowrap text-right tabular-nums")}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
