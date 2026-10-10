// Endereço pelo CEP (ViaCEP: gratuito, sem chave, aberto ao navegador).
// O resultado vira o texto do campo de endereço, que continua editável e é o que o motorista abre no mapa.

export interface Logradouro {
  rua: string;
  bairro: string;
  cidade: string;
  uf: string;
}

/** Só os 8 dígitos, ou "" se não for um CEP completo. */
export function limparCep(texto: string): string {
  const d = texto.replace(/\D/g, "");
  return d.length === 8 ? d : "";
}

/** "01234567" → "01234-567" enquanto digita. */
export function mascararCep(texto: string): string {
  const d = texto.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** "Rua das Dálias, 77 · Jd. Pedra Branca, São Paulo/SP · CEP 01234-567" */
export function montarEndereco(l: Logradouro, numero: string, cep: string, complemento = ""): string {
  const ruaNumero = [l.rua, numero.trim() || "s/n"].filter(Boolean).join(", ");
  const comp = complemento.trim() ? ` ${complemento.trim()}` : "";
  const local = [l.bairro, [l.cidade, l.uf].filter(Boolean).join("/")].filter(Boolean).join(", ");
  return [ruaNumero + comp, local, cep ? `CEP ${mascararCep(cep)}` : ""].filter(Boolean).join(" · ");
}

/** Resposta do ViaCEP para o nosso formato (null = CEP não existe). */
export function lerViaCep(json: unknown): Logradouro | null {
  const r = json as { erro?: boolean | string; logradouro?: string; bairro?: string; localidade?: string; uf?: string } | null;
  if (!r || r.erro || !r.localidade) return null;
  return { rua: r.logradouro ?? "", bairro: r.bairro ?? "", cidade: r.localidade ?? "", uf: r.uf ?? "" };
}

export async function buscarCep(cep: string): Promise<Logradouro | null> {
  const d = limparCep(cep);
  if (!d) return null;
  const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
  if (!r.ok) throw new Error("Não foi possível consultar o CEP agora.");
  return lerViaCep(await r.json());
}
