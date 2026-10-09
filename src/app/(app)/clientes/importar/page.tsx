"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Download, FileSpreadsheet, PawPrint, Upload, Users } from "lucide-react";
import { useApp, useDb } from "@/data/store";
import { CAMPOS, mapearColunas, modeloCsv, montarPrevia, type CampoImport, type Mapa } from "@/domain/importacao";
import { telefone } from "@/domain/format";
import { Aviso, Botao, Secao, TituloVoltar, cx } from "@/components/ui";
import { useToast } from "@/components/providers";

type Arquivo = { nome: string; linhas: unknown[][] };

async function lerArquivo(file: File): Promise<unknown[][]> {
  const nome = file.name.toLowerCase();
  if (nome.endsWith(".xlsx")) {
    const { default: lerXlsx } = await import("read-excel-file");
    return (await lerXlsx(file)) as unknown[][];
  }
  if (nome.endsWith(".xls")) throw new Error("Esse é o formato antigo do Excel (.xls). Abra no Excel e salve como .xlsx ou CSV.");
  // CSV: o Excel em português costuma salvar em Windows-1252 e com ";".
  const buf = await file.arrayBuffer();
  let texto = new TextDecoder("utf-8").decode(buf);
  if (texto.includes("�")) texto = new TextDecoder("windows-1252").decode(buf);
  const { default: Papa } = await import("papaparse");
  return Papa.parse<string[]>(texto.replace(/^﻿/, ""), { skipEmptyLines: "greedy" }).data;
}

function baixarModelo() {
  const blob = new Blob([modeloCsv()], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo-clientes-e-pets.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ImportarClientes() {
  const db = useDb();
  const importar = useApp((s) => s.importarClientes);
  const router = useRouter();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<Arquivo | null>(null);
  const [mapa, setMapa] = useState<Mapa | null>(null);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [consentimento, setConsentimento] = useState(true);

  const previa = useMemo(() => (arquivo && mapa ? montarPrevia(db, arquivo.linhas, mapa) : null), [db, arquivo, mapa]);
  const cabecalho = (arquivo?.linhas[0] ?? []).map((c) => String(c ?? ""));

  async function escolher(file: File | undefined) {
    if (!file) return;
    setErro(null);
    setLendo(true);
    try {
      const linhas = (await lerArquivo(file)).filter((l) => Array.isArray(l));
      if (linhas.length < 2) throw new Error("A planilha está vazia ou só tem o cabeçalho.");
      setArquivo({ nome: file.name, linhas });
      setMapa(mapearColunas(linhas[0]));
    } catch (e) {
      setArquivo(null);
      setMapa(null);
      setErro(e instanceof Error ? e.message : "Não foi possível ler o arquivo.");
    } finally {
      setLendo(false);
      if (input.current) input.current.value = "";
    }
  }

  function confirmar() {
    if (!previa) return;
    const r = importar(previa, consentimento);
    if (!r.ok) return toast(r.erro, "erro");
    toast(`${r.valor.tutores} ${r.valor.tutores === 1 ? "cliente" : "clientes"} e ${r.valor.pets} ${r.valor.pets === 1 ? "pet importado" : "pets importados"}.`);
    router.push("/clientes");
  }

  const total = (previa?.novosTutores ?? 0) + (previa?.novosPets ?? 0);

  return (
    <div>
      <TituloVoltar voltarPara="/clientes">Importar planilha</TituloVoltar>

      <div className="space-y-4 px-5">
        <div className="card px-4 py-4">
          <p className="flex items-center gap-2 text-[15.5px] font-semibold">
            <FileSpreadsheet className="h-5 w-5 text-brand-600" />
            Traga seus clientes de uma vez
          </p>
          <p className="mt-1.5 text-[14px] text-muted">
            Uma linha por pet, com o nome do tutor e o WhatsApp. Serve planilha do Excel (.xlsx) ou CSV, inclusive exportada de outro sistema. Quem já está
            cadastrado não é duplicado.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Botao variante="contorno" onClick={baixarModelo} icone={<Download className="h-4 w-4" />}>
              Baixar modelo
            </Botao>
            <Botao onClick={() => input.current?.click()} disabled={lendo} icone={<Upload className="h-4 w-4" />}>
              {lendo ? "Lendo…" : "Escolher arquivo"}
            </Botao>
          </div>
          <input ref={input} type="file" accept=".xlsx,.csv,.txt,text/csv" className="hidden" onChange={(e) => escolher(e.target.files?.[0])} />
        </div>

        {erro && <Aviso tom="bad" icone={<CircleAlert className="h-5 w-5" />} titulo={erro} />}
      </div>

      {arquivo && mapa && previa && (
        <>
          <Secao titulo="Colunas" className="mt-6">
            <p className="-mt-1 mb-3 text-[13px] text-muted">
              De <strong className="text-ink">{arquivo.nome}</strong> ({arquivo.linhas.length - 1} linhas). Confira se cada informação veio da coluna certa.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {CAMPOS.map(({ campo, rotulo, obrigatorio }) => (
                <label key={campo} className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-3.5 py-2.5 text-[14px]">
                  <span className={cx(obrigatorio && "font-semibold")}>
                    {rotulo}
                    {obrigatorio && <span className="text-bad-500"> *</span>}
                  </span>
                  <select
                    className="max-w-[55%] rounded-xl border border-line bg-white px-2.5 py-1.5 text-[13.5px]"
                    value={mapa[campo]}
                    onChange={(e) => setMapa({ ...mapa, [campo]: Number(e.target.value) } as Record<CampoImport, number>)}
                  >
                    <option value={-1}>— não tem —</option>
                    {cabecalho.map((c, i) => (
                      <option key={i} value={i}>
                        {c || `Coluna ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </Secao>

          <Secao titulo="O que vai entrar" className="mt-6">
            <div className="grid grid-cols-2 gap-3">
              <Numero icone={<Users className="h-5 w-5" />} valor={previa.novosTutores} rotulo={previa.novosTutores === 1 ? "cliente novo" : "clientes novos"} />
              <Numero icone={<PawPrint className="h-5 w-5" />} valor={previa.novosPets} rotulo={previa.novosPets === 1 ? "pet novo" : "pets novos"} />
            </div>
            <div className="mt-3 space-y-2 text-[13px] text-muted">
              {previa.petsRepetidos > 0 && <p>{previa.petsRepetidos} pet(s) já estavam cadastrados e serão ignorados.</p>}
              {previa.semPorte > 0 && <p>{previa.semPorte} pet(s) sem porte na planilha entram como porte M; dá para ajustar depois na ficha.</p>}
            </div>
            {previa.problemas.length > 0 && (
              <div className="mt-3 rounded-2xl border border-warn-100 bg-warn-50 px-4 py-3 text-[13px] text-warn-700">
                <p className="font-semibold">
                  {previa.problemas.length} {previa.problemas.length === 1 ? "linha não vai entrar" : "linhas não vão entrar"}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {previa.problemas.slice(0, 8).map((p) => (
                    <li key={p.linha}>
                      Linha {p.linha}: {p.motivo}
                    </li>
                  ))}
                  {previa.problemas.length > 8 && <li>e mais {previa.problemas.length - 8}…</li>}
                </ul>
              </div>
            )}
            {previa.tutores.length > 0 && (
              <ul className="mt-4 divide-y divide-line rounded-[20px] border border-line">
                {previa.tutores.slice(0, 6).map((t) => (
                  <li key={t.whatsapp} className="px-4 py-3">
                    <p className="text-[14.5px] font-semibold">
                      {t.nome} {t.existenteId && <span className="text-[12px] font-medium text-muted">(já cadastrado)</span>}
                    </p>
                    <p className="text-[12.5px] text-muted">
                      {telefone(t.whatsapp)}
                      {t.pets.length > 0 && ` · ${t.pets.map((p) => `${p.nome} (${p.raca}, ${p.porte})`).join(", ")}`}
                    </p>
                  </li>
                ))}
                {previa.tutores.length > 6 && <li className="px-4 py-2.5 text-[13px] text-muted">e mais {previa.tutores.length - 6} clientes…</li>}
              </ul>
            )}
          </Secao>

          <label className="mx-5 mt-6 flex items-start gap-3 rounded-2xl bg-surface px-4 py-3 text-[14px]">
            <input type="checkbox" checked={consentimento} onChange={(e) => setConsentimento(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-brand-600" />
            <span>
              Estes clientes já aceitaram receber avisos pelo WhatsApp
              <span className="block text-[12.5px] text-muted">Desmarque se não tiver esse aceite: eles ficam sem sugestão de mensagem até você marcar na ficha (LGPD).</span>
            </span>
          </label>
          <div className="mx-5 mt-4">
            <Botao onClick={confirmar} disabled={total === 0}>
              {total === 0 ? "Nada novo para importar" : `Importar ${previa.novosTutores} clientes e ${previa.novosPets} pets`}
            </Botao>
          </div>
        </>
      )}
    </div>
  );
}

function Numero({ icone, valor, rotulo }: { icone: React.ReactNode; valor: number; rotulo: string }) {
  return (
    <div className="rounded-[18px] bg-brand-50 px-4 py-3 text-brand-700">
      {icone}
      <p className="mt-1 text-[24px] font-bold leading-none tracking-tight">{valor}</p>
      <p className="mt-0.5 text-[12.5px]">{rotulo}</p>
    </div>
  );
}
