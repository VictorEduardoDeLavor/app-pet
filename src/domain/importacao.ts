// Importação de clientes e pets a partir de uma planilha (CSV ou Excel).
// Uma linha = um pet com o seu tutor. Linhas com o mesmo WhatsApp viram o mesmo tutor.
// Funções puras: a leitura do arquivo (papaparse / read-excel-file) fica na tela.

import type { Db, Especie, Pet, Porte, Tutor } from "./types";
import { uid } from "./rules";
import { SEM_RACA, normalizarRaca } from "./racas";
import { normalizarAlergia } from "./ficha-pet";

export type CampoImport = "tutor" | "whatsapp" | "email" | "endereco" | "pet" | "especie" | "raca" | "porte" | "sexo" | "alergias" | "observacoes";

export const CAMPOS: { campo: CampoImport; rotulo: string; obrigatorio?: boolean; sinonimos: string[] }[] = [
  { campo: "tutor", rotulo: "Nome do tutor", obrigatorio: true, sinonimos: ["tutor", "nome do tutor", "cliente", "nome do cliente", "responsavel", "dono", "nome", "tutora", "proprietario"] },
  { campo: "whatsapp", rotulo: "WhatsApp", obrigatorio: true, sinonimos: ["whatsapp", "whats", "zap", "telefone", "celular", "fone", "contato", "tel"] },
  { campo: "email", rotulo: "E-mail", sinonimos: ["email", "e-mail", "e mail"] },
  { campo: "endereco", rotulo: "Endereço", sinonimos: ["endereco", "rua", "logradouro", "endereco completo"] },
  { campo: "pet", rotulo: "Nome do pet", sinonimos: ["pet", "nome do pet", "animal", "cachorro", "cao", "nome pet", "pets"] },
  { campo: "especie", rotulo: "Espécie", sinonimos: ["especie", "tipo", "tipo de animal"] },
  { campo: "raca", rotulo: "Raça", sinonimos: ["raca"] },
  { campo: "porte", rotulo: "Porte", sinonimos: ["porte", "tamanho"] },
  { campo: "sexo", rotulo: "Sexo", sinonimos: ["sexo", "genero"] },
  { campo: "alergias", rotulo: "Alergias", sinonimos: ["alergias", "alergia"] },
  { campo: "observacoes", rotulo: "Observações", sinonimos: ["observacoes", "observacao", "obs", "anotacoes", "cuidados"] },
];

export type Mapa = Record<CampoImport, number>;

const semAcento = (s: string) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[_.:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Acha a coluna de cada campo pelo cabeçalho. Coluna que não existe = -1. */
export function mapearColunas(cabecalho: unknown[]): Mapa {
  const cab = cabecalho.map((c) => semAcento(String(c ?? "")));
  const usadas = new Set<number>();
  const mapa = {} as Mapa;
  // Primeiro os nomes exatos, depois os que contêm o sinônimo ("Nome do pet" não pode cair em "nome").
  for (const passo of ["exato", "contem"] as const) {
    for (const { campo, sinonimos } of CAMPOS) {
      if (mapa[campo] !== undefined && mapa[campo] >= 0) continue;
      const i = cab.findIndex((c, idx) => !usadas.has(idx) && sinonimos.some((s) => (passo === "exato" ? c === s : c.includes(s) && s.length >= 3)));
      mapa[campo] = i;
      if (i >= 0) usadas.add(i);
    }
  }
  return mapa;
}

/** WhatsApp só com dígitos e com 55 na frente; null se não parece um celular/fixo brasileiro. */
export function normalizarTelefone(v: unknown): string | null {
  let d = String(v ?? "").replace(/\D/g, "");
  if (d.startsWith("0")) d = d.replace(/^0+/, "");
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return /^55\d{10,11}$/.test(d) ? d : null;
}

export function normalizarPorte(v: unknown): Porte | null {
  const s = semAcento(String(v ?? ""));
  if (!s) return null;
  if (["gg", "gigante", "extra grande", "muito grande", "xg"].some((x) => s === x || s.startsWith(x))) return "GG";
  if (s === "p" || s.startsWith("peq") || s.startsWith("mini") || s.startsWith("toy")) return "P";
  if (s === "m" || s.startsWith("med")) return "M";
  if (s === "g" || s.startsWith("gra")) return "G";
  return null;
}

export function normalizarEspecie(v: unknown): Especie {
  const s = semAcento(String(v ?? ""));
  return /gat|felin/.test(s) ? "gato" : "cao";
}

const titulo = (s: string) =>
  s
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/(^|\s|-)(\p{L})/gu, (_, a, b) => a + b.toUpperCase())
    .replace(/\s(Da|De|Do|Das|Dos|E)\s/g, (m) => m.toLowerCase());

/** "shih tzu" vira "Shih Tzu"; siglas como SRD continuam em maiúsculas; vazio vira SRD. */
/** Raça da lista quando reconhecida ("shitzu" → "Shih-tzu", "SRD" → "Sem raça definida"); senão, como veio. */
function racaLimpa(v: string, especie: Especie): string {
  if (!v.trim()) return SEM_RACA;
  const daLista = normalizarRaca(v, especie);
  if (daLista !== v.trim().replace(/\s+/g, " ")) return daLista;
  if (/^[A-Z]{2,4}$/.test(v.trim())) return v.trim().toUpperCase();
  return titulo(v);
}

export interface TutorImport {
  nome: string;
  whatsapp: string;
  email?: string;
  endereco?: string;
  pets: PetImport[];
  /** Já existe no pet shop: só os pets novos entram. */
  existenteId?: string;
}

export interface PetImport {
  nome: string;
  especie: Especie;
  raca: string;
  porte: Porte;
  porteInformado: boolean;
  sexo?: "M" | "F";
  alergias?: string;
  observacoes?: string;
}

export interface Problema {
  linha: number; // número da linha na planilha (1 = cabeçalho)
  motivo: string;
}

export interface Previa {
  tutores: TutorImport[];
  problemas: Problema[];
  novosTutores: number;
  novosPets: number;
  petsRepetidos: number;
  semPorte: number;
}

const celula = (linha: unknown[], i: number) => (i >= 0 ? String(linha[i] ?? "").trim() : "");

/** Lê as linhas (a primeira é o cabeçalho) e monta a prévia, sem gravar nada. */
export function montarPrevia(db: Db, linhas: unknown[][], mapa = mapearColunas(linhas[0] ?? [])): Previa {
  const problemas: Problema[] = [];
  if (mapa.tutor < 0 || mapa.whatsapp < 0) {
    return {
      tutores: [],
      problemas: [{ linha: 1, motivo: "A planilha precisa ter as colunas do nome do tutor e do WhatsApp." }],
      novosTutores: 0,
      novosPets: 0,
      petsRepetidos: 0,
      semPorte: 0,
    };
  }
  const porZap = new Map<string, TutorImport>();
  const existentes = new Map(db.tutores.map((t) => [t.whatsapp, t]));
  let petsRepetidos = 0;

  linhas.slice(1).forEach((l, idx) => {
    const n = idx + 2;
    if (!l || l.every((c) => String(c ?? "").trim() === "")) return;
    const nome = celula(l, mapa.tutor);
    const zap = normalizarTelefone(celula(l, mapa.whatsapp));
    if (nome.length < 2) return void problemas.push({ linha: n, motivo: "sem nome do tutor" });
    if (!zap) return void problemas.push({ linha: n, motivo: `WhatsApp inválido (${celula(l, mapa.whatsapp) || "vazio"})` });

    let t = porZap.get(zap);
    if (!t) {
      const ex = existentes.get(zap);
      t = {
        nome: ex?.nome ?? titulo(nome),
        whatsapp: zap,
        email: celula(l, mapa.email) || undefined,
        endereco: celula(l, mapa.endereco) || undefined,
        pets: [],
        existenteId: ex?.id,
      };
      porZap.set(zap, t);
    }

    const nomePet = celula(l, mapa.pet);
    if (!nomePet) return;
    const jaTem =
      t.pets.some((p) => semAcento(p.nome) === semAcento(nomePet)) ||
      (!!t.existenteId && db.pets.some((p) => p.tutorId === t!.existenteId && semAcento(p.nome) === semAcento(nomePet)));
    if (jaTem) {
      petsRepetidos++;
      return;
    }
    const porte = normalizarPorte(celula(l, mapa.porte));
    const sexo = semAcento(celula(l, mapa.sexo));
    const especie = normalizarEspecie(celula(l, mapa.especie));
    t.pets.push({
      nome: titulo(nomePet),
      especie,
      raca: racaLimpa(celula(l, mapa.raca), especie),
      porte: porte ?? "M",
      porteInformado: !!porte,
      sexo: sexo.startsWith("f") ? "F" : sexo.startsWith("m") ? "M" : undefined,
      alergias: normalizarAlergia(celula(l, mapa.alergias)),
      observacoes: celula(l, mapa.observacoes) || undefined,
    });
  });

  const tutores = [...porZap.values()].filter((t) => !t.existenteId || t.pets.length > 0);
  return {
    tutores,
    problemas,
    novosTutores: tutores.filter((t) => !t.existenteId).length,
    novosPets: tutores.reduce((s, t) => s + t.pets.length, 0),
    petsRepetidos,
    semPorte: tutores.reduce((s, t) => s + t.pets.filter((p) => !p.porteInformado).length, 0),
  };
}

/** Aplica a prévia no Db e devolve o que é novo (para gravar no banco em lote). */
export function aplicarImportacao(db: Db, previa: Previa, agora: Date, consentimento = true): { db: Db; tutores: Tutor[]; pets: Pet[] } {
  const tutores: Tutor[] = [];
  const pets: Pet[] = [];
  const zapsExistentes = new Set(db.tutores.map((t) => t.whatsapp));
  for (const t of previa.tutores) {
    let tutorId = t.existenteId;
    if (!tutorId) {
      if (zapsExistentes.has(t.whatsapp)) continue; // cadastrado entre a prévia e a importação
      tutorId = uid();
      tutores.push({
        id: tutorId,
        nome: t.nome,
        whatsapp: t.whatsapp,
        email: t.email,
        endereco: t.endereco,
        consentimentoWhatsapp: consentimento,
        criadoEm: agora.toISOString(),
      });
    }
    for (const p of t.pets) {
      pets.push({
        id: uid(),
        tutorId,
        nome: p.nome,
        especie: p.especie,
        raca: p.raca,
        porte: p.porte,
        sexo: p.sexo,
        alergias: p.alergias,
        observacoes: p.observacoes,
      });
    }
  }
  return { db: { ...db, tutores: [...db.tutores, ...tutores], pets: [...db.pets, ...pets] }, tutores, pets };
}

/** Planilha modelo (CSV com ; para abrir certo no Excel em português). */
export function modeloCsv(): string {
  const linhas = [
    ["Nome do tutor", "WhatsApp", "E-mail", "Endereço", "Nome do pet", "Espécie", "Raça", "Porte", "Sexo", "Alergias", "Observações"],
    ["Carla Mendes", "(11) 98765-4321", "carla@email.com", "Rua das Flores, 120", "Thor", "Cão", "Golden Retriever", "G", "M", "", "Medo de secador"],
    ["Carla Mendes", "(11) 98765-4321", "", "", "Mel", "Cão", "Shih Tzu", "P", "F", "Frango", ""],
    ["Rafael Souza", "(11) 91234-5678", "", "Av. Brasil, 45", "Luna", "Gato", "SRD", "P", "F", "", ""],
  ];
  return "﻿" + linhas.map((l) => l.map((c) => (/[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(";")).join("\r\n");
}
