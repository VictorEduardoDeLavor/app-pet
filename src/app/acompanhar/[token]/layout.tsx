import type { Metadata } from "next";
import type { ReactNode } from "react";

// Prévia do link no WhatsApp: "Acompanhe o Thor na Patinhas" com a foto mais recente.
// Roda no servidor e usa a mesma consulta pública do link (só funciona com o token certo).

type Dados = {
  pet?: { nome: string; foto_path: string | null };
  petshop?: { nome: string };
  etapas?: { foto_path: string | null }[];
};

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let titulo = "Acompanhe seu pet";
  const descricao = "Etapas do banho com fotos e o leva e traz em tempo real.";
  let imagem = "/fotos/capa-banho.webp";

  if (url && chave && /^[0-9a-f]{32}$/.test(token)) {
    try {
      const r = await fetch(`${url}/rest/v1/rpc/acompanhamento`, {
        method: "POST",
        headers: { apikey: chave, "Content-Type": "application/json" },
        body: JSON.stringify({ p_token: token }),
        cache: "no-store",
      });
      const d = (await r.json()) as Dados | null;
      if (d?.pet && d.petshop) {
        titulo = `Acompanhe ${d.pet.nome} na ${d.petshop.nome}`;
        const foto = [...(d.etapas ?? [])].reverse().find((e) => e.foto_path)?.foto_path ?? d.pet.foto_path;
        if (foto) imagem = `${url}/storage/v1/object/public/fotos/${foto}`;
      }
    } catch {
      // Sem prévia personalizada; o link continua funcionando.
    }
  }

  return {
    title: titulo,
    description: descricao,
    robots: { index: false, follow: false },
    openGraph: { title: titulo, description: descricao, images: [imagem], type: "website" },
  };
}

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
