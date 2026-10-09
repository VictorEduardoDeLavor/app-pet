// Tudo o que identifica a marca num lugar só. Trocar o nome do produto = mudar aqui.

export const MARCA = {
  nome: "APP PET",
  /** Frase curta usada na página de vendas e nas prévias de link. */
  slogan: "Gestão de banho e tosa com a tutora acompanhando cada etapa",
  /** Preço da assinatura mensal (o banco usa o mesmo valor no teste grátis). */
  precoMensal: 49,
  diasTeste: 14,
  /** Contato do suporte (preencher quando houver número e e-mail próprios). */
  suporteWhatsapp: "",
  suporteEmail: "",
  /** Dados de quem presta o serviço, usados nos termos (preencher com o CNPJ quando houver). */
  empresa: {
    razaoSocial: "",
    documento: "",
    cidade: "São Paulo/SP",
  },
  /** Versão vigente dos termos de uso e da política de privacidade. */
  versaoTermos: "2026-10",
} as const;

/** Link para falar com o suporte (WhatsApp ou e-mail); null enquanto nenhum contato foi definido. */
export function linkSuporte(texto = `Olá! Preciso de ajuda com o ${MARCA.nome}.`): string | null {
  if (MARCA.suporteWhatsapp) return `https://wa.me/${MARCA.suporteWhatsapp}?text=${encodeURIComponent(texto)}`;
  if (MARCA.suporteEmail) return `mailto:${MARCA.suporteEmail}?subject=${encodeURIComponent(MARCA.nome)}&body=${encodeURIComponent(texto)}`;
  return null;
}
