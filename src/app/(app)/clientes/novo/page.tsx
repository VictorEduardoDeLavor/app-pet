"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/data/store";
import type { Pet } from "@/domain/types";
import { normalizarWhatsapp } from "@/domain/format";
import { Botao, Campo, TituloVoltar, cx } from "@/components/ui";
import { CamposPet } from "@/components/pet-form";
import { useToast } from "@/components/providers";

export default function NovoCliente() {
  const router = useRouter();
  const toast = useToast();
  const criarTutor = useApp((s) => s.criarTutor);
  const criarPet = useApp((s) => s.criarPet);
  const [nome, setNome] = useState("");
  const [zap, setZap] = useState("");
  const [endereco, setEndereco] = useState("");
  const [consentimento, setConsentimento] = useState(true);
  const [pet, setPet] = useState<Omit<Pet, "id" | "tutorId">>({ nome: "", especie: "cao", raca: "", porte: "P" });

  return (
    <div>
      <TituloVoltar voltarPara="/clientes">Novo cliente</TituloVoltar>
      <form
        className="space-y-4 px-5 pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          const t = criarTutor({ nome, whatsapp: normalizarWhatsapp(zap), endereco, consentimentoWhatsapp: consentimento });
          if (!t.ok) return toast(t.erro, "erro");
          if (pet.nome.trim()) {
            const p = criarPet({ ...pet, raca: pet.raca.trim() || "Sem raça definida", tutorId: t.valor });
            if (!p.ok) toast(p.erro, "erro");
          }
          toast(`${nome.trim()} cadastrado`);
          router.replace(`/clientes/${t.valor}`);
        }}
      >
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-brand-600">Tutor</h2>
        <Campo rotulo="Nome completo">
          <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" />
        </Campo>
        <Campo rotulo="WhatsApp com DDD">
          <input className="input" inputMode="tel" value={zap} onChange={(e) => setZap(e.target.value)} placeholder="(11) 98765-4321" />
        </Campo>
        <Campo rotulo="Endereço (opcional)">
          <input className="input" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
        </Campo>
        <label className="flex items-start gap-3 rounded-2xl bg-surface px-4 py-3 text-[14px]">
          <input type="checkbox" checked={consentimento} onChange={(e) => setConsentimento(e.target.checked)} className="mt-0.5 h-5 w-5 accent-brand-600" />
          <span>
            Tutor aceita receber lembretes e avisos pelo WhatsApp
            <span className="block text-[12.5px] text-muted">Registro de consentimento (LGPD).</span>
          </span>
        </label>

        <h2 className={cx("pt-4 text-[13px] font-semibold uppercase tracking-wide text-brand-600")}>Primeiro pet</h2>
        <CamposPet valor={pet} onChange={setPet} />

        <Botao type="submit" className="!mt-6">
          Salvar cliente
        </Botao>
      </form>
    </div>
  );
}
