// Pix "copia e cola" (BR Code estático, padrão EMV do Banco Central), sem intermediário:
// o dinheiro vai direto para a chave do pet shop e a equipe confere no extrato.

export type TipoChavePix = "cpf" | "cnpj" | "celular" | "email" | "aleatoria";

const so = (s: string) => s.replace(/\D/g, "");

function cpfValido(c: string): boolean {
  if (!/^\d{11}$/.test(c) || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}

function cnpjValido(c: string): boolean {
  if (!/^\d{14}$/.test(c) || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (n: number) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = pesos.reduce((t, p, i) => t + Number(c[i]) * p, 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(c[12]) && calc(13) === Number(c[13]);
}

/** Reconhece o tipo da chave e devolve no formato que o Pix exige (celular com +55, CPF só dígitos...). */
export function normalizarChavePix(entrada: string): { tipo: TipoChavePix; chave: string } | null {
  const t = entrada.trim();
  if (!t) return null;
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t)) return { tipo: "email", chave: t.toLowerCase() };
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) return { tipo: "aleatoria", chave: t.toLowerCase() };
  const d = so(t);
  if (t.startsWith("+")) return /^55\d{10,11}$/.test(d) ? { tipo: "celular", chave: `+${d}` } : null;
  if (d.length === 14 && cnpjValido(d)) return { tipo: "cnpj", chave: d };
  if (d.length === 11 && cpfValido(d)) return { tipo: "cpf", chave: d };
  if (d.length === 11 && d[2] === "9") return { tipo: "celular", chave: `+55${d}` };
  if (d.length === 13 && d.startsWith("55")) return { tipo: "celular", chave: `+${d}` };
  return null;
}

export const NOME_CHAVE: Record<TipoChavePix, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  celular: "Celular",
  email: "E-mail",
  aleatoria: "Chave aleatória",
};

/** CRC16-CCITT (polinômio 0x1021, início 0xFFFF), como pede o BR Code. */
export function crc16(texto: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(texto)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

const campo = (id: string, valor: string) => `${id}${String(valor.length).padStart(2, "0")}${valor}`;

/** Nome e cidade do recebedor: sem acento, só caracteres simples, no tamanho máximo do padrão. */
function ascii(s: string, max: number): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 .,\-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export interface PixInput {
  chave: string;
  nome: string;
  cidade: string;
  valor?: number;
  /** Identificador da cobrança (até 25 letras/números). "***" = sem identificador. */
  txid?: string;
  descricao?: string;
}

/** Código "copia e cola". Lança erro se a chave for inválida. */
export function brCode(p: PixInput): string {
  const chave = normalizarChavePix(p.chave)?.chave ?? (p.chave.trim() || null);
  if (!chave) throw new Error("Chave Pix inválida.");
  const conta = campo("00", "br.gov.bcb.pix") + campo("01", chave) + (p.descricao ? campo("02", ascii(p.descricao, 40)) : "");
  const txid = (p.txid ?? "***").replace(/[^A-Za-z0-9*]/g, "").slice(0, 25) || "***";
  const corpo =
    campo("00", "01") +
    campo("26", conta) +
    campo("52", "0000") +
    campo("53", "986") +
    (p.valor && p.valor > 0 ? campo("54", p.valor.toFixed(2)) : "") +
    campo("58", "BR") +
    campo("59", ascii(p.nome, 25) || "PET SHOP") +
    campo("60", ascii(p.cidade, 15) || "BRASIL") +
    campo("62", campo("05", txid)) +
    "6304";
  return corpo + crc16(corpo);
}
