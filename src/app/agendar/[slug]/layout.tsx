import type { Metadata } from "next";
import type { ReactNode } from "react";

// Prévia do link no Instagram/WhatsApp: "Agende online na Spike Banho & Tosa".

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let titulo = "Agende o banho do seu pet";
  let descricao = "Escolha o serviço, o dia e o horário em poucos toques.";

  if (url && chave && /^[a-z0-9][a-z0-9-]{2,59}$/.test(slug)) {
    try {
      const r = await fetch(`${url}/rest/v1/rpc/agenda_publica`, {
        method: "POST",
        headers: { apikey: chave, "Content-Type": "application/json" },
        body: JSON.stringify({ p_slug: slug, p_dias: 1 }),
        next: { revalidate: 600 },
      });
      const d = (await r.json()) as { petshop?: { nome: string; endereco: string | null } } | null;
      if (d?.petshop) {
        titulo = `Agende online na ${d.petshop.nome}`;
        if (d.petshop.endereco) descricao = `Banho e tosa · ${d.petshop.endereco}`;
      }
    } catch {
      // Sem prévia personalizada; a página continua funcionando.
    }
  }

  return {
    title: titulo,
    description: descricao,
    openGraph: { title: titulo, description: descricao, images: ["/fotos/capa-banho.webp"], type: "website" },
  };
}

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
