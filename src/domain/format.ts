// Formatação pt-BR e utilitários de data (datas locais "YYYY-MM-DD").

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Data local de hoje no formato YYYY-MM-DD. */
export function hoje(agora: Date = new Date()): string {
  return `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}`;
}

export function horaAtual(agora: Date = new Date()): string {
  return `${pad(agora.getHours())}:${pad(agora.getMinutes())}`;
}

export function parseData(iso: string): Date {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(a, m - 1, d);
}

export function somaDias(iso: string, dias: number): string {
  const d = parseData(iso);
  d.setDate(d.getDate() + dias);
  return hoje(d);
}

export function diferencaDias(de: string, ate: string): number {
  const ms = parseData(ate).getTime() - parseData(de).getTime();
  return Math.round(ms / 86_400_000);
}

export function diaDaSemana(iso: string): number {
  return parseData(iso).getDay();
}

/** "Terça, 6 de outubro" */
export function dataLonga(iso: string): string {
  const d = parseData(iso);
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

/** "6 de outubro" */
export function dataMedia(iso: string): string {
  const d = parseData(iso);
  return `${d.getDate()} de ${MESES[d.getMonth()]}`;
}

/** "06/10/2026" */
export function dataCurta(iso: string): string {
  const d = parseData(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function diaCurto(iso: string): string {
  return DIAS_CURTOS[parseData(iso).getDay()];
}

/** Segunda-feira da semana da data. */
export function inicioSemana(iso: string): string {
  const dow = diaDaSemana(iso);
  const delta = dow === 0 ? -6 : 1 - dow;
  return somaDias(iso, delta);
}

export function minutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

export function horaDeMinutos(total: number): string {
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** Hora local "HH:MM" de um ISO completo. */
export function horaDoIso(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function dataDoIso(iso: string): string {
  return hoje(new Date(iso));
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlCurto = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** R$ 1.234,50 */
export function moeda(valor: number): string {
  return brl.format(valor).replace(/ /g, " ");
}

/** R$ 360 (sem centavos quando inteiro); R$ 801,40 quando tem centavos. */
export function moedaCurta(valor: number): string {
  return (Math.abs(Math.round(valor * 100) % 100) === 0 ? brlCurto : brl).format(valor).replace(/ /g, " ");
}

/** "1h", "45 min", "1h30" */
export function duracao(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h}h${pad(r)}` : `${h}h`;
}

/** 5511988776655 -> (11) 98877-6655 */
export function telefone(digitos: string): string {
  const d = digitos.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return digitos;
}

/** Normaliza o que a pessoa digitou para dígitos com DDI 55. */
export function normalizarWhatsapp(entrada: string): string {
  const d = entrada.replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) return d;
  return `55${d}`;
}

export function saudacao(agora: Date = new Date()): string {
  const h = agora.getHours();
  if (h < 5) return "Boa noite";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}

export const NOME_FORMA: Record<string, string> = {
  dinheiro: "Dinheiro",
  debito: "Débito",
  credito: "Crédito",
  pix: "Pix",
  transferencia: "Transferência",
};

export const NOME_PORTE: Record<string, string> = {
  P: "Porte P",
  M: "Porte M",
  G: "Porte G",
  GG: "Porte GG",
};

/** Lê um valor digitado ("1.234,50", "35,5", "35.5", "R$ 40") como número; vazio ou inválido = NaN. */
export function lerNumero(v: string): number {
  const t = v.trim().replace(/[R$\s]/g, "");
  if (!t) return NaN;
  return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
}
