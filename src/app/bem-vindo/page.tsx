"use client";

import { useEffect, useState } from "react";
import { KeyRound, PawPrint } from "lucide-react";
import { CHAVE_CONVITE, supabase } from "@/lib/supabase/client";
import { aceitarConvite, criarPetshop } from "@/data/cloud";
import { normalizarWhatsapp } from "@/domain/format";
import { Botao, Campo, Segmentado } from "@/components/ui";
import { useSessao } from "@/components/providers";
import { MARCA } from "@/lib/marca";

type Caminho = "criar" | "convite";

export default function BemVindo() {
  const { sair } = useSessao();
  const [caminho, setCaminho] = useState<Caminho>("criar");
  const [nome, setNome] = useState("");
  const [dono, setDono] = useState("");
  const [zap, setZap] = useState("");
  const [codigo, setCodigo] = useState("");
  const [aceite, setAceite] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Veio de um link de convite (direto ou guardado antes do cadastro).
  useEffect(() => {
    const doLink = new URLSearchParams(window.location.search).get("convite");
    const guardado = localStorage.getItem(CHAVE_CONVITE);
    const c = doLink ?? guardado;
    if (c) {
      setCodigo(c.toUpperCase());
      setCaminho("convite");
    }
  }, []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      if (caminho === "criar") {
        if (!aceite) throw new Error("Para criar o pet shop, aceite os termos de uso e a política de privacidade.");
        await criarPetshop(supabase(), { nome, donoNome: dono, whatsapp: zap.trim() ? normalizarWhatsapp(zap) : undefined, termos: MARCA.versaoTermos });
      } else {
        await aceitarConvite(supabase(), codigo);
        localStorage.removeItem(CHAVE_CONVITE);
      }
      window.location.href = "/";
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
      setEnviando(false);
    }
  }

  return (
    <main className="mx-auto min-h-dvh max-w-[440px] bg-white px-6 pb-10 pt-6 sm:border-x sm:border-line">
      <div className="relative h-48 overflow-hidden rounded-[28px] bg-[#efe6dc] shadow-[var(--shadow-hero)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/fotos/boas-vindas.webp" alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: "center 45%" }} />
        <span className="absolute bottom-4 left-4 grid h-12 w-12 place-items-center rounded-2xl bg-white/90 text-brand-600 shadow-sm backdrop-blur">
          {caminho === "criar" ? <PawPrint className="h-7 w-7" strokeWidth={2.2} /> : <KeyRound className="h-6 w-6" strokeWidth={2.2} />}
        </span>
      </div>
      <h1 className="mt-5 text-[26px] font-bold tracking-tight">{caminho === "criar" ? "Vamos configurar seu pet shop" : "Entrar na equipe"}</h1>
      <p className="mt-1 text-[15px] text-muted">
        {caminho === "criar"
          ? "Leva um minuto. Já deixamos serviços, pacotes e mensagens prontos para você ajustar depois."
          : "Digite o código de 6 letras que o dono do pet shop mandou para você."}
      </p>

      <Segmentado
        className="mt-7"
        opcoes={[
          { valor: "criar", rotulo: "Sou o dono" },
          { valor: "convite", rotulo: "Tenho um convite" },
        ]}
        valor={caminho}
        onChange={(v) => {
          setCaminho(v);
          setErro(null);
        }}
      />

      <form onSubmit={enviar} className="mt-6 space-y-4">
        {caminho === "criar" ? (
          <>
            <Campo rotulo="Nome do pet shop">
              <input className="input" required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Patinhas Banho e Tosa" />
            </Campo>
            <Campo rotulo="Seu nome">
              <input className="input" required value={dono} onChange={(e) => setDono(e.target.value)} autoComplete="name" />
            </Campo>
            <Campo rotulo="WhatsApp do pet shop (opcional)">
              <input className="input" inputMode="tel" value={zap} onChange={(e) => setZap(e.target.value)} placeholder="(11) 98765-4321" />
            </Campo>
            <p className="rounded-2xl bg-brand-50 px-4 py-3 text-[13.5px] text-brand-700">
              {MARCA.diasTeste} dias grátis com tudo liberado, sem cartão. Depois, R$ {MARCA.precoMensal}/mês, sem fidelidade.
            </p>
            <label className="flex items-start gap-3 text-[14px] text-muted">
              <input type="checkbox" required className="mt-0.5 h-5 w-5 shrink-0 accent-brand-600" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
              <span>
                Li e aceito os{" "}
                <a href="/termos" target="_blank" className="font-semibold text-brand-700 underline underline-offset-2">
                  termos de uso
                </a>{" "}
                e a{" "}
                <a href="/privacidade" target="_blank" className="font-semibold text-brand-700 underline underline-offset-2">
                  política de privacidade
                </a>
                .
              </span>
            </label>
          </>
        ) : (
          <Campo rotulo="Código de convite">
            <input
              className="input text-center font-mono text-[22px] font-bold uppercase tracking-[0.3em]"
              required
              autoCapitalize="characters"
              autoComplete="one-time-code"
              maxLength={7}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="ABC234"
            />
          </Campo>
        )}
        {erro && <p className="rounded-2xl bg-bad-50 px-4 py-3 text-[14px] text-bad-700">{erro}</p>}
        <Botao type="submit" disabled={enviando}>
          {enviando ? "Aguarde…" : caminho === "criar" ? "Criar meu pet shop" : "Entrar na equipe"}
        </Botao>
      </form>
      <button onClick={sair} className="mt-6 w-full text-center text-[14px] text-muted">
        Sair desta conta
      </button>
    </main>
  );
}
