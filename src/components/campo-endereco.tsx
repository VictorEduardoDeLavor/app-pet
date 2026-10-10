"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { buscarCep, limparCep, mascararCep, montarEndereco, type Logradouro } from "@/domain/cep";

/**
 * Endereço com CEP: digite o CEP e o número e o endereço se completa sozinho (ViaCEP).
 * O texto final continua editável e é o que vai para o tutor e para o mapa do leva e traz.
 */
export function CampoEndereco({ valor, onChange, rotulo = "Endereço", dica }: { valor: string; onChange: (v: string) => void; rotulo?: string; dica?: string }) {
  const [cep, setCep] = useState("");
  const [numero, setNumero] = useState("");
  const [achado, setAchado] = useState<Logradouro | null>(null);
  const [estado, setEstado] = useState<"" | "buscando" | "nao-achou" | "erro">("");

  const aplicar = (l: Logradouro | null, n: string, c: string) => {
    if (l) onChange(montarEndereco(l, n, c));
  };

  return (
    <div>
      <span className="label">{rotulo}</span>
      <div className="grid grid-cols-[1fr_96px] gap-2">
        <div className="relative">
          <input
            className="input"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="CEP"
            value={cep}
            onChange={async (e) => {
              const c = mascararCep(e.target.value);
              setCep(c);
              if (!limparCep(c)) {
                setEstado("");
                return;
              }
              setEstado("buscando");
              try {
                const l = await buscarCep(c);
                setAchado(l);
                setEstado(l ? "" : "nao-achou");
                aplicar(l, numero, c);
              } catch {
                setEstado("erro");
              }
            }}
          />
          {estado === "buscando" && <LoaderCircle className="absolute right-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 animate-spin text-brand-500" />}
        </div>
        <input
          className="input"
          inputMode="numeric"
          placeholder="Nº"
          value={numero}
          onChange={(e) => {
            setNumero(e.target.value);
            aplicar(achado, e.target.value, cep);
          }}
        />
      </div>
      <textarea className="input mt-2 resize-none" rows={2} value={valor} onChange={(e) => onChange(e.target.value)} placeholder="Rua, número · bairro, cidade" />
      <span className="mt-1.5 block text-[12.5px] text-muted">
        {estado === "nao-achou" ? "CEP não encontrado. Escreva o endereço no campo acima." : estado === "erro" ? "Não deu para consultar o CEP agora. Escreva o endereço." : (dica ?? "Digite o CEP e o número: o resto se completa sozinho.")}
      </span>
    </div>
  );
}
