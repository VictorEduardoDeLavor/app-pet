"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/data/store";
import type { Especie, Pet, Porte } from "@/domain/types";
import { Botao, Campo, Folha, cx } from "./ui";
import { useToast } from "./providers";

type Rascunho = Omit<Pet, "id" | "tutorId">;

const VAZIO: Rascunho = { nome: "", especie: "cao", raca: "", porte: "P" };

export function CamposPet({ valor, onChange }: { valor: Rascunho; onChange: (v: Rascunho) => void }) {
  const set = <K extends keyof Rascunho>(k: K, v: Rascunho[K]) => onChange({ ...valor, [k]: v });
  const Opcoes = <T extends string>({ itens, atual, on }: { itens: { v: T; r: string }[]; atual?: T; on: (v: T) => void }) => (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${itens.length}, minmax(0, 1fr))` }}>
      {itens.map((i) => (
        <button
          key={i.v}
          type="button"
          onClick={() => on(i.v)}
          className={cx("tap rounded-xl border py-2.5 text-[14px] font-medium", atual === i.v ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line text-muted")}
        >
          {i.r}
        </button>
      ))}
    </div>
  );
  return (
    <div className="space-y-4">
      <Campo rotulo="Nome">
        <input className="input" value={valor.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex.: Thor" />
      </Campo>
      <div>
        <span className="label">Espécie</span>
        <Opcoes itens={[{ v: "cao" as Especie, r: "Cão" }, { v: "gato" as Especie, r: "Gato" }]} atual={valor.especie} on={(v) => set("especie", v)} />
      </div>
      <Campo rotulo="Raça">
        <input className="input" value={valor.raca} onChange={(e) => set("raca", e.target.value)} placeholder="Ex.: Golden Retriever ou SRD" />
      </Campo>
      <div>
        <span className="label">Porte (define preço e duração)</span>
        <Opcoes itens={(["P", "M", "G", "GG"] as Porte[]).map((p) => ({ v: p, r: p }))} atual={valor.porte} on={(v) => set("porte", v)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="label">Sexo</span>
          <Opcoes itens={[{ v: "M" as const, r: "Macho" }, { v: "F" as const, r: "Fêmea" }]} atual={valor.sexo} on={(v) => set("sexo", v)} />
        </div>
        <Campo rotulo="Peso (kg)">
          <input className="input" inputMode="decimal" value={valor.pesoKg ?? ""} onChange={(e) => set("pesoKg", e.target.value ? Number(e.target.value.replace(",", ".")) : undefined)} />
        </Campo>
      </div>
      <Campo rotulo="Pelagem">
        <input className="input" value={valor.pelagem ?? ""} onChange={(e) => set("pelagem", e.target.value || undefined)} placeholder="Ex.: longa, dupla" />
      </Campo>
      <Campo rotulo="Temperamento">
        <input className="input" value={valor.temperamento ?? ""} onChange={(e) => set("temperamento", e.target.value || undefined)} placeholder="Ex.: manso, medroso, agitado" />
      </Campo>
      <Campo rotulo="Alergias" dica="Aparece em destaque na agenda e na tela do banhista.">
        <input className="input" value={valor.alergias ?? ""} onChange={(e) => set("alergias", e.target.value || undefined)} placeholder="Ex.: perfume" />
      </Campo>
      <Campo rotulo="Cuidados especiais">
        <input className="input" value={valor.cuidados ?? ""} onChange={(e) => set("cuidados", e.target.value || undefined)} placeholder="Ex.: evitar fragrâncias" />
      </Campo>
      <Campo rotulo="Observações">
        <textarea className="input resize-none" rows={2} value={valor.observacoes ?? ""} onChange={(e) => set("observacoes", e.target.value || undefined)} />
      </Campo>
    </div>
  );
}

export function NovoPetFolha({ aberta, onFechar, tutorId }: { aberta: boolean; onFechar: () => void; tutorId: string }) {
  const criarPet = useApp((s) => s.criarPet);
  const toast = useToast();
  const [r, setR] = useState<Rascunho>(VAZIO);
  useEffect(() => {
    if (aberta) setR(VAZIO);
  }, [aberta]);
  return (
    <Folha aberta={aberta} onFechar={onFechar} titulo="Novo pet">
      <CamposPet valor={r} onChange={setR} />
      <Botao
        className="mt-5"
        onClick={() => {
          const res = criarPet({ ...r, raca: r.raca.trim() || "Sem raça definida", tutorId });
          if (!res.ok) return toast(res.erro, "erro");
          toast(`${r.nome.trim()} cadastrado`);
          onFechar();
        }}
      >
        Salvar pet
      </Botao>
    </Folha>
  );
}

export function EditarPetFolha({ aberta, onFechar, pet }: { aberta: boolean; onFechar: () => void; pet: Pet }) {
  const atualizar = useApp((s) => s.atualizarPet);
  const toast = useToast();
  const [r, setR] = useState<Rascunho>(pet);
  useEffect(() => {
    if (aberta) setR(pet);
  }, [aberta, pet]);
  return (
    <Folha aberta={aberta} onFechar={onFechar} titulo={`Editar ${pet.nome}`}>
      <CamposPet valor={r} onChange={setR} />
      <Botao
        className="mt-5"
        onClick={() => {
          if (!r.nome.trim()) return toast("Informe o nome do pet.", "erro");
          atualizar({ ...pet, ...r, nome: r.nome.trim() });
          toast("Ficha atualizada");
          onFechar();
        }}
      >
        Salvar alterações
      </Botao>
    </Folha>
  );
}
